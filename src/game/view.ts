/**
 * Геттеры для UI (без логики в компонентах, ADR-004): «Витрина» — HUD рана,
 * «Изнанка» — честный двойник (systems-spec §3.4). Чистые функции от RunState и конфига.
 */
import { expectedBonusLeft, type BonusForecast } from './bonus'
import { ITEM_IDS, slotMetrics, type GameConfig, type ItemId } from './config'
import { betCap, betLimit, effectiveBet } from './commands/slot'
import { wagerLeft } from './commands/casino'
import { checkQuit } from './commands/day'
import { offerHandler } from './commands/work'
import { contactDepth, contactsOn, findOffer, jailRiskOpen, offerEv, pEff } from './contacts'
import type { ContactId } from './content/contacts'
import { findSleepEvent, optionCost, optionRejection } from './day'
import { cashbackAmount, oldestPawned } from './content/events'
import {
  billDueToday,
  billTotal,
  debtOf,
  forfeitOnEnd,
  forkBillToday,
  friendAmount,
  interestTonight,
  isForkOpen,
  nextUnpaidBill,
  redeemCost,
  casinoBlocked,
  shiftPayNet,
  shiftPromos,
  spinEnergyCost,
  tiltStage,
  weekOf
} from './rules'
import { casinoHours, casinoNetLive, luckReport, rtpActual } from './statement'
import { stat } from './stats'
import type {
  BillStatus,
  BonusState,
  EventOf,
  ItemStatus,
  Location,
  Rejection,
  RunPhase,
  RunState,
  TiltStage,
  Withdrawal
} from './types'

export interface BillView {
  week: number
  dueDay: number
  /** 0 — сегодня. */
  daysLeft: number
  fixed: number
  /** fixed + ceil(10% текущего долга). */
  total: number
  /** Долговая часть счёта: ceil(10% долга) = total − fixed; при оплате гасит долг. */
  debtPart: number
  /** Фикс счёта после отсрочки (+GRACE_PENALTY); null — отсрочка уже была или счёт уже отсрочен. */
  deferredFixed: number | null
  isToday: boolean
  status: BillStatus
}

/** Всё, что показывают постоянные индикаторы «Жизни» и казино (GDD §3.12). */
export interface HudView {
  day: number
  week: number
  runDays: number
  endless: boolean
  extraWeeks: number
  phase: RunPhase
  location: Location
  energy: number
  energyMax: number
  wallet: number
  casino: number
  debt: number
  debtBank: number
  debtMfo: number
  rep: number
  tilt: number
  tiltStage: TiltStage
  bet: number
  /** Ставка, которая уйдёт в спин (клампится балансом и лимитом бонуса). */
  effectiveBet: number
  betCap: number
  /** Верхняя граница выбора ставки (кнопка ×2 упирается в неё). */
  betLimit: number
  spinEnergyCost: number
  items: Record<ItemId, ItemStatus>
  bonus: { state: BonusState; wagered: number; wagerReq: number; wagerLeft: number }
  withdrawals: Withdrawal[]
  /** Ближайший неоплаченный счёт (или счёт сегодняшнего дня). */
  bill: BillView | null
  graceUsed: boolean
  /** День развилки: счёт недели ≥ 4 со сроком сегодня оплачен. */
  forkOpen: boolean
  /** Причина, по которой «ЗАВЯЗАТЬ» недоступна (null — можно). */
  quitBlock: Rejection | null
  /**
   * Что сгорит при «ЗАВЯЗАТЬ» (GDD §3.7, E24): баланс казино и выводы в очереди (придут «завтра», которого не будет).
   * total > 0 → UI показывает предупреждение и ждёт подтверждения.
   */
  quitForfeit: { casino: number; withdrawals: number; total: number }
  casinoNights: number
  casinoNightsMax: number
  friendsBlocked: boolean
  /** Оплата следующей смены с учётом вычетов (аванс, «вишенки на экране»). */
  shiftPay: number
  /** Сколько следующих смен ещё с вычетом. */
  shiftDeductions: number
  /** Мама поставила блокировку: казино закрыто сегодня (mama_blocks_site). */
  casinoBlocked: boolean
  /** Смен до следующего повышения (0 — повышения кончились). */
  shiftsToPromo: number
  friendAmount: number
  interestTonight: number
  livingCost: number
  forcedEnd: boolean
}

