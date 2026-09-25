import { isItemId, needPhase, ownedItems, redeemCost } from '../rules'
import type { CommandOf } from '../types'
import type { CommandHandler } from './types'

/** pawn/pawn — заложить вещь (GDD §3.5.9): +залог в кошелёк, 0⚡. */
export const pawnHandler: CommandHandler<CommandOf<'pawn/pawn'>> = {
  check: (state, cmd) =>
    needPhase(state, 'day') ?? (isItemId(cmd.item) && state.items[cmd.item] === 'owned' ? null : { reason: 'item_not_owned' }),
  apply(draft, cmd, ctx) {
    const amount = ctx.config.balance.PAWN_VALUE[cmd.item]
    draft.items[cmd.item] = 'pawned'
    draft.eventState.pawnedOn[cmd.item] = draft.day
    draft.wallet += amount
    return [{ type: 'itemPawned', itemId: cmd.item, amount, ownedLeft: ownedItems(draft).length }]
  }
}

/** pawn/redeem — выкуп за 130%, в любой момент рана (проданное насовсем выкупить нельзя). */
export const redeemHandler: CommandHandler<CommandOf<'pawn/redeem'>> = {
  check(state, cmd, config) {
    const phase = needPhase(state, 'day')
    if (phase) return phase
    if (!isItemId(cmd.item) || state.items[cmd.item] !== 'pawned') return { reason: 'item_not_pawned' }
    const cost = redeemCost(cmd.item, config.balance)
    return state.wallet < cost ? { reason: 'no_money', min: cost } : null
  },
  apply(draft, cmd, ctx) {
    const B = ctx.config.balance
    const cost = redeemCost(cmd.item, B)
    draft.wallet -= cost
    draft.items[cmd.item] = 'owned'
    delete draft.eventState.pawnedOn[cmd.item]
    return [{ type: 'itemRedeemed', itemId: cmd.item, cost, pawnAmount: B.PAWN_VALUE[cmd.item] }]
  }
}
