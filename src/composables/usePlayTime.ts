import { onMounted, onUnmounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'

/** Раз в сколько секунд отправлять время в стор (systems-spec §3.6). */
const TICK_SEC = 10
/** Без ввода дольше — игрок отошёл, время не идёт. */
const IDLE_CUTOFF_SEC = 120

/**
 * Учёт активного времени: вкладка видима, окно в фокусе, ввод был не позже 2 минут назад.
 * Время копится и уходит в стор раз в 10 с, а также при скрытии вкладки и уходе со страницы.
 */
export function usePlayTime() {
  const game = useGameStore()
  const ui = useUiStore()
  let lastInput = Date.now()
  let lastTick = Date.now()
  let play = 0
  let underbelly = 0
  let timer: ReturnType<typeof setInterval> | undefined

  const active = () =>
    document.visibilityState === 'visible' && document.hasFocus() && Date.now() - lastInput <= IDLE_CUTOFF_SEC * 1000

  function accumulate() {
    const now = Date.now()
    const sec = Math.max(0, (now - lastTick) / 1000)
    lastTick = now
    if (!active()) return
    play += sec
    if (ui.underbellyOpen) underbelly += sec
  }

  function flush() {
    accumulate()
    if (play >= 1 || underbelly >= 1) {
      game.trackTime(play, underbelly)
      play = 0
      underbelly = 0
    }
  }

  const onInput = () => (lastInput = Date.now())
  const onVisibility = () => flush()

  onMounted(() => {
    timer = setInterval(flush, TICK_SEC * 1000)
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
      window.addEventListener(type, onInput, { passive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', flush)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
      window.removeEventListener(type, onInput)
    }
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('beforeunload', flush)
  })
}
