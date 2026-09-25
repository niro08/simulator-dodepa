import {
  applySleepEventOption,
  endDay,
  findSleepEvent,
  finishMorning,
  openFork,
  optionRejection,
  runNight,
  wake
} from '../day'
import {
  addTilt,
  billDueToday,
  billTotal,
  debtOf,
  endlessBillFixed,
  forkBillToday,
  isForkOpen,
  needPhase,
  nextUnpaidBill,
  proposeEnding,
  repayCore,
  weekOf
} from '../rules'
import type { GameConfig } from '../config'
import type { CommandOf, GameEvent, Rejection, RunState } from '../types'
import type { CommandHandler } from './types'

/** day/wake — утро M1–M8 (с экрана «Итог дня» или в начале рана). */
export const wakeHandler: CommandHandler<CommandOf<'day/wake'>> = {
  check: (state) => needPhase(state, 'morning', 'daySummary'),
  apply(draft, _cmd, ctx) {
    const events: GameEvent[] = []
    wake(draft, ctx, events)
    return events
  }
}

/** day/sleep — «Лечь спать»: счёт → bills, развилка → fork, иначе ночь N1–N9 одной транзакцией. */
export const sleepHandler: CommandHandler<CommandOf<'day/sleep'>> = {
  check: (state) => needPhase(state, 'day'),
  apply(draft, _cmd, ctx) {
    const events: GameEvent[] = []
    endDay(draft, ctx, events, false)
    return events
  }
}

/** day/resume — «Назад» из экрана счёта/развилки (нельзя, если день закончен тильтом 100). */
export const resumeHandler: CommandHandler<CommandOf<'day/resume'>> = {
  check: (state) => needPhase(state, 'bills', 'fork') ?? (state.forcedEnd ? { reason: 'forced' } : null),
  apply(draft) {
    draft.phase = 'day'
    return []
  }
}

/** event/choose — выбор варианта карточки сна (система — day.ts; контент CD-12 — content/events.ts). */
export const chooseEventHandler: CommandHandler<CommandOf<'event/choose'>> = {
  check(state, cmd, config) {
    const phase = needPhase(state, 'event')
    if (phase) return phase
    const def = state.pendingEventId ? findSleepEvent(config, state.pendingEventId) : undefined
    if (!def) return { reason: 'no_event' }
    const option = def.options[cmd.option]
    if (!option) return { reason: 'invalid_amount' }
    return optionRejection(state, option, config)
  },
  apply(draft, cmd, ctx) {
    const events: GameEvent[] = []
    const eventId = draft.pendingEventId ?? ''
    const option = findSleepEvent(ctx.config, eventId)?.options[cmd.option]
    const outcome = option ? applySleepEventOption(draft, option, ctx, events, eventId) : {}
    draft.pendingEventId = null
    events.unshift({ type: 'sleepEventResolved', eventId, choice: cmd.option, ...outcome })
    finishMorning(draft, ctx, events)
    return events
  }
}

/** Проверка оплаты счёта (общая для «Жизни» и экрана bills). */
export function checkBillPay(state: RunState, config: GameConfig): Rejection | null {
  const phase = needPhase(state, 'day', 'bills')
  if (phase) return phase
  const bill = billDueToday(state)
  if (!bill) {
    const next = nextUnpaidBill(state)
    return next ? { reason: 'not_due', min: next.dueDay - state.day } : { reason: 'no_bill' }
  }
  const total = billTotal(state, bill, config.balance)
  return state.wallet < total ? { reason: 'no_money', min: total } : null
}

/**
 * bills/pay — оплата счёта только в день счёта, целиком, из кошелька (GDD §3.6).
 * Долговая часть гасит долг (МФО → банк) и идёт в ❤️-прогресс.
 */
