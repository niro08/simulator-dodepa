import { addTilt, changeRep, forcedPay, needEnergy, needLife, needPhase, proposeEnding, shiftPay, shiftPromos } from '../rules'
import type { CommandOf, GameEvent } from '../types'
import type { CommandHandler } from './types'

/** work/shift — смена (GDD §3.5.5, economy §3): 630…2048₽, повышение каждые 5 смен, 🔥 −10. */
export const shiftHandler: CommandHandler<CommandOf<'work/shift'>> = {
  check: (state, _cmd, config) =>
    needPhase(state, 'day') ?? needLife(state) ?? needEnergy(state, config.balance.SHIFT_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const promosBefore = shiftPromos(draft, B)
    const pay = shiftPay(draft, B)
    draft.energy -= B.SHIFT_ENERGY
    draft.wallet += pay
    draft.today.earned += pay
    draft.shiftsDone += 1
    const promoted = draft.shiftsDone % B.SHIFT_PROMO_EVERY === 0 && promosBefore < B.SHIFT_PROMO_MAX
    events.push({ type: 'shiftWorked', pay, promoted, repPenalty: draft.rep < 0 })
    addTilt(draft, -B.TILT_SHIFT, 'shift', events, B)
    return events
  }
}

/**
 * work/shady — темка (GDD §3.5.6): ❤️ −2 всегда и первым делом; 50% успех 1800–2800₽;
 * провал — штраф (недостача → МФО), 🔥 +10, при ❤️ ≤ −10 — 25% «Сел». Порядок бросков фиксирован.
 */
export const shadyHandler: CommandHandler<CommandOf<'work/shady'>> = {
  check: (state, _cmd, config) =>
    needPhase(state, 'day') ?? needLife(state) ?? needEnergy(state, config.balance.SHADY_ENERGY),
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
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
