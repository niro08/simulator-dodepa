import type { CommandOf } from '../types'
import { needEnergy, type CommandHandler } from './types'
import { applyRewardAction } from './work'

/** friends/borrow — занять у друга (нужна репутация). */
export const borrowHandler: CommandHandler<CommandOf<'friends/borrow'>> = {
  check(state, _cmd, config) {
    const borrow = config.balance.friends.borrow
    return (
      needEnergy(state, borrow.energyCost) ??
      (state.reputation < borrow.minReputation ? { reason: 'noTrust', min: borrow.minReputation } : null)
    )
  },
  apply: (draft, _cmd, ctx) => [
    { type: 'borrow', delta: applyRewardAction(draft, ctx.config.balance.friends.borrow, ctx) }
  ]
}

/** friends/help — помочь другу: энергия → репутация. */
export const helpHandler: CommandHandler<CommandOf<'friends/help'>> = {
  check: (state, _cmd, config) => needEnergy(state, config.balance.friends.help.energyCost),
  apply(draft, _cmd, ctx) {
    const help = ctx.config.balance.friends.help
    draft.energy -= help.energyCost
    draft.reputation += help.reputationDelta
    return [{ type: 'help', delta: { energy: -help.energyCost, reputation: help.reputationDelta } }]
  }
}