export const payBillHandler: CommandHandler<CommandOf<'bills/pay'>> = {
  check: (state, _cmd, config) => checkBillPay(state, config),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const bill = billDueToday(draft)
    if (!bill) return events
    const total = billTotal(draft, bill, B)
    const debtPart = total - bill.fixed
    const late = bill.status === 'deferred'
    draft.wallet -= total
    bill.status = 'paid'
    events.push({ type: 'billPaid', week: bill.week, amount: total, late, debtPart })
    if (debtPart > 0) {
      const sideEvents: GameEvent[] = []
      const repGain = repayCore(draft, debtPart, sideEvents, B)
      events.push({ type: 'debtRepaid', amount: debtPart, repGain, debtLeft: debtOf(draft), viaBill: true }, ...sideEvents)
    }
    // С экрана счёта день продолжается к развилке или ночи
    if (draft.phase === 'bills') {
      if (isForkOpen(draft)) openFork(draft, ctx, events, draft.forcedEnd)
      else runNight(draft, ctx, events)
    }
    return events
  }
}

/** bills/defer — отсрочка на завтра, +50% к фиксу, одна на ран; 🔥 +15. */
export const deferBillHandler: CommandHandler<CommandOf<'bills/defer'>> = {
  check(state, _cmd, config) {
    const phase = needPhase(state, 'bills')
    if (phase) return phase
    if (!billDueToday(state)) return { reason: 'no_bill' }
    return state.graceUsed || config.balance.GRACE_PER_RUN <= 0 ? { reason: 'grace_used' } : null
  },
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const bill = billDueToday(draft)
    if (!bill) return events
    const fixed = Math.ceil(bill.fixed * (1 + B.GRACE_PENALTY))
    const penalty = fixed - bill.fixed
    draft.graceUsed = true
    bill.fixed = fixed
    bill.dueDay += 1
    bill.status = 'deferred'
    events.push({ type: 'billDeferred', week: bill.week, penalty, fixed, dueDay: bill.dueDay })
    addTilt(draft, B.TILT_BILL_DEFERRED, 'bill_deferred', events, B)
    runNight(draft, ctx, events)
    return events
  }
}

/** bills/refuse — «Не платить»: концовка «Коллекторы». */
export const refuseBillHandler: CommandHandler<CommandOf<'bills/refuse'>> = {
  check: (state) => needPhase(state, 'bills'),
  apply(draft) {
    proposeEnding(draft, 'collectors')
    return []
  }
}

/** Проверка «ЗАВЯЗАТЬ»: день развилки, счёт оплачен, долг 0 (GDD §3.7). */
export function checkQuit(state: RunState): Rejection | null {
  const phase = needPhase(state, 'day', 'fork')
  if (phase) return phase
  const bill = forkBillToday(state)
  if (!bill) return { reason: 'not_fork_day' }
  if (bill.status !== 'paid') return { reason: 'bill_unpaid' }
  const debt = debtOf(state)
  return debt > 0 ? { reason: 'has_debt', min: debt } : null
}

/** run/quit — «ЗАВЯЗАТЬ»: единственная победа. Оценка A/B/C — finishRun. */
export const quitHandler: CommandHandler<CommandOf<'run/quit'>> = {
  check: (state) => checkQuit(state),
  apply(draft) {
    proposeEnding(draft, 'quit')
    return [{ type: 'weekChoice', choice: 'quit', week: weekOf(draft.day) }]
  }
}

/**
 * run/extend — «ЕЩЁ НЕДЕЛЮ»: счёт следующей недели ×1.35 создаётся сразу (день развилки — его dueDay),
 * 🔥 +10, дальше обычная ночь. Статистика рана не сбрасывается.
 */
export const extendHandler: CommandHandler<CommandOf<'run/extend'>> = {
  check(state, _cmd, config) {
    const phase = needPhase(state, 'fork')
    if (phase) return phase
    if (!config.balance.FEATURE_ENDLESS) return { reason: 'feature_disabled' }
    return isForkOpen(state) ? null : { reason: 'bill_unpaid' }
  },
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    draft.endless = true
    draft.extraWeeks += 1
    const week = Math.max(...draft.bills.map((b) => b.week)) + 1
    const bill = { week, dueDay: 7 * week, fixed: endlessBillFixed(week, B), status: 'upcoming' as const }
    draft.bills.push(bill)
    events.push({ type: 'weekChoice', choice: 'one_more_week', week: weekOf(draft.day) })
    events.push({ type: 'billCreated', week, dueDay: bill.dueDay, fixed: bill.fixed })
    addTilt(draft, B.TILT_ONE_MORE_WEEK, 'one_more_week', events, B)
    runNight(draft, ctx, events)
    return events
  }
}
