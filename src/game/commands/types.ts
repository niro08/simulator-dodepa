import type { GameConfig } from '../config'
import type { Command, GameContext, GameEvent, Rejection, RunState } from '../types'

/**
 * Обработчик команды. Чистый: без Vue, DOM, localStorage и Math.random.
 * - check: доступна ли команда (одна функция и для ядра, и для disabled/подсказок в UI);
 * - apply: вызывается только если check вернул null; мутирует draft (копию состояния)
 *   и возвращает доменные события. Инварианты и хронику применяет dispatch.
 */
export interface CommandHandler<C extends Command> {
  check(state: RunState, cmd: C, config: GameConfig): Rejection | null
  apply(draft: RunState, cmd: C, ctx: GameContext): GameEvent[]
}

/** Общая проверка «хватает ли энергии». */
export function needEnergy(state: RunState, cost: number): Rejection | null {
  return state.energy < cost ? { reason: 'noEnergy', min: cost } : null
}
