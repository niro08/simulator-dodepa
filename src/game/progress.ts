import type { GameConfig } from './config'
import type { GameEvent, Profile, RunState } from './types'

/**
 * Точка расширения мета-прогресса: стор вызывает её после каждой команды с её событиями.
 * Сюда подключаются reduceStats (TD-11) и evaluateAchievements (TD-12) — чистыми функциями,
 * возвращая новые run/profile. Сейчас ничего не меняет.
 */
export function applyProgress(
  run: RunState,
  profile: Profile,
  _events: readonly GameEvent[],
  _config: GameConfig
): { run: RunState; profile: Profile } {
  return { run, profile }
}
