import { addTilt, changeRep, friendAmount, needEnergy, needLife, needPhase } from '../rules'
import type { CommandOf, GameEvent } from '../types'
import type { CommandHandler } from './types'

/**
 * friends/borrow — занять у друзей (GDD §3.5.7, economy §3): не долг, цена в ❤️ (−3).
 * Сумма убывает с каждым займом за неделю; при ❤️ ≤ 0 — блокировка навсегда; без телефона — нельзя.
 */
export const borrowHandler: CommandHandler<CommandOf<'friends/borrow'>> = {
  check(state, _cmd, config) {
    const B = config.balance
    return (
      needPhase(state, 'day') ??
      needLife(state) ??
      (state.friendsBlocked ? { reason: 'friends_blocked' } : null) ??
      (state.items.phone !== 'owned' ? { reason: 'no_phone' } : null) ??
      needEnergy(state, B.FRIEND_ENERGY) ??
      (friendAmount(state, B) === 0 ? { reason: 'friends_broke', min: B.FRIEND_MIN_AMOUNT } : null)
    )
  },
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = []
    const amount = friendAmount(draft, B)
    const diminished = draft.friendLoansThisWeek > 0
    draft.energy -= B.FRIEND_ENERGY
    draft.wallet += amount
    draft.eventState.friendDebt += amount
    draft.friendLoansThisWeek += 1
    events.push({ type: 'friendBorrowed', amount, diminished })
    changeRep(draft, B.FRIEND_REP, events, B)
    return events
  }
}

/** family/help — помочь семье: ❤️ +2, 🔥 −15, не чаще раза в день (GDD §3.5, E28). */
export const familyHandler: CommandHandler<CommandOf<'family/help'>> = {
  check(state, _cmd, config) {
    const B = config.balance
    return (
      needPhase(state, 'day') ??
      needLife(state) ??
      (state.familyHelpsToday >= B.FAMILY_HELP_DAILY ? { reason: 'daily_limit', min: B.FAMILY_HELP_DAILY } : null) ??
      needEnergy(state, B.FAMILY_ENERGY)
    )
  },
  apply(draft, _cmd, ctx) {
    const B = ctx.config.balance
    const events: GameEvent[] = [{ type: 'familyHelped' }]
    draft.energy -= B.FAMILY_ENERGY
    draft.familyHelpsToday += 1
    changeRep(draft, B.FAMILY_REP, events, B)
    addTilt(draft, -B.TILT_FAMILY, 'family', events, B)
    return events
  }
}
