/**
 * Тестовый стенд ядра: сессия «ран + профиль» и выполнение команд так же, как это делает стор
 * (executeCommand → applyProgress). Используется тестами и симуляциями стратегий; в бандл не попадает.
 */
import { defaultConfig, type GameConfig } from './config'
import { applyProgress } from './progress'
import { canExecute, executeCommand } from './reducer'
import { createDefaultProfile } from './save/schema'
import { createRun } from './state'
import type { ActionResult, Command, GameEvent, Profile, RunState } from './types'

export interface Session {
  run: RunState
  profile: Profile
  config: GameConfig
  /** Все события сессии по порядку (для проверок). */
  events: GameEvent[]
  /** false — не вести статистику (быстрые Монте-Карло прогоны). */
  progress: boolean
}

/** Новый ран, уже «проснувшийся» (фаза day дня 1). */
export function newSession(seed: number, config: GameConfig = defaultConfig, progress = true): Session {
  const run = createRun(config, seed, 0)
  const session: Session = { run, profile: createDefaultProfile(), config, events: [], progress }
  record(session, [{ type: 'runStarted', runId: run.id, seed: run.seed }])
  exec(session, { type: 'day/wake' })
  return session
}

function record(session: Session, events: readonly GameEvent[]): void {
  if (session.progress) {
    const next = applyProgress(session.run, session.profile, events, session.config, 0)
    session.run = next.run
    session.profile = next.profile
    session.events.push(...events)
  }
}

/** Выполнить команду как стор: RNG из сейва, затем статистика. */
export function exec(session: Session, cmd: Command): ActionResult {
  const result = executeCommand(session.run, cmd, { config: session.config, now: 0 })
  session.run = result.state
  record(session, result.events)
  return result
}

/** Выполнить, только если команда доступна (без записи отказа в хронику). true — выполнено. */
export function tryExec(session: Session, cmd: Command): boolean {
  if (canExecute(session.run, cmd, session.config)) return false
  return exec(session, cmd).ok
}