function billView(run: RunState, config: GameConfig): BillView | null {
  const bill = billDueToday(run) ?? forkBillToday(run) ?? nextUnpaidBill(run)
  if (!bill) return null
  const B = config.balance
  const total = billTotal(run, bill, B)
  const canDefer = !run.graceUsed && B.GRACE_PER_RUN > 0 && bill.status !== 'deferred'
  return {
    week: bill.week,
    dueDay: bill.dueDay,
    daysLeft: Math.max(0, bill.dueDay - run.day),
    fixed: bill.fixed,
    total,
    debtPart: total - bill.fixed,
    deferredFixed: canDefer ? Math.ceil(bill.fixed * (1 + B.GRACE_PENALTY)) : null,
    isToday: bill.dueDay === run.day,
    status: bill.status
  }
}

export function buildHud(run: RunState, config: GameConfig): HudView {
  const B = config.balance
  const promos = shiftPromos(run, B)
  return {
    day: run.day,
    week: weekOf(run.day),
    runDays: B.RUN_DAYS,
    endless: run.endless,
    extraWeeks: run.extraWeeks,
    phase: run.phase,
    location: run.location,
    energy: run.energy,
    energyMax: B.ENERGY_PER_DAY,
    wallet: run.wallet,
    casino: run.casino,
    debt: debtOf(run),
    debtBank: run.debtBank,
    debtMfo: run.debtMfo,
    rep: run.rep,
    tilt: run.tilt,
    tiltStage: tiltStage(run.tilt, B),
    bet: run.bet,
    effectiveBet: effectiveBet(run, config),
    betCap: betCap(run, config),
    betLimit: betLimit(run, config),
    spinEnergyCost: spinEnergyCost(run, B),
    items: { ...run.items },
    bonus: { ...run.bonus, wagerLeft: wagerLeft(run.bonus) },
    withdrawals: run.withdrawals.map((w) => ({ ...w })),
    bill: billView(run, config),
    graceUsed: run.graceUsed,
    forkOpen: isForkOpen(run),
    quitBlock: run.phase === 'ended' ? { reason: 'wrong_phase' } : checkQuit(run),
    quitForfeit: forfeitOnEnd(run),
    casinoNights: run.casinoNights,
    casinoNightsMax: B.CASINO_NIGHTS_FOR_ENDING,
    friendsBlocked: run.friendsBlocked,
    shiftPay: shiftPayNet(run, B),
    shiftDeductions: run.eventState.shiftDeductions.length,
    casinoBlocked: casinoBlocked(run),
    shiftsToPromo: promos >= B.SHIFT_PROMO_MAX ? 0 : B.SHIFT_PROMO_EVERY - (run.shiftsDone % B.SHIFT_PROMO_EVERY),
    friendAmount: friendAmount(run, B),
    interestTonight: interestTonight(run, B),
    livingCost: B.LIVING_COST,
    forcedEnd: run.forcedEnd
  }
}

/** Карточка события сна для UI: id и доступность вариантов. */
export interface PendingEventView {
  eventId: string
  /**
   * affordable — вариант доступен; rejection — почему нет (нехватка ₽ / лимит долга) → formatRejection('event/choose', …).
   */
  options: { index: number; cost: number; affordable: boolean; rejection: Rejection | null }[]
  /** Подстановки текста карточки (i18n formatSleepEventCard): {casino_balance}, {amount}, {item}. */
  vars: { casino_balance: number; amount?: number; item?: ItemId }
}

export function buildPendingEvent(run: RunState, config: GameConfig): PendingEventView | null {
  if (run.phase !== 'event' || !run.pendingEventId) return null
  const def = findSleepEvent(config, run.pendingEventId)
  if (!def) return null
  const vars: PendingEventView['vars'] = { casino_balance: run.casino }
  if (def.id === 'cashback_letter') vars.amount = cashbackAmount(run, config)
  if (def.id === 'seryoga_wants_back') vars.amount = run.eventState.friendDebt
  if (def.id === 'pawn_offer') vars.item = oldestPawned(run) ?? undefined
  return {
    eventId: def.id,
    options: def.options.map((o, index) => {
      const rejection = optionRejection(run, o, config)
      return { index, cost: optionCost(run, o), affordable: rejection === null, rejection }
    }),
    vars
  }
}

