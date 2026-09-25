import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { GameEvent, Resources } from '@/game'

/**
 * Презентационная задержка результата (ADR-001): исход уже применён и сохранён,
 * но UI показывает «старые» ресурсы и прячет новые записи хроники, пока идёт анимация.
 */
export interface HeldReveal {
  resources: Resources
  hiddenLogIds: ReadonlySet<number>
  /** События, презентация которых (тосты, звук) ждёт окончания анимации. */
  events: readonly GameEvent[]
}

/** UI-состояние, которое не попадает в сейв игры. Сюда же лягут очередь тостов, модалки (TD-12+). */
export const useUiStore = defineStore('ui', () => {
  const held = shallowRef<HeldReveal | null>(null)

  function hold(value: HeldReveal) {
    held.value = value
  }

  /** Снимает задержку и возвращает отложенные события. */
  function release(): readonly GameEvent[] {
    const events = held.value?.events ?? []
    held.value = null
    return events
  }

  return { held, hold, release }
})
