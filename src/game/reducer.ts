import { handlerFor } from './commands'
import type { GameConfig } from './config'
import { applyInvariants } from './invariants'
import { appendLog } from './log'
import { createRng } from './rng'
import { cloneRun } from './state'
import type { ActionResult, Command, GameContext, GameEvent, Rejection, RunState } from './types'

/** Можно ли выполнить команду: null или причина отказа. Та же функция, что использует dispatch. */
export function canExecute(state: RunState, cmd: Command, config: GameConfig): Rejection | null {
  return handlerFor(cmd).check(state, cmd, config)
}

/**
 * Единственная точка изменения забега (ADR-002).
 * Отказ: ресурсы не меняются, в хронику пишется событие `rejected`, ok = false.
 * Успех: обработчик меняет копию, затем applyInvariants и запись событий в хронику.
 * Исходный state не мутируется.
 */
export function dispatch(state: RunState, cmd: Command, ctx: GameContext): ActionResult {
  const logLimit = ctx.config.balance.limits.logLimit
  const rejection = canExecute(state, cmd, ctx.config)
  if (rejection) {
    const events: GameEvent[] = [{ type: 'rejected', command: cmd.type, ...rejection }]
    return { ok: false, state: appendLog(state, events, ctx.now, logLimit), events }
  }

  const draft = cloneRun(state)
  const events = handlerFor(cmd).apply(draft, cmd, ctx)
  const next = appendLog(applyInvariants(draft, ctx.config), events, ctx.now, logLimit)
  return { ok: true, state: next, events }
}

/**
 * dispatch с RNG, восстановленным из state.rngState, и записью нового состояния RNG обратно.
 * Так исход следующего действия не зависит от перезагрузки страницы. Используется стором.
 */
export function executeCommand(
  state: RunState,
  cmd: Command,
  env: { config: GameConfig; now: number }
): ActionResult {
  const rng = createRng(state.rngState)
  const result = dispatch(state, cmd, { rng, config: env.config, now: env.now })
  return { ...result, state: { ...result.state, rngState: rng.state() } }
}
