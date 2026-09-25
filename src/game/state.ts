import type { GameConfig } from './config'
import { appendLog } from './log'
import type { RunState } from './types'

/** Новый забег со стартовыми значениями из конфига и записью «runStarted» в хронике. */
export function createRun(config: GameConfig, seed: number, now: number): RunState {
  const run: RunState = {
    id: `run-${now.toString(36)}-${(seed >>> 0).toString(36)}`,
    startedAt: now,
    ...config.balance.start,
    rngState: seed >>> 0,
    flags: {},
    stats: {},
    log: [],
    nextLogId: 1
  }
  return appendLog(run, [{ type: 'runStarted' }], now, config.balance.limits.logLimit)
}

/** Копия забега, которую обработчик команды может мутировать. */
export function cloneRun(state: RunState): RunState {
  return {
    ...state,
    flags: { ...state.flags },
    stats: { ...state.stats },
    log: state.log.slice()
  }
}
