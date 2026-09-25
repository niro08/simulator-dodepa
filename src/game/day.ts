/**
 * Структура дня (design/gdd-run-structure.md §3.4): Сон N1–N9, Утро M1–M8, конец дня → счёт / развилка / ночь.
 * Всё здесь вызывается внутри dispatch на draft; события пишутся в events, концовки — через proposeEnding.
 */
import type { GameConfig } from './config'
import {
  addTilt,
  billDueToday,
  billTotal,
  changeRep,
  debtOf,
  forcedPay,
  forkBillToday,
  isForkOpen,
  isMinimalism,
  proposeEnding,
  setTilt,
  weekOf
} from './rules'
import type { Rng } from './rng'
import { freshDayCounters } from './state'
import type { GameEvent, RunState, SleepEventDef, SleepEventOption } from './types'

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

  // N5. Тильт
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

/** Хватает ли на вариант карточки (GDD §3.5.11: платный вариант недоступен при нехватке). */
export function canAffordOption(run: RunState, option: SleepEventOption): boolean {
  return run.wallet >= (option.cost ?? 0)
}

/** Эффекты варианта через общий pipeline (GDD §3.8). */
export function applySleepEventOption(
  draft: RunState,
  option: SleepEventOption,
  ctx: DayCtx,
  events: GameEvent[]
): void {
  const B = ctx.config.balance
  const e = option.effect
  if (option.cost) draft.wallet -= option.cost
  if (e.wallet) {
    if (e.wallet > 0) draft.wallet += e.wallet
    else forcedPay(draft, -e.wallet, 'event', events)
  }
  if (e.casino) draft.casino = Math.max(0, draft.casino + e.casino)
  if (e.rep) changeRep(draft, e.rep, events, B)
  if (e.tilt) addTilt(draft, e.tilt, 'event', events, B)
  if (e.energyToday) draft.energy = Math.min(B.ENERGY_PER_DAY, Math.max(0, draft.energy + e.energyToday))
  if (e.energyNextMorning) draft.energyModNextMorning += e.energyNextMorning
  if (e.debtMfo && e.debtMfo > 0) {
    draft.debtMfo += e.debtMfo
    events.push({ type: 'forcedMfo', amount: e.debtMfo, reason: 'event' })
  }
}
