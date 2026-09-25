/**
 * Структура дня (design/gdd-run-structure.md §3.4): Сон N1–N9, Утро M1–M8, конец дня → счёт / развилка / ночь.
 * Всё здесь вызывается внутри dispatch на draft; события пишутся в events, концовки — через proposeEnding.
 */
import type { GameConfig, ItemId } from './config'
import { cashbackAmount, oldestPawned } from './content/events'
import {
  addTilt,
  billDueToday,
  billTotal,
  changeRep,
  checkMfoLoan,
  debtOf,
  forcedPay,
  forkBillToday,
  isForkOpen,
  isMinimalism,
  proposeEnding,
  repayCore,
  setTilt,
  shiftPay,
  weekOf
} from './rules'
import type { Rng } from './rng'
import { lockBonus, pushBonusSettle, recordSpin, resolveSpin } from './spin'
import { freshDayCounters } from './state'
import type { GameEvent, Rejection, RunState, SleepEventDef, SleepEventOption } from './types'

interface DayCtx {
  rng: Rng
  config: GameConfig
}

// ─── Конец дня ──────────────────────────────────────────────────────────────

/**
 * «Лечь спать» или тильт 100 (forced): неоплаченный счёт сегодня → экран bills;
 * день развилки с оплаченным счётом → fork; иначе ночь.
 */
export function endDay(draft: RunState, ctx: DayCtx, events: GameEvent[], forced: boolean): void {
  const B = ctx.config.balance
  const bill = billDueToday(draft)
  if (bill) {
    draft.phase = 'bills'
    draft.forcedEnd = forced
    events.push({ type: 'billsOpened', week: bill.week, total: billTotal(draft, bill, B), forced })
    return
  }
  if (isForkOpen(draft)) {
    openFork(draft, ctx, events, forced)
    return
  }
  runNight(draft, ctx, events)
}

/** Развилка «ЗАВЯЗАТЬ / ЕЩЁ НЕДЕЛЮ» (GDD §3.7). Без режима endless долг на развилке = «Коллекторы». */
export function openFork(draft: RunState, ctx: DayCtx, events: GameEvent[], forced: boolean): void {
  const B = ctx.config.balance
  if (!B.FEATURE_ENDLESS && debtOf(draft) > 0) {
    proposeEnding(draft, 'collectors')
    return
  }
  draft.phase = 'fork'
  draft.forcedEnd = forced
  events.push({ type: 'forkOpened', week: forkBillToday(draft)?.week ?? weekOf(draft.day), debt: debtOf(draft), forced })
}

// ─── Сон N1–N9 ──────────────────────────────────────────────────────────────

/** Ночь — одна атомарная транзакция (GDD §3.4). Выход — фаза daySummary следующего дня или концовка. */
export function runNight(draft: RunState, ctx: DayCtx, events: GameEvent[]): void {
  const B = ctx.config.balance
  const casinoNight = draft.casinoNightPending
  let nightLoss = 0
  let forcedMfo = 0

  // N1. «Ночь в казино»: −20% баланса, счётчик; третья — концовка, ночь прерывается
  if (casinoNight) {
    nightLoss = Math.floor(draft.casino * B.CASINO_NIGHT_LOSS_PCT)
    draft.casino -= nightLoss
    draft.casinoNights += 1
    events.push({ type: 'casinoNight', n: draft.casinoNights, lost: nightLoss })
    if (draft.bonus.state === 'active' && draft.casino < B.MIN_BET) {
      draft.bonus.state = 'lost'
      events.push({
        type: 'bonusBusted',
        balanceLeft: draft.casino,
        wagerLeft: Math.max(0, draft.bonus.wagerReq - draft.bonus.wagered)
      })
    }
    if (draft.casinoNights >= B.CASINO_NIGHTS_FOR_ENDING) proposeEnding(draft, 'casino_nights')
  }
  if (draft.endingId) return

  // N2. Жизнь — обязательное списание
  forcedMfo += forcedPay(draft, B.LIVING_COST, 'living', events)
  events.push({ type: 'livingCostPaid', amount: B.LIVING_COST })

  // N3. Статистика дня (в событии slept ниже)
  const tilt70 = draft.maxTiltToday >= B.TILT_T2

  // N4. Проценты (сложные, ceil); начисляются и на долг, созданный в N2
  const mfo = Math.ceil(draft.debtMfo * (1 + B.MFO_RATE_DAY)) - draft.debtMfo
  const bank = Math.ceil(draft.debtBank * (1 + B.BANK_RATE_DAY)) - draft.debtBank
  draft.debtMfo += mfo
  draft.debtBank += bank
  if (mfo + bank > 0) events.push({ type: 'interestAccrued', bank, mfo, total: mfo + bank, debt: debtOf(draft) })

  // N5. Тильт (до спада запоминаем «тильт при отходе ко сну» — insomnia_spin)
  draft.eventState.bedTilt = draft.tilt
  if (casinoNight) setTilt(draft, B.TILT_AFTER_CASINO_NIGHT, 'casino_night', events, B)
  else setTilt(draft, Math.max(0, draft.tilt - B.TILT_SLEEP_DECAY), 'sleep', events, B)

  // N6. Бросок события сна (в ночь с дня 1 на 2 — нет)
  const eventRolled = rollSleepEvent(draft, ctx)

  // N7. Сброс дневных счётчиков
  const cleanWeek = draft.day % 7 === 0 && draft.spinsThisWeek === 0
  const noSpins = draft.today.spins === 0
  draft.casinoNightPending = false
  draft.familyHelpsToday = 0
  draft.borrowedToday = 0
  draft.maxTiltToday = draft.tilt
  draft.location = 'life'
  draft.forcedEnd = false

  // N8. Итог дня
  draft.daySummary = {
    day: draft.day,
    earned: draft.today.earned,
    casinoWagered: draft.today.wagered,
    casinoPaidOut: draft.today.paidOut,
    casinoNightLoss: nightLoss,
    livingCost: B.LIVING_COST,
    interest: mfo + bank,
    forcedMfo,
    debt: debtOf(draft),
    wallet: draft.wallet,
    casino: draft.casino,
    repDelta: draft.rep - draft.today.startRep,
    tiltDelta: draft.tilt - draft.today.startTilt,
    casinoNight,
    eventRolled
  }
  events.push({ type: 'slept', day: draft.day, casinoNight, tilt70, cleanWeek, noSpins })

  // N9
  draft.day += 1
  draft.phase = 'daySummary'
}