/** Изнанка: честный протокол (systems-spec §3.4). */
export interface UnderbellyView {
  slot: {
    rtpDeclared: number
    hit: number
    ldw: number
    realWin: number
    lossLike: number
    tickerLossesPerWin: number
    /** Ожидаемая потеря текущей ставки за спин, ₽. */
    expectedLossPerSpin: number
  }
  casino: {
    spins: number
    totalWagered: number
    totalPaidOut: number
    rtpActual: number | null
    expectedLoss: number
    actualLoss: number
    luck: number
    winsShowcase: number
    winsReal: number
    ldw: number
    nearMiss: number
    deposited: number
    withdrawnNet: number
    withdrawFees: number
    /** Можно вывести сейчас (0 при активном бонусе). */
    withdrawable: number
    casinoNetLive: number
    pendingWithdrawals: Withdrawal[]
  }
  bonus: null | {
    state: BonusState
    wagered: number
    wagerReq: number
    wagerLeft: number
    forecast: BonusForecast
  }
  tilt: { value: number; stage: TiltStage; spinEnergyCost: number; t1: number; t2: number; max: number }
  debt: {
    total: number
    bank: number
    mfo: number
    interestTonight: number
    interestPaid: number
    forcedMfo: number
    /** Годовая ставка МФО сложными: (1 + r)^365 − 1. */
    mfoApr: number
  }
  items: { id: ItemId; status: ItemStatus; pawnValue: number; redeemCost: number }[]
  casinoNights: { n: number; max: number; lost: number }
  time: { casinoHours: number; unnoticedHours: number }
  recentSpins: EventOf<'spin'>[]
}

export function buildUnderbelly(run: RunState, config: GameConfig): UnderbellyView {
  const B = config.balance
  const s = run.stats
  const metrics = slotMetrics(config.slot)
  const luck = luckReport(s, config)
  const recentSpins = run.log
    .map((e) => e.event)
    .filter((e): e is EventOf<'spin'> => e.type === 'spin')
    .slice(0, config.stats.RECENT_SPINS)
  const left = wagerLeft(run.bonus)
  return {
    slot: {
      rtpDeclared: metrics.rtp,
      hit: metrics.hit,
      ldw: metrics.ldw,
      realWin: metrics.realWin,
      lossLike: metrics.lossLike,
      tickerLossesPerWin: metrics.tickerLossesPerWin,
      expectedLossPerSpin: Math.round(effectiveBet(run, config) * (1 - metrics.rtp))
    },
    casino: {
      spins: stat(s, 'spins'),
      totalWagered: stat(s, 'totalWagered'),
      totalPaidOut: stat(s, 'totalPaidOut'),
      rtpActual: rtpActual(s),
      ...luck,
      winsShowcase: stat(s, 'winsShowcase'),
      winsReal: stat(s, 'winsReal'),
      ldw: stat(s, 'ldw'),
      nearMiss: stat(s, 'nearMiss'),
      deposited: stat(s, 'deposited'),
      withdrawnNet: stat(s, 'withdrawnNet'),
      withdrawFees: stat(s, 'withdrawFees'),
      withdrawable: run.bonus.state === 'active' ? 0 : run.casino,
      casinoNetLive: casinoNetLive(run, config),
      pendingWithdrawals: run.withdrawals.map((w) => ({ ...w }))
    },
    bonus:
      run.bonus.state === 'available' || run.bonus.state === 'declined'
        ? null
        : {
            state: run.bonus.state,
            wagered: run.bonus.wagered,
            wagerReq: run.bonus.wagerReq,
            wagerLeft: left,
            forecast: expectedBonusLeft(run.casino, left, run.bet, config)
          },
    tilt: {
      value: run.tilt,
      stage: tiltStage(run.tilt, B),
      spinEnergyCost: spinEnergyCost(run, B),
      t1: B.TILT_T1,
      t2: B.TILT_T2,
      max: B.TILT_MAX
    },
    debt: {
      total: debtOf(run),
      bank: run.debtBank,
      mfo: run.debtMfo,
      interestTonight: interestTonight(run, B),
      interestPaid: stat(s, 'interestPaid'),
      forcedMfo: stat(s, 'forcedMfo'),
      mfoApr: (1 + B.MFO_RATE_DAY) ** 365 - 1
    },
    items: ITEM_IDS.map((id) => ({
      id,
      status: run.items[id],
      pawnValue: B.PAWN_VALUE[id],
      redeemCost: redeemCost(id, B)
    })),
    casinoNights: { n: run.casinoNights, max: B.CASINO_NIGHTS_FOR_ENDING, lost: stat(s, 'casinoNightLoss') },
    time: casinoHours(s, config),
    recentSpins
  }
}

