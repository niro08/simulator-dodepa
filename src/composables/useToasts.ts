import { computed, ref } from 'vue'

/**
 * Очередь тостов (ux-flows «T»): виден один, остальные ждут, пометка «+N».
 * Не модальные, фокус не забирают. Показ спина ждёт revealPending (стор сам зовёт onPresent после анимации).
 */
export interface ToastItem {
  id: number
  kind: 'achievement' | 'system' | 'error'
  title?: string
  name: string
  subtitle?: string
  icon?: string
  /** Строка-чип награды: «🎨 Открыт скин: Клоунский». */
  reward?: string
  /** Кнопка-действие на тосте (ачивка с косметикой → Гардероб). */
  action?: 'wardrobe'
}

/** Сколько тостов держим в очереди; ачивки не выбрасываем никогда. */
const MAX_QUEUE = 6

const queue = ref<ToastItem[]>([])
let nextId = 1

export function useToasts() {
  const current = computed(() => queue.value[0] ?? null)
  const waiting = computed(() => Math.max(0, queue.value.length - 1))

  function push(toast: Omit<ToastItem, 'id'>) {
    // Одинаковые подряд не копим (например, повторный отказ одной кнопки)
    const last = queue.value[queue.value.length - 1]
    if (last && last.name === toast.name && last.kind === toast.kind) return
    const next = [...queue.value, { ...toast, id: nextId++ }]
    // Переполнение: выбрасываем самые старые системные/ошибки (кроме видимого), ачивки ждут своей очереди
    while (next.length > MAX_QUEUE) {
      const drop = next.findIndex((t, i) => i > 0 && t.kind !== 'achievement')
      if (drop < 0) break
      next.splice(drop, 1)
    }
    queue.value = next
  }

  function dismiss() {
    queue.value = queue.value.slice(1)
  }

  function clear() {
    queue.value = []
  }

  return { current, waiting, push, dismiss, clear }
}