/** Кандидаты пула: условие, «один раз за ран», кулдаун EVENT_COOLDOWN_DAYS. */
export function eligibleSleepEvents(run: RunState, config: GameConfig): SleepEventDef[] {
  const nextDay = run.day + 1
  return config.events.pool.filter((e) => {
    const last = run.eventCooldowns[e.id]
    if (last !== undefined && (e.once || nextDay - last < config.balance.EVENT_COOLDOWN_DAYS)) return false
    return e.when ? e.when(run, config) : true
  })
}

function rollSleepEvent(draft: RunState, ctx: DayCtx): boolean {
  const B = ctx.config.balance
  if (draft.day < 2 || ctx.config.events.pool.length === 0) return false
  if (ctx.rng.next() >= B.EVENT_CHANCE_PER_NIGHT) return false
  const pool = eligibleSleepEvents(draft, ctx.config)
  const total = pool.reduce((sum, e) => sum + e.weight, 0)
  if (total <= 0) return false
  let x = ctx.rng.next() * total
  for (const e of pool) {
    x -= e.weight
    if (x < 0) {
      draft.pendingEventId = e.id
      draft.eventCooldowns[e.id] = draft.day + 1
      return true
    }
  }
  return false
}

// ─── Утро M1–M8 ─────────────────────────────────────────────────────────────

export function wake(draft: RunState, ctx: DayCtx, events: GameEvent[]): void {
  const B = ctx.config.balance

  // M1. Смена недели (счёт «Ещё неделю» создаётся сразу при выборе — run/extend)
  if (draft.day % 7 === 1 && draft.day > 1) {
    draft.friendLoansThisWeek = 0
    draft.spinsThisWeek = 0
    draft.eventState.shiftsThisWeek = 0
    draft.eventState.weekCasinoNet = 0
  }

  // M2. Счёт дня
  for (const bill of draft.bills) {
    if (bill.dueDay === draft.day && bill.status === 'upcoming') bill.status = 'due'
  }

  // M3. Выводы
  draft.withdrawals = draft.withdrawals.filter((w) => {
    if (w.arriveDay > draft.day) return true
    draft.wallet += w.net
    events.push({ type: 'withdrawPaid', net: w.net })
    return false
  })

  // M4. Энергия (не копится)
  draft.energy = Math.min(B.ENERGY_PER_DAY, Math.max(0, B.ENERGY_PER_DAY + draft.energyModNextMorning))
  draft.energyModNextMorning = 0
  draft.withdrewToday = false
  draft.jackpotToday = false
  draft.today = freshDayCounters(draft)
  events.push({ type: 'dayStarted', day: draft.day, week: weekOf(draft.day) })

  // M5. Событие сна
  if (draft.pendingEventId) {
    if (findSleepEvent(ctx.config, draft.pendingEventId)) {
      draft.phase = 'event'
      events.push({ type: 'sleepEventShown', eventId: draft.pendingEventId })
      return
    }
    draft.pendingEventId = null // событие исчезло из пула (старый сейв)
  }
  finishMorning(draft, ctx, events)
}

