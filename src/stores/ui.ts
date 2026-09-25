import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { GameEvent, HudView, RunPhase } from '@/game'

/**
 * Презентационная задержка результата (ADR-001): исход уже применён и сохранён,
 * но UI показывает «старый» HUD и фазу и прячет новые записи хроники, пока идёт анимация спина.
 */
export interface HeldReveal {
  hud: HudView
  phase: RunPhase
  hiddenLogIds: ReadonlySet<number>
  /** События, презентация которых (тосты, звук) ждёт окончания анимации. */
  events: readonly GameEvent[]
}

/** UI-состояние, которое не попадает в сейв игры. Сюда же лягут очередь тостов, модалки (CD-16/17). */
export const useUiStore = defineStore('ui', () => {
  const held = shallowRef<HeldReveal | null>(null)
  /** Режим «Снять очки» / открыта Изнанка — для учёта underbellySec (systems-spec §3.6). */
  const underbellyOpen = ref(false)

  function hold(value: HeldReveal) {
    held.value = value
  }

  /** Снимает задержку и возвращает отложенные события. */
  function release(): readonly GameEvent[] {
    const events = held.value?.events ?? []
    held.value = null
    return events
  }

  return { held, underbellyOpen, hold, release }
})
