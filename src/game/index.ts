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
export {
  billTotal,
  debtOf,
  ENDING_IDS,
  ENDING_PRIORITY,
  friendAmount,
  quitGrade,
  redeemCost,
  shiftPay,
  spinEnergyCost,
  tiltStage,
  weekOf
} from './rules'
export { planRepay, minRepayAmount, isRejection, type RepayPlan } from './commands/bank'
export { resolveSpin, effectiveBet, betCap } from './commands/slot'
export { wagerLeft } from './commands/casino'
export { expectedBonusLeft, type BonusForecast } from './bonus'
export { applyProgress, abandonRun } from './progress'
export { reduceStats, stat, STAT_KEYS, type StatKey } from './stats'
export {
  buildStatement,
  casinoNetFinal,
  casinoNetLive,
  equivalents,
  luckReport,
  rtpActual,
  type Statement
} from './statement'
export {
  buildHud,
  buildPendingEvent,
  buildUnderbelly,
  type BillView,
  type HudView,
  type PendingEventView,
  type UnderbellyView
} from './view'
export { LIFE_EVENTS } from './content/events'