/** Карточка предложения контакта (contacts-shady §9). */
export interface OfferView {
  offerId: string
  contact: ContactId
  tier: 1 | 2 | 3
  energy: number
  /** Шанс до засвета и с засветом (на карточке; при засвете базовый — зачёркнут рядом). У развода 0. */
  chanceBase: number
  chance: number
  reward: number
  fine: number
  rep: number
  /** Шанс «Сел» при провале; показывать строку ⚠, только если jailRisk (ContactsView). */
  jail: number
  /** Дней до конца срока: 0 «только сегодня», 1 «до завтра», n «ещё n дн.». */
  expiresIn: number
  requiresItem: ItemId | null
  /** Развод: цена (Витрина — обещание claim, Изнанка — honest + «Ожидаемая ценность: −price₽»). */
  scamPrice: number | null
  /** EV₽ по §5 с текущим засветом и брошенной суммой (для Изнанки). */
  ev: number
  /** null — можно; иначе причина серого состояния → formatRejection('work/offer', …). */
  rejection: Rejection | null
}

/** Блок «Контакты» на вкладке «Работа» (contacts-shady §9). null — пакет выключен или ран без контактов. */
export interface ContactsView {
  heat: number
  /** Сколько п.п. засвет режет с шансов: heat × CONTACT_HEAT_PENALTY × 100. */
  heatPenaltyPct: number
  /** «День без дел — минус {decay}». */
  heatDecay: number
  /** Открыт риск ареста (❤️ ≤ −10 или засвет ≥ 60). */
  jailRisk: boolean
  depth: 1 | 2 | 3
  /** «🍀 Удача прокачана» (Витрина) / «🍀 +0%» (Изнанка). */
  fakeLuck: boolean
  offers: OfferView[]
  /** Сгоревшие контакты («{name}: абонент недоступен»). */
  burned: ContactId[]
}

export function buildContacts(run: RunState, config: GameConfig): ContactsView | null {
  const B = config.balance
  const c = run.contacts
  if (!contactsOn(B) || !c) return null
  const offers: OfferView[] = []
  for (const held of c.offers) {
    const def = findOffer(config, held.id)
    if (!def) continue
    offers.push({
      offerId: def.id,
      contact: def.contact,
      tier: def.tier,
      energy: def.energy,
      chanceBase: def.scam ? 0 : def.successChance,
      chance: def.scam ? 0 : pEff(def, c.heat, B),
      reward: held.reward,
      fine: def.fine,
      rep: def.rep,
      jail: def.jail,
      expiresIn: Math.max(0, held.expiresDay - run.day),
      requiresItem: def.requiresItem ?? null,
      scamPrice: def.scam?.price ?? null,
      ev: Math.round(offerEv(def, c.heat, B, held.reward)),
      rejection: run.phase === 'ended' ? { reason: 'wrong_phase' } : offerHandler.check(run, { type: 'work/offer', offerId: def.id }, config)
    })
  }
  return {
    heat: c.heat,
    heatPenaltyPct: Math.round(c.heat * B.CONTACT_HEAT_PENALTY * 1000) / 10,
    heatDecay: B.CONTACT_HEAT_DECAY_QUIET,
    jailRisk: jailRiskOpen(run, B),
    depth: contactDepth(run, config),
    fakeLuck: c.fakeLuckUntil !== undefined && c.fakeLuckUntil >= run.day,
    offers,
    burned: c.burned.slice()
  }
}