/** M6–M8: «Минимализм» (после вывода и события), затем день. */
export function finishMorning(draft: RunState, ctx: DayCtx, _events: GameEvent[]): void {
  if (draft.endingId) return
  if (isMinimalism(draft, ctx.config.balance)) {
    proposeEnding(draft, 'minimalism')
    return
  }
  draft.phase = 'day'
}

export function findSleepEvent(config: GameConfig, id: string): SleepEventDef | undefined {
  return config.events.pool.find((e) => e.id === id)
}

/** Стоимость варианта в ₽ сейчас (динамическая: долг Серёге, «не больше долга»). */
export function optionCost(run: RunState, option: SleepEventOption): number {
  const cost = option.cost
  if (cost === undefined) return 0
  if (cost === 'friendDebt') return run.eventState.friendDebt
  if (typeof cost === 'number') return cost
  return Math.min(cost.upToDebt, debtOf(run))
}

/** Почему вариант недоступен (GDD §3.5.11): не хватает ₽ или займ упирается в лимит долга. */
export function optionRejection(run: RunState, option: SleepEventOption, config: GameConfig): Rejection | null {
  const cost = optionCost(run, option)
  if (run.wallet < cost) return { reason: 'option_unaffordable', min: cost }
  if (option.effect.mfoLoan) return checkMfoLoan(run, config.balance)
  return null
}

/** Хватает ли на вариант карточки (GDD §3.5.11: платный вариант недоступен при нехватке). */
export function canAffordOption(run: RunState, option: SleepEventOption, config?: GameConfig): boolean {
  return config ? optionRejection(run, option, config) === null : run.wallet >= optionCost(run, option)
}

/** Прогноз долга к последнему дню рана без погашений (eduard_visit: «вот столько будет к 28-му»). */
export function projectedDebt(run: RunState, config: GameConfig): number {
  const B = config.balance
  const nights = Math.max(0, B.RUN_DAYS - run.day)
  return Math.ceil(run.debtMfo * (1 + B.MFO_RATE_DAY) ** nights + run.debtBank * (1 + B.BANK_RATE_DAY) ** nights)
}

/** Подстановки для текста результата (sleepEventResolved.amount / item). */
export interface OptionOutcome {
  amount?: number
  item?: ItemId
  /** Остаток оборота после зачисления под вейджер. */
  wager?: number
}

/**
 * Эффекты варианта через общий pipeline (GDD §3.8). Порядок: стоимость → деньги → механики → ❤️ → 🔥 → ⚡.
 * Числа механик — ctx.config.events.balance (EVENTS_BALANCE).
 */
