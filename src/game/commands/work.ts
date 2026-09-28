import {
  addTilt,
  changeRep,
  forcedPay,
  halfShiftPay,
  needEnergy,
  needEvening,
  needEveningFeature,
  needLife,
  needPhase,
  needWork,
  overtimePay,
  proposeEnding,
  shiftPay,
  shiftPayNet,
  shiftPromos
} from '../rules'
import type { BalanceV1 } from '../config'
import type { CommandOf, GameEvent, RunState } from '../types'
import type { CommandHandler } from './types'

/** Общая часть смены и переработки: оплата, вычет, счётчики смен, повышение. */
function workShift(draft: RunState, B: BalanceV1, overtime: boolean, events: GameEvent[]): void {
  const promosBefore = shiftPromos(draft, B)
  const gross = overtime ? Math.round(shiftPay(draft, B) * B.OVERTIME_PAY_MULT) : shiftPay(draft, B)
  const pay = overtime ? overtimePay(draft, B) : shiftPayNet(draft, B)
  const deducted = gross - pay
  draft.eventState.shiftDeductions.shift() // вычет карточки сна (аванс / «вишенки на экране») — по одному на смену
  draft.energy -= overtime ? B.OVERTIME_ENERGY : B.SHIFT_ENERGY
  draft.wallet += pay
  draft.today.earned += pay
  draft.today.shifts += 1
  draft.eventState.shiftsThisWeek += 1
  draft.shiftsDone += 1
  const promoted = draft.shiftsDone % B.SHIFT_PROMO_EVERY === 0 && promosBefore < B.SHIFT_PROMO_MAX
  events.push({
    type: 'shiftWorked',
    pay,
    promoted,
    repPenalty: draft.rep < 0,
    ...(deducted > 0 ? { deducted } : {}),
    ...(overtime ? { overtime: true as const } : {})
  })
  addTilt(draft, -(overtime ? B.TILT_OVERTIME : B.TILT_SHIFT), 'shift', events, B)
}

/**
 * work/shift — смена (GDD §3.5.5, economy §3): 630…2048₽, повышение каждые 5 смен, 🔥 −10.
 * При FEATURE_EVENING_FIX — одна работа в день (quick-fix-evening §3.2).
 */
export const shiftHandler: CommandHandler<CommandOf<'work/shift'>> = {
  check: (state, _cmd, config) =>
    needPhase(state, 'day') ??
    needLife(state) ??
    needWork(state, config.balance) ??
    needEnergy(state, config.balance.SHIFT_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    workShift(draft, B, false, events)
    if (B.FEATURE_EVENING_FIX) draft.workToday = 'shift'
    return events
  }
}

/**
 * work/half — полсмены (quick-fix-evening §3.2): 45% оплаты без вычетов, не идёт в смены и повышение, 🔥 −5.
 */
export const halfShiftHandler: CommandHandler<CommandOf<'work/half'>> = {
  check: (state, _cmd, config) =>
    needEveningFeature(config.balance) ??
    needPhase(state, 'day') ??
    needLife(state) ??
    needWork(state, config.balance) ??
    needEnergy(state, config.balance.HALF_SHIFT_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const pay = halfShiftPay(draft, B)
    draft.energy -= B.HALF_SHIFT_ENERGY
    draft.wallet += pay
    draft.today.earned += pay
    draft.workToday = 'half'
    events.push({ type: 'halfShiftWorked', pay })
    addTilt(draft, -B.TILT_HALF_SHIFT, 'shift', events, B)
    return events
  }
}

/**
 * work/overtime — переработка (quick-fix-evening §3.2): смена ×1.25 за 80⚡, занимает и работу, и вечер; 🔥 −5.
 */
export const overtimeHandler: CommandHandler<CommandOf<'work/overtime'>> = {
  check: (state, _cmd, config) =>
    needEveningFeature(config.balance) ??
    needPhase(state, 'day') ??
    needLife(state) ??
    needWork(state, config.balance) ??
    needEvening(state, config.balance) ??
    needEnergy(state, config.balance.OVERTIME_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    workShift(draft, B, true, events)
    draft.workToday = 'overtime'
    draft.eveningUsed = 'overtime'
    return events
  }
}

/**
 * work/shady — темка (GDD §3.5.6): ❤️ −2 всегда и первым делом; 50% успех 1800–2800₽;
 * провал — штраф (недостача → МФО), 🔥 +10, при ❤️ ≤ −10 — 25% «Сел». Порядок бросков фиксирован.
 */
export const shadyHandler: CommandHandler<CommandOf<'work/shady'>> = {
  check: (state, _cmd, config) =>
    needPhase(state, 'day') ??
    needLife(state) ??
    needEvening(state, config.balance) ??
    needEnergy(state, config.balance.SHADY_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    if (B.FEATURE_EVENING_FIX) draft.eveningUsed = 'shady'
    draft.energy -= B.SHADY_ENERGY
    changeRep(draft, B.SHADY_REP, events, B)
    if (ctx.rng.next() < B.SHADY_SUCCESS) {
      const step = B.SHADY_REWARD_STEP
      const amount = step * ctx.rng.int(B.SHADY_REWARD_MIN / step, B.SHADY_REWARD_MAX / step)
      draft.wallet += amount
      draft.today.earned += amount
      events.push({ type: 'schemeResolved', success: true, amount, fine: 0, jailed: false })
      return events
    }
    const jailed = draft.rep <= B.SHADY_JAIL_REP && ctx.rng.next() < B.SHADY_JAIL_CHANCE
    events.push({ type: 'schemeResolved', success: false, amount: 0, fine: B.SHADY_FINE, jailed })
    forcedPay(draft, B.SHADY_FINE, 'shady_fine', events)
    addTilt(draft, B.TILT_SHADY_FAIL, 'scheme_fail', events, B)
    if (jailed) proposeEnding(draft, 'jail')
    return events
  }
}
