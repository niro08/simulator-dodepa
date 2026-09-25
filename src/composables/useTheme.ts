import { computed, readonly, ref, watch, type ComputedRef, type Ref } from 'vue'

/**
 * Хелпер визуального режима (art-bible §1.3, §2.6).
 *
 * Пишет на <html>:
 *   data-theme="neon|monday|mirror47|stream"  — тема Витрины;
 *   data-layer="vitrina|iznanka"               — слой «Снять очки»;
 *   class="calm"                                — «Меньше мигания».
 *
 * Тема — надетая косметика (CD-19): единый источник — `store.cosmetics.equipped.theme` (сейв, профиль);
 * App.vue зеркалит её сюда через setTheme. Менять тему — только `store.equip('theme:…')`.
 * calm сохраняется в localStorage (ключ `dodepa.ui`), слой — нет: это состояние рана.
 * Если calm ни разу не выбирался, он следует `prefers-reduced-motion` (CD-21).
 * Состояние — модульный синглтон: все вызовы useTheme() видят одно и то же.
 */

export const THEMES = ['neon', 'monday', 'mirror47', 'stream'] as const
export type ThemeId = (typeof THEMES)[number]
export type LayerId = 'vitrina' | 'iznanka'

export const THEME_LABELS: Record<ThemeId, string> = {
  neon: 'Неон',
  monday: 'Утро понедельника',
  mirror47: 'Зеркало №47',
  stream: 'Стрим-оверлей'
}

const STORAGE_KEY = 'dodepa.ui'

interface StoredUi {
  calm?: boolean
}

function isTheme(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

function readStored(): StoredUi {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const obj = parsed as Record<string, unknown>
    return { calm: typeof obj.calm === 'boolean' ? obj.calm : undefined }
  } catch {
    return {}
  }
}

function writeStored(value: StoredUi): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* приватный режим / квота / запрет хранилища — выбор просто не запомнится */
  }
}

function matchReducedMotion(): MediaQueryList | null {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
  } catch {
    return null
  }
}

const theme = ref<ThemeId>('neon')
const layer = ref<LayerId>('vitrina')
/** null — пользователь не выбирал, следуем системной настройке. */
const calmChoice = ref<boolean | null>(null)
const prefersReducedMotion = ref(false)

const calm = computed(() => calmChoice.value ?? prefersReducedMotion.value)
/** true, если движение нужно гасить: calm или системный reduced-motion. */
const motionReduced = computed(() => calm.value || prefersReducedMotion.value)

let initialized = false

function applyToDocument(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme.value
  root.dataset.layer = layer.value
  root.classList.toggle('calm', calm.value)
}

function init(): void {
  if (initialized) return
  initialized = true

  const stored = readStored()
  if (stored.calm !== undefined) calmChoice.value = stored.calm

  const mq = matchReducedMotion()
  if (mq) {
    prefersReducedMotion.value = mq.matches
    const onChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion.value = event.matches
    }
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange)
  }

  watch([theme, layer, calm], applyToDocument, { immediate: true })
  watch(calmChoice, () => {
    const value: StoredUi = {}
    if (calmChoice.value !== null) value.calm = calmChoice.value
    writeStored(value)
  })
}

export interface UseTheme {
  theme: Readonly<Ref<ThemeId>>
  layer: Readonly<Ref<LayerId>>
  calm: ComputedRef<boolean>
  prefersReducedMotion: Readonly<Ref<boolean>>
  motionReduced: ComputedRef<boolean>
  isIznanka: ComputedRef<boolean>
  /** Зеркало экипировки из стора (App.vue). UI не зовёт напрямую: тема меняется через store.equip. */
  setTheme: (id: ThemeId) => void
  setLayer: (id: LayerId) => void
  toggleLayer: () => void
  /** true/false — явный выбор; null — вернуть «как в системе». */
  setCalm: (value: boolean | null) => void
  toggleCalm: () => void
}

const isIznanka = computed(() => layer.value === 'iznanka')

export function useTheme(): UseTheme {
  init()
  return {
    theme: readonly(theme),
    layer: readonly(layer),
    calm,
    prefersReducedMotion: readonly(prefersReducedMotion),
    motionReduced,
    isIznanka,
    setTheme: (id) => {
      if (isTheme(id)) theme.value = id
    },
    setLayer: (id) => {
      layer.value = id
    },
    toggleLayer: () => {
      layer.value = layer.value === 'iznanka' ? 'vitrina' : 'iznanka'
    },
    setCalm: (value) => {
      calmChoice.value = value
    },
    toggleCalm: () => {
      calmChoice.value = !calm.value
    }
  }
}