export function applySleepEventOption(
  draft: RunState,
  option: SleepEventOption,
  ctx: DayCtx,
  events: GameEvent[],
  eventId = ''
): OptionOutcome {
  const B = ctx.config.balance
  const E = ctx.config.events.balance
  const e = option.effect
  const out: OptionOutcome = {}
  const cost = optionCost(draft, option)
  if (cost > 0) draft.wallet -= cost

  if (e.wallet) {
    if (e.wallet > 0) {
      draft.wallet += e.wallet
      draft.today.earned += e.wallet
    } else forcedPay(draft, -e.wallet, 'event', events)
  }
  if (e.casino) draft.casino = Math.max(0, draft.casino + e.casino)
  if (e.debtMfo && e.debtMfo > 0) {
    draft.debtMfo += e.debtMfo
    events.push({ type: 'forcedMfo', amount: e.debtMfo, reason: 'event' })
  }
  if (e.repayDebt && cost > 0) {
    const sideEvents: GameEvent[] = []
    const repGain = repayCore(draft, cost, sideEvents, B)
    events.push({ type: 'debtRepaid', amount: cost, repGain, debtLeft: debtOf(draft), viaBill: false }, ...sideEvents)
  }
  if (e.costToCasino && cost > 0) {
    draft.casino += cost
    draft.flags.deposited = true
    draft.peakCasino = Math.max(draft.peakCasino, draft.casino)
    events.push({ type: 'deposit', amount: cost })
  }
  if (e.repayFriend) {
    out.amount = cost
    draft.eventState.friendDebt = 0
  }
  if (e.mfoLoan && !checkMfoLoan(draft, B)) {
    draft.wallet += B.MFO_LOAN
    draft.debtMfo += B.MFO_LOAN
    draft.borrowedToday += B.MFO_LOAN
    events.push({ type: 'loanTaken', lender: 'mfo', amount: B.MFO_LOAN })
  }
  if (e.shiftsDone) draft.shiftsDone += e.shiftsDone
  if (e.shiftDeduction) {
    const { amount, shareOfShift, shifts } = e.shiftDeduction
    const each = amount ?? Math.round(shiftPay(draft, B) * (shareOfShift ?? 0))
    for (let i = 0; i < shifts; i++) draft.eventState.shiftDeductions.push(each)
    out.amount = each
  }
  if (e.freespins) {
    // Фриспины: N спинов по фикс. ставке «от казино»; выигрыш — на баланс под вейджер
    let won = 0
    for (let i = 0; i < E.EVT_FREESPINS_COUNT; i++) won += resolveSpin(E.EVT_FREESPINS_BET, ctx.config.slot, ctx.rng).payout
    const wagerRequired = E.EVT_FREESPINS_WAGER * won
    draft.casino += won
    draft.peakCasino = Math.max(draft.peakCasino, draft.casino)
    lockBonus(draft, wagerRequired)
    events.push({ type: 'casinoCredited', source: 'freespins', amount: won, wagerRequired })
    out.amount = won
    out.wager = Math.max(0, draft.bonus.wagerReq - draft.bonus.wagered)
  }
  if (e.cashback) {
    const amount = cashbackAmount(draft, ctx.config)
    const wagerRequired = E.EVT_CASHBACK_WAGER * amount
    draft.casino += amount
    lockBonus(draft, wagerRequired)
    draft.eventState.weekCasinoNet = 0
    events.push({ type: 'casinoCredited', source: 'cashback', amount, wagerRequired })
    out.amount = amount
    out.wager = wagerRequired
  }
  if (e.depositBoost) draft.flags.anzhelika_boost = true
  if (e.autoSpins) out.amount = autoSpins(draft, e.autoSpins, ctx, events)
  if (e.casinoBlockDays) draft.eventState.casinoBlockedUntil = draft.day + e.casinoBlockDays - 1
  if (e.sellPawned) {
    const item = oldestPawned(draft)
    if (item) {
      const amount = Math.floor(B.PAWN_VALUE[item] * E.EVT_PAWN_SELL_BONUS)
      draft.items[item] = 'sold'
      delete draft.eventState.pawnedOn[item]
      draft.wallet += amount
      events.push({ type: 'itemSold', itemId: item, amount })
      out.amount = amount
      out.item = item
    }
  }
  if (e.setFlag) draft.flags[e.setFlag] = true

  if (e.rep) changeRep(draft, e.rep, events, B)
  if (e.tilt) addTilt(draft, e.tilt, 'event', events, B)
  if (e.energyToday) draft.energy = Math.min(B.ENERGY_PER_DAY, Math.max(0, draft.energy + e.energyToday))
  if (e.energyNextMorning) draft.energyModNextMorning += e.energyNextMorning
  if (e.enterCasino && draft.location !== 'casino') {
    draft.location = 'casino'
    events.push({ type: 'casinoEntered' })
  }
  if (eventId === 'eduard_visit' && out.amount === undefined) out.amount = projectedDebt(draft, ctx.config)
  if (eventId === 'pawn_offer' && !out.item) {
    const item = oldestPawned(draft)
    if (item) out.item = item
  }
  return out
}

/**
 * Автосерия спинов (insomnia_spin): по текущей ставке, без ⚡ и тильта за спин (тильт — эффектом карточки).
 * Спины настоящие: те же исходы, статистика, вейджер и «Реферальная». Возвращает итог серии (выплаты − ставки).
 */
function autoSpins(draft: RunState, count: number, ctx: DayCtx, events: GameEvent[]): number {
  const B = ctx.config.balance
  let net = 0
  for (let i = 0; i < count; i++) {
    const cap = draft.bonus.state === 'active' ? Math.min(draft.casino, B.BONUS_MAX_BET) : draft.casino
    const bet = Math.min(Math.max(B.MIN_BET, draft.bet), cap)
    if (bet < B.MIN_BET) break
    const casinoBefore = draft.casino
    const bonusLocked = draft.bonus.state === 'active'
    draft.casino -= bet
    if (bonusLocked) draft.bonus.wagered += bet
    const result = resolveSpin(bet, ctx.config.slot, ctx.rng)
    draft.casino += result.payout
    recordSpin(draft, result)
    net += result.payout - bet
    events.push({
      type: 'spin',
      ...result,
      allIn: bet === casinoBefore,
      energyCost: 0,
      tiltBefore: draft.tilt,
      casinoBefore,
      casinoAfter: draft.casino,
      bonusLocked,
      loseStreak: draft.loseStreak
    })
    pushBonusSettle(draft, B, events)
    if (draft.casino >= B.REFERRAL_CASINO) proposeEnding(draft, 'referral')
  }
  return net
}
