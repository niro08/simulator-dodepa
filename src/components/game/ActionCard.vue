<template>
  <article class="card" :class="[`card--${variant}`, { 'card--off': !!reason }]" :aria-labelledby="titleId">
    <header class="card__head">
      <h3 :id="titleId" class="card__title">{{ title }}</h3>
      <span v-if="cost" class="card__cost">{{ cost }}</span>
    </header>
    <p v-if="shout" class="card__shout">{{ shout }}</p>
    <p v-for="(line, i) in gains" :key="`g${i}`" class="card__gain">{{ line }}</p>
    <p v-for="(line, i) in risks" :key="`r${i}`" class="card__risk">{{ line }}</p>
    <p v-if="note" class="card__note">{{ note }}</p>
    <slot />
    <button
      type="button"
      class="card__btn"
      :class="variant === 'mfo' ? 'card__btn--neon' : 'paper-btn'"
      :aria-disabled="!!reason || busy || undefined"
      :aria-describedby="reason ? reasonId : undefined"
      @click="onClick"
    >
      {{ verb }}
    </button>
    <p v-if="reason" :id="reasonId" class="paper-reason">⚠ {{ reason }}</p>
    <p v-if="fine" class="card__fine">{{ fine }}</p>
    <p v-if="flash" class="card__flash" role="status">{{ flash }}</p>
  </article>
</template>

<script setup lang="ts">
import { useId } from 'vue'

/**
 * Карточка действия «Жизни» (ux-flows S20): цена → эффект → риск → [Глагол] → причина недоступности.
 * Недоступная кнопка остаётся в фокусе (aria-disabled) и объясняет себя.
 * variant 'mfo' — «Витрина внутри Бумаги»: крикливая, но честная сноска того же размера.
 */
const props = withDefaults(
  defineProps<{
    title: string
    verb: string
    cost?: string
    gains?: string[]
    risks?: string[]
    note?: string
    shout?: string
    fine?: string
    reason?: string | null
    flash?: string
    busy?: boolean
    variant?: 'paper' | 'mfo'
  }>(),
  { cost: '', gains: () => [], risks: () => [], note: '', shout: '', fine: '', reason: null, flash: '', busy: false, variant: 'paper' }
)
const emit = defineEmits<{ act: [] }>()

const uid = useId()
const titleId = `act-${uid}`
const reasonId = `act-r-${uid}`

function onClick() {
  if (props.reason || props.busy) return
  emit('act')
}
</script>

<style scoped>
.card {
  position: relative;
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3);
  border: 1px solid var(--ink);
  border-radius: var(--r-paper);
  background: var(--paper-white);
}
.card--off {
  border-style: dashed;
}
.card__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--sp-2);
}
.card__title {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.card__cost {
  flex: none;
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
  white-space: nowrap;
}
.card__gain {
  font-size: var(--fs-sm);
  color: var(--stamp-green);
  font-weight: 700;
}
.card__risk {
  font-size: var(--fs-sm);
  color: var(--stamp-red);
}
.card__note,
.card__fine {
  font-size: var(--fs-xs);
  color: var(--ink-muted);
}
.card__btn {
  margin-top: var(--sp-1);
  justify-self: start;
}
.card__flash {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: var(--sp-1) var(--sp-2);
  background: var(--highlighter);
  color: var(--ink);
}

/* МФО: неон внутри бумаги (пародия), сноска тем же размером */
.card--mfo {
  border: 3px double var(--neon-magenta);
  background: linear-gradient(135deg, #2a0f4d, #170b33);
  color: #fff;
}
.card--mfo .card__title {
  font-family: var(--font-display);
  font-size: var(--fs-xs);
  color: var(--gold-light);
}
.card--mfo .card__shout {
  font-family: var(--font-condensed);
  font-size: var(--fs-md);
  font-weight: 700;
  text-transform: uppercase;
  color: var(--gold);
}
.card--mfo .card__fine,
.card--mfo .card__note {
  font-size: var(--fs-sm);
  color: #fff;
}
.card--mfo .paper-reason {
  color: var(--gold-light);
}
.card__btn--neon {
  min-height: var(--tap-min);
  padding: 0 var(--sp-4);
  border: 0;
  border-radius: var(--r-pill);
  background: var(--c-cta-bg);
  color: var(--c-cta-text);
  font-family: var(--font-display);
  font-size: var(--fs-xs);
  font-weight: 900;
}
.card__btn--neon[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}
[data-layer='iznanka'] .card--mfo {
  border-color: var(--ink);
  background: var(--paper-white);
  color: var(--ink);
}
[data-layer='iznanka'] .card--mfo .card__title,
[data-layer='iznanka'] .card--mfo .card__shout,
[data-layer='iznanka'] .card--mfo .card__fine,
[data-layer='iznanka'] .card--mfo .card__note {
  color: var(--ink);
}
[data-layer='iznanka'] .card--mfo .card__shout {
  text-decoration: line-through 2px var(--stamp-red);
}
</style>
