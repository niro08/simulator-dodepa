import type { RewardActionConfig } from '../config'
import { calculateReward } from '../reward'
import type { CommandOf, GameContext, ResourceDelta, RunState } from '../types'
import { needEnergy, type CommandHandler } from './types'

/** Общая логика «потратить энергию → получить награду → изменить репутацию». */
export function applyRewardAction(draft: RunState, action: RewardActionConfig, ctx: GameContext): ResourceDelta {
  const amount = calculateReward(action.baseReward, draft.reputation, ctx.config.balance.reward, ctx.rng)
  draft.money += amount
  draft.energy -= action.energyCost
  draft.reputation += action.reputationDelta
  return { money: amount, energy: -action.energyCost, reputation: action.reputationDelta }
}

/** work/job — честная подработка. */
export const jobHandler: CommandHandler<CommandOf<'work/job'>> = {
  check: (state, _cmd, config) => needEnergy(state, config.balance.work.job.energyCost),
  apply: (draft, _cmd, ctx) => [{ type: 'job', delta: applyRewardAction(draft, ctx.config.balance.work.job, ctx) }]
}

/** work/shady — «замутить темку». */
export const shadyHandler: CommandHandler<CommandOf<'work/shady'>> = {
  check: (state, _cmd, config) => needEnergy(state, config.balance.work.shady.energyCost),
  apply: (draft, _cmd, ctx) => [{ type: 'shady', delta: applyRewardAction(draft, ctx.config.balance.work.shady, ctx) }]
}
