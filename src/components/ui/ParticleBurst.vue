<template>
  <div v-if="active" :key="burstKey" class="fx-particles" aria-hidden="true">
    <span
      v-for="p in particles"
      :key="p.id"
      class="fx-particle"
      :class="{ 'fx-particle--confetti': p.confetti }"
      :style="p.style"
    >{{ p.glyph }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Частицы на CSS (art-bible §5 #10, #19): монетный взрыв, конфетти, семечки.
 * ≤ 30 частиц, только transform/opacity, разлёт по дуге + «гравитация».
 * Кладётся внутрь position: relative-контейнера. Повтор — сменить burstKey.
 * В .calm и prefers-reduced-motion скрыт целиком (vfx.css) — смысл несёт плашка суммы.
 * Разброс детерминирован (хэш индекса + burstKey): без Math.random, одинаков на всех машинах.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

export type ParticleVariant = 'coins' | 'confetti' | 'seeds' | 'receipts'

const MAX_PARTICLES = 30

const props = withDefaults(
  defineProps<{
    variant?: ParticleVariant
    count?: number
    /** Смена значения перезапускает эффект; 0/пусто — эффект не показан. */
    burstKey?: number
    /** Длительность, мс (по §5 — 900). */
    duration?: number
    /** Точка вылета в % контейнера. */
    originX?: number
    originY?: number
    /** Масштаб разлёта (px по горизонтали на край). */
    spread?: number
    /** Свой набор эмодзи вместо стандартного. */
    glyphs?: readonly string[]
  }>(),
  {
    variant: 'coins',
    count: 24,
    burstKey: 0,
    duration: 900,
    originX: 50,
    originY: 50,
    spread: 180,
    glyphs: undefined
  }
)

const emit = defineEmits<{ done: [] }>()

const GLYPHS: Record<ParticleVariant, readonly string[]> = {
  coins: ['🪙', '💰', '🪙', '🪙'],
  confetti: [''],
  seeds: ['🌻', '🍂'],
  receipts: ['🧾']
}
const CONFETTI_COLORS = ['var(--neon-magenta)', 'var(--neon-cyan)', 'var(--gold)', 'var(--neon-green)', '#FFFFFF']

function hash(n: number): number {
  let x = (n + 0x9e3779b9) | 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const active = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const particles = computed(() => {
  const n = Math.max(0, Math.min(MAX_PARTICLES, Math.round(props.count)))
  const glyphs = props.glyphs && props.glyphs.length > 0 ? props.glyphs : GLYPHS[props.variant]
  const confetti = props.variant === 'confetti' && !props.glyphs
  const seed = props.burstKey * 131
  return Array.from({ length: n }, (_, i) => {
    const r1 = hash(seed + i * 7 + 1)
    const r2 = hash(seed + i * 7 + 2)
    const r3 = hash(seed + i * 7 + 3)
    const r4 = hash(seed + i * 7 + 4)
    // Равномерно по дуге: от −1 до 1, с дрожанием
    const t = n > 1 ? (i / (n - 1)) * 2 - 1 : 0
    const dx = (t + (r1 - 0.5) * 0.35) * props.spread
    const dy = -(60 + r2 * 110)
    const fall = 120 + r3 * 90
    const rot = (r4 - 0.5) * 720
    const style: Record<string, string> = {
      '--x0': `${props.originX}%`,
      '--y0': `${props.originY}%`,
      '--dx': `${dx.toFixed(1)}px`,
      '--dy': `${dy.toFixed(1)}px`,
      '--fall': `${fall.toFixed(1)}px`,
      '--rot': `${rot.toFixed(0)}deg`,
      '--delay': `${Math.round(r3 * 120)}ms`,
      '--dur': `${props.duration}ms`,
      '--size': `${Math.round(18 + r2 * 12)}px`
    }
    if (confetti) style['--color'] = CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? 'var(--gold)'
    return {
      id: i,
      confetti,
      glyph: confetti ? '' : (glyphs[i % glyphs.length] ?? '🪙'),
      style
    }
  })
})

watch(
  () => props.burstKey,
  (key) => {
    if (timer) clearTimeout(timer)
    if (!key) {
      active.value = false
      return
    }
    active.value = true
    timer = setTimeout(() => {
      active.value = false
      emit('done')
    }, props.duration + 200)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>
