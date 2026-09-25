import type { GameEvent, RunState } from './types'

/** Какие события попадают в хронику: шум (ставка, дельты тильта, мета-время) — нет. */
export function isLoggable(event: GameEvent): boolean {
  return event.type !== 'betChanged' && event.type !== 'tiltChanged' && event.type !== 'timeTracked'
}

/** Добавляет события в начало хроники с новыми id, обрезая до limit. Не мутирует state. */
export function appendLog(state: RunState, events: readonly GameEvent[], now: number, limit: number): RunState {
  const loggable = events.filter(isLoggable)
  if (loggable.length === 0) return state

  let nextLogId = state.nextLogId
  const entries = loggable.map((event) => ({ id: nextLogId++, t: now, event }))
  return {
    ...state,
    nextLogId,
    log: [...entries.reverse(), ...state.log].slice(0, limit)
  }
}
