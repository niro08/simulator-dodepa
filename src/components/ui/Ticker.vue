<template>
  <section
    class="ui-ticker"
    :class="[`ui-ticker--${variant}`, { 'ui-ticker--static': isStatic, 'ui-ticker--paused': isPaused }]"
    :aria-label="ariaLabel ?? label ?? 'Бегущая строка'"
  >
    <div v-if="label || $slots.label" class="ui-ticker__label">
      <slot name="label">{{ label }}</slot>
    </div>

    <div ref="viewport" class="ui-ticker__viewport">
      <div
        class="ui-ticker__track"
        :class="{ 'ui-ticker__track--reverse': direction === 'right' }"
        :style="trackStyle"
      >
        <ul ref="firstCopy" class="ui-ticker__list">
          <li v-for="item in visibleItems" :key="`a-${item.key}`" class="ui-ticker__item">
            <span class="ui-ticker__text">{{ item.text }}</span>
            <span v-if="item.amount" class="ui-ticker__amount" :class="`ui-ticker__amount--${item.tone}`">{{ item.amount }}</span>
            <span v-if="item.tail" class="ui-ticker__text">{{ item.tail }}</span>
          </li>
        </ul>
        <ul v-if="!isStatic" class="ui-ticker__list" aria-hidden="true">
          <li v-for="item in visibleItems" :key="`b-${item.key}`" class="ui-ticker__item">
            <span class="ui-ticker__text">{{ item.text }}</span>
            <span v-if="item.amount" class="ui-ticker__amount" :class="`ui-ticker__amount--${item.tone}`">{{ item.amount }}</span>
            <span v-if="item.tail" class="ui-ticker__text">{{ item.tail }}</span>
          </li>
        </ul>
      </div>
    </div>

    <button data-ui
      v-if="controls && !isStatic"
      type="button"
      class="ui-ticker__toggle"
      :aria-pressed="isPaused"
      :aria-label="isPaused ? 'Запустить бегущую строку' : 'Остановить бегущую строку'"
      @click="togglePause"
    >
      <span aria-hidden="true">{{ isPaused ? '▶' : '❚❚' }}</span>
    </button>
  </section>
</template>

<script setup lang="ts">
/**
 * Бегущая строка (art-bible §3.3). neon — «Победители», paper — «А тем временем».
 * 50 px/с линейно, бесшовный дубликат, translateX. Пауза: prop paused, hover/focus, кнопка ❚❚.
 * В calm / reduced-motion лента статична и раз в 6 с меняет одну запись без анимации.
 * Пропорцию 1:9 задаёт вызывающий код (данные), компонент её не знает.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'

export interface TickerItem {
  id?: string | number
  /** Текст до суммы: «🏆 АЛ***Й». */
  text: string
  /** Сумма: «+48 000₽». */
  amount?: string
  /** Текст после суммы: «в «ЗОЛОТО ДОДЕПА»». */
  tail?: string
  tone?: 'win' | 'lose' | 'plain'
}

const props = withDefaults(
  defineProps<{
    items: ReadonlyArray<string | TickerItem>
    /** px/с. 0 — статично. */
    speed?: number
    paused?: boolean
    variant?: 'neon' | 'paper'
    direction?: 'left' | 'right'
    label?: string
    ariaLabel?: string
    /** Кнопка паузы (CD-21: у тикера должна быть пауза). */
    controls?: boolean
  }>(),
  {
    speed: 50,
    paused: false,
    variant: 'neon',
    direction: 'left',
    label: undefined,
    ariaLabel: undefined,
    controls: true
  }
)

const emit = defineEmits<{ 'update:paused': [value: boolean] }>()

const { motionReduced } = useTheme()

const userPaused = ref(props.paused)
watch(() => props.paused, (v) => (userPaused.value = v))
const isPaused = computed(() => userPaused.value)
const isStatic = computed(() => motionReduced.value || props.speed <= 0)

function togglePause() {
  userPaused.value = !userPaused.value
  emit('update:paused', userPaused.value)
}

const normalized = computed(() =>
  props.items.map((raw, i) => {
    const item: TickerItem = typeof raw === 'string' ? { text: raw } : raw
    return {
      key: item.id ?? i,
      text: item.text,
      amount: item.amount,
      tail: item.tail,
      tone: item.tone ?? (props.variant === 'paper' ? 'lose' : 'win')
    }
  })
)

