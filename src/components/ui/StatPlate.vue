<template>
  <div
    class="ui-stat"
    :class="[`ui-stat--${variant}`, { 'ui-stat--rise': rising, 'ui-stat--compact': compact }]"
    role="group"
    :aria-label="groupLabel"
  >
    <span v-if="icon" class="ui-stat__icon" aria-hidden="true">{{ icon }}</span>
    <span v-if="variant === 'paper' && label" class="ui-stat__label" aria-hidden="true">{{ label }}</span>
    <span v-if="variant === 'paper'" class="ui-stat__leader" aria-hidden="true" />
    <span class="ui-stat__value tabular" aria-hidden="true">{{ formatted }}</span>
    <span v-if="locked" class="ui-stat__lock" aria-hidden="true">🔒</span>
    <span
      v-if="progress !== undefined"
      class="ui-stat__progress"
      aria-hidden="true"
      :style="{ '--p': clampedProgress }"
    />
    <span v-if="$slots.default" class="ui-stat__extra"><slot /></span>
  </div>
</template>

<script setup lang="ts">
/**
 * Стат-плашка (art-bible §3.5).
 *  casino — пилюля баланса казино (зелёная, Unbounded), замочек и мини-прогресс вейджера;
 *  wallet — кошелёк (скромнее: казино подсвечивает «свои» деньги);
 *  paper  — строка «Жизни»: подпись … выносные точки … сумма (моно).
 * Count-up 600 мс при изменении value; рост — одна зелёная вспышка обводки,
 * падение — без эффекта (Витрина не показывает потери). В calm — мгновенно.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'

const props = withDefaults(
  defineProps<{
    value: number
    variant?: 'casino' | 'wallet' | 'paper'
    icon?: string
    /** Подпись: видимая в paper, для скринридера — всегда. */
    label?: string
    /** Суффикс единиц: «₽», «⚡», «/100». */
    unit?: string
    locked?: boolean
    /** 0…1 — мини-прогресс (вейджер) под суммой. */
    progress?: number
    animate?: boolean
    compact?: boolean
  }>(),
  {
    variant: 'casino',
    icon: undefined,
    label: undefined,
    unit: '₽',
    locked: false,
    progress: undefined,
    animate: true,
    compact: false
  }
)

const { motionReduced } = useTheme()

const shown = ref(props.value)
const rising = ref(false)
let raf = 0
let riseTimer: ReturnType<typeof setTimeout> | undefined

// Неразрывный пробел U+00A0. Узкий U+202F (§2.2) в Unbounded почти нулевой ширины: «12500₽» не читается.
const NNBSP = '\u00A0'

function formatNumber(n: number): string {
  const sign = n < 0 ? '−' : ''
  const abs = Math.round(Math.abs(n))
  return sign + String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)
}

const formatted = computed(() => formatNumber(shown.value) + (props.unit ? NNBSP + props.unit : ''))
const clampedProgress = computed(() => Math.max(0, Math.min(1, props.progress ?? 0)))
const groupLabel = computed(() => {
  const base = `${props.label ?? ''} ${formatNumber(props.value)} ${props.unit}`.trim()
  return props.locked ? `${base}, заблокировано` : base
})

watch(
  () => props.value,
  (to, from) => {
    cancelAnimationFrame(raf)
    if (to > from) {
      rising.value = false
      requestAnimationFrame(() => (rising.value = true))
      if (riseTimer) clearTimeout(riseTimer)
      riseTimer = setTimeout(() => (rising.value = false), 700)
    }
    if (!props.animate || motionReduced.value) {
      shown.value = to
      return
    }
    const start = performance.now()
    const startValue = shown.value
    const duration = 600
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      shown.value = startValue + (to - startValue) * eased
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  }
)

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (riseTimer) clearTimeout(riseTimer)
})
</script>

<style scoped>
.ui-stat {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  white-space: nowrap;
}
.ui-stat__icon { font-family: var(--font-emoji); line-height: 1; }

/* Пилюля баланса казино */
.ui-stat--casino {
  height: 40px;
  padding: 0 var(--sp-4);
  border-radius: var(--r-pill);
  background: var(--c-win);
  color: var(--c-win-text);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--fs-lg);
  box-shadow: var(--glow-win);
}
/* Кошелёк */
.ui-stat--wallet {
  height: 40px;
  padding: 0 var(--sp-4);
  border-radius: var(--r-pill);
  background: var(--c-panel-2);
  color: var(--c-text);
  box-shadow: inset 0 0 0 1px var(--c-line);
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--fs-md);
}
.ui-stat--compact.ui-stat--casino,
.ui-stat--compact.ui-stat--wallet { height: 36px; padding: 0 var(--sp-3); font-size: .9375rem; }

/* Рост — одна вспышка обводки (opacity псевдоэлемента) */
.ui-stat--casino::after,
.ui-stat--wallet::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  box-shadow: 0 0 0 2px var(--c-win), var(--glow-win);
  opacity: 0;
  pointer-events: none;
}
.ui-stat--rise::after { animation: ui-stat-rise 600ms ease-out 1; }
@keyframes ui-stat-rise {
  0%, 100% { opacity: 0; }
  30% { opacity: 1; }
}

.ui-stat__lock { font-family: var(--font-emoji); font-size: .8em; }
.ui-stat__progress {
  position: absolute;
  left: var(--sp-4);
  right: var(--sp-4);
  bottom: 4px;
  height: 3px;
  border-radius: 2px;
  background: rgb(0 0 0 / .25);
  overflow: hidden;
}
.ui-stat__progress::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--gold-deep);
  transform-origin: left;
  transform: scaleX(var(--p));
}

/* Бумажная строка «Жизни» */
.ui-stat--paper {
  display: flex;
  width: 100%;
  min-height: 28px;
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  color: var(--ink);
}
.ui-stat--paper .ui-stat__label { text-transform: uppercase; }
.ui-stat__leader {
  flex: 1;
  min-width: var(--sp-4);
  align-self: flex-end;
  margin-bottom: .35em;
  border-bottom: 2px dotted var(--ink-muted);
}
.ui-stat--paper .ui-stat__value { font-weight: 700; }
.ui-stat--paper .ui-stat__progress { position: relative; left: auto; right: auto; bottom: auto; flex: none; width: 64px; height: 6px; align-self: center; background: var(--paper-2); box-shadow: inset 0 0 0 1px var(--ink-muted); }
.ui-stat--paper .ui-stat__progress::before { background: var(--ink); }
.ui-stat__extra { font-size: var(--fs-xs); }
</style>
