/**
 * Публичный API чистого ядра игры. Правила слоя (architecture.md §1):
 * без vue/pinia/platform/components, без window/localStorage/Math.random.
 */
export * from './types'
export * from './config'
export { createRng, type Rng } from './rng'
export { canExecute, dispatch, executeCommand } from './reducer'
export { createRun } from './state'
export { applyInvariants } from './invariants'
export { calculateReward, rewardRange, guaranteedShare } from './reward'
export { planRepay, minRepayAmount, isRejection, type RepayPlan } from './commands/bank'
export { applyProgress } from './progress'