/* Статичный режим: раз в 6 с сдвигаем ленту на одну запись */
const offset = ref(0)
let rotateTimer: ReturnType<typeof setInterval> | undefined
watch(
  [isStatic, isPaused],
  ([stat, paused]) => {
    if (rotateTimer) clearInterval(rotateTimer)
    rotateTimer = undefined
    if (stat && !paused) {
      rotateTimer = setInterval(() => {
        const n = normalized.value.length
        offset.value = n > 0 ? (offset.value + 1) % n : 0
      }, 6000)
    }
  },
  { immediate: true }
)

const visibleItems = computed(() => {
  const list = normalized.value
  if (!isStatic.value || list.length === 0) return list
  const k = offset.value % list.length
  return [...list.slice(k), ...list.slice(0, k)]
})

/* Длительность прокрутки = ширина одной копии / скорость */
const firstCopy = ref<HTMLElement | null>(null)
const copyWidth = ref(0)
let ro: ResizeObserver | undefined

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (entry) copyWidth.value = entry.contentRect.width
  })
  if (firstCopy.value) ro.observe(firstCopy.value)
})

onBeforeUnmount(() => {
  ro?.disconnect()
  if (rotateTimer) clearInterval(rotateTimer)
})

const trackStyle = computed(() => {
  if (isStatic.value) return undefined
  const width = copyWidth.value || 1000
  const seconds = Math.max(4, width / Math.max(1, props.speed))
  return { '--ticker-duration': `${seconds.toFixed(2)}s` }
})
</script>

<style scoped>
.ui-ticker {
  position: relative;
  display: flex;
  align-items: stretch;
  width: 100%;
  overflow: hidden;
}
.ui-ticker--neon {
  height: 36px;
  background: var(--c-panel-2);
  box-shadow: inset 0 2px 0 var(--c-accent-2), inset 0 -2px 0 var(--c-accent-2), var(--glow-2);
  color: var(--c-text);
  font-family: var(--font-condensed);
  font-weight: 500;
  font-size: var(--fs-sm);
  text-transform: var(--tt-caps);
  letter-spacing: var(--ls-caps);
}
.ui-ticker--paper {
  height: 28px;
  background: var(--paper-2);
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
@media (max-width: 599px) {
  .ui-ticker--neon { height: 32px; }
  .ui-ticker--paper { height: 24px; }
}

.ui-ticker__label {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: 0 var(--sp-3);
  position: relative;
  z-index: 1;
  white-space: nowrap;
}
.ui-ticker--neon .ui-ticker__label { background: var(--c-panel); color: var(--c-text); }
.ui-ticker--paper .ui-ticker__label { background: var(--paper-2); color: var(--ink); font-weight: 700; }

.ui-ticker__viewport {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
}
.ui-ticker__track {
  display: flex;
  width: max-content;
  height: 100%;
  animation: ui-ticker-scroll var(--ticker-duration, 30s) linear infinite;
  will-change: transform;
}
.ui-ticker__track--reverse { animation-direction: reverse; }
.ui-ticker--paused .ui-ticker__track,
.ui-ticker__viewport:hover .ui-ticker__track,
.ui-ticker:focus-within .ui-ticker__track { animation-play-state: paused; }
.ui-ticker--static .ui-ticker__track { animation: none; }
@keyframes ui-ticker-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.ui-ticker__list {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
}
.ui-ticker__item {
  display: inline-flex;
  align-items: center;
  gap: .4em;
  padding-left: var(--sp-4);
  white-space: nowrap;
}
/* Разделитель после каждой записи — шов между копиями тоже получает «·» */
.ui-ticker__item::after {
  content: '·';
  margin-left: var(--sp-4);
  opacity: .6;
}
.ui-ticker__amount { font-weight: 700; }
.ui-ticker--neon .ui-ticker__amount--win { color: var(--c-win); text-shadow: var(--glow-win); }
.ui-ticker--neon .ui-ticker__amount--lose { color: var(--c-alert-fg); }
.ui-ticker--paper .ui-ticker__amount { color: var(--ink); }

.ui-ticker__toggle {
  flex: none;
  width: var(--tap-min);
  border: 0;
  background: inherit;
  color: inherit;
  font-size: var(--fs-fine);
  cursor: pointer;
  position: relative;
  z-index: 1;
}
.ui-ticker--neon .ui-ticker__toggle { background: var(--c-panel); color: var(--c-text-muted); }
.ui-ticker--paper .ui-ticker__toggle { background: var(--paper-2); color: var(--ink); }
.ui-ticker__toggle:focus-visible { outline: 3px solid var(--c-focus); outline-offset: -3px; }
</style>
