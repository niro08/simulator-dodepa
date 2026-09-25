<template>
  <section
    class="ui-slot"
    :class="[`ui-slot--${skin}`, lampsClass, { 'fx-shake': shaking, 'fx-flash': flashing }]"
    :aria-label="ariaLabel ?? title"
  >
    <div class="ui-slot__bevel" aria-hidden="true">
      <div v-if="showLamps" class="ui-slot__lamps ui-slot__lamps--top">
        <span v-for="n in lampsTop" :key="`t${n}`" class="fx-lamp" :style="{ '--i': n - 1 }" />
      </div>
      <div v-if="showLamps" class="ui-slot__lamps ui-slot__lamps--right">
        <span v-for="n in lampsSide" :key="`r${n}`" class="fx-lamp" :style="{ '--i': lampsTop + n - 1 }" />
      </div>
      <div v-if="showLamps" class="ui-slot__lamps ui-slot__lamps--bottom">
        <span
          v-for="n in lampsTop"
          :key="`b${n}`"
          class="fx-lamp"
          :style="{ '--i': lampsTop + lampsSide + (lampsTop - n) }"
        />
      </div>
      <div v-if="showLamps" class="ui-slot__lamps ui-slot__lamps--left">
        <span
          v-for="n in lampsSide"
          :key="`l${n}`"
          class="fx-lamp"
          :style="{ '--i': lampsTop * 2 + lampsSide + (lampsSide - n) }"
        />
      </div>
    </div>

    <div class="ui-slot__inner">
      <header v-if="title || $slots.sign" class="ui-slot__sign">
        <slot name="sign">
          <span class="ui-slot__star" aria-hidden="true">★</span>
          <span class="ui-slot__title">{{ title }}</span>
          <span class="ui-slot__star" aria-hidden="true">★</span>
        </slot>
      </header>

      <div class="ui-slot__window">
        <span v-if="paylineMarkers" class="ui-slot__marker ui-slot__marker--l" aria-hidden="true">▶</span>
        <div class="ui-slot__reels">
          <slot />
        </div>
        <span v-if="paylineMarkers" class="ui-slot__marker ui-slot__marker--r" aria-hidden="true">◀</span>
      </div>

      <div v-if="$slots.result" class="ui-slot__result">
        <slot name="result" />
      </div>
      <div v-if="$slots.footer" class="ui-slot__footer">
        <slot name="footer" />
      </div>
    </div>

    <ParticleBurst
      :burst-key="burstKey"
      :variant="burstVariant"
      :count="burstCount"
      :origin-y="45"
    />
  </section>
</template>

<script setup lang="ts">
/**
 * Корпус слота с лампочками (art-bible §3.6, §4). Без логики барабанов:
 * барабаны кладутся в default-слот, плашка результата — в #result.
 *
 * Эффекты запускаются сменой ключей (число > 0):
 *   shakeKey  — шейк корпуса 400 мс (джекпот);
 *   flashKey  — одна золотая вспышка 250 мс, только внутри корпуса;
 *   burstKey  — монетный взрыв ≤ 30 частиц (LDW празднуется так же, как выигрыш).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ParticleBurst, { type ParticleVariant } from './ParticleBurst.vue'

export type SlotLampMode = 'idle' | 'spin' | 'win' | 'off'
export type SlotFrameSkin = 'neon' | 'pixel' | 'circus' | 'paper'

const props = withDefaults(
  defineProps<{
    title?: string
    lampMode?: SlotLampMode
    /** frameClass скина: neon (Фруктовый), pixel (Бандит 90-х), circus (Клоунский), paper (Серая реальность). */
    skin?: SlotFrameSkin
    lampsTop?: number
    lampsSide?: number
    paylineMarkers?: boolean
    shakeKey?: number
    flashKey?: number
    burstKey?: number
    burstVariant?: ParticleVariant
    burstCount?: number
    ariaLabel?: string
  }>(),
  {
    title: 'ЗОЛОТО ДОДЕПА',
    lampMode: 'idle',
    skin: 'neon',
    lampsTop: 14,
    lampsSide: 3,
    paylineMarkers: true,
    shakeKey: 0,
    flashKey: 0,
    burstKey: 0,
    burstVariant: 'coins',
    burstCount: 24,
    ariaLabel: undefined
  }
)

const showLamps = computed(() => props.skin !== 'paper')
const lampsClass = computed(() => `fx-lamps--${props.lampMode}`)

const shaking = ref(false)
const flashing = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []

function retrigger(flag: typeof shaking, ms: number) {
  flag.value = false
  // Двойной rAF: класс снят и применён заново — анимация перезапускается
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      flag.value = true
      timers.push(setTimeout(() => (flag.value = false), ms))
    })
  )
}

watch(() => props.shakeKey, (k) => k && retrigger(shaking, 450))
watch(() => props.flashKey, (k) => k && retrigger(flashing, 300))

onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<style scoped>
.ui-slot {
  --bevel: 14px;
  --lamp: 9px;
  position: relative;
  width: 100%;
  max-width: 560px;
  padding: var(--bevel);
  border-radius: var(--r-lg);
  background: var(--gold-bevel);
  box-shadow: var(--shadow-lift), var(--glow-gold);
  font-family: var(--font-body);
  color: var(--c-text);
}
@media (max-width: 599px) {
  .ui-slot { --bevel: 10px; --lamp: 6px; }
}

.ui-slot__bevel {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
}
.ui-slot__lamps {
  position: absolute;
  display: flex;
  justify-content: space-around;
  align-items: center;
}
.ui-slot__lamps .fx-lamp { width: var(--lamp); height: var(--lamp); }
.ui-slot__lamps--top,
.ui-slot__lamps--bottom {
  left: var(--r-lg);
  right: var(--r-lg);
  height: var(--bevel);
}
.ui-slot__lamps--top { top: 0; }
.ui-slot__lamps--bottom { bottom: 0; }
.ui-slot__lamps--left,
.ui-slot__lamps--right {
  top: var(--r-lg);
  bottom: var(--r-lg);
  width: var(--bevel);
  flex-direction: column;
}
.ui-slot__lamps--left { left: 0; }
.ui-slot__lamps--right { right: 0; }

.ui-slot__inner {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-4);
  border-radius: calc(var(--r-lg) - 6px);
  background:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Cpath d='M8 0 16 8 8 16 0 8Z' fill='none' stroke='%23fff' stroke-opacity='.035'/%3E%3C/svg%3E"),
    var(--c-panel);
  box-shadow: inset 0 0 0 2px var(--c-line-neon), var(--glow-1);
}
@media (max-width: 599px) {
  .ui-slot__inner { padding: var(--sp-3) var(--sp-2); }
}

.ui-slot__sign {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--sp-2);
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--fs-xl);
  line-height: var(--lh-tight);
  text-transform: var(--tt-display);
  text-align: center;
}
.ui-slot__title {
  background: var(--gold-emboss);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 0 rgba(122, 74, 0, .9));
}
.ui-slot__star { color: var(--c-gold); font-size: .8em; }
@media (max-width: 599px) {
  .ui-slot__sign { font-size: var(--fs-lg); }
}

.ui-slot__window {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.ui-slot__reels { flex: 1; min-width: 0; }
.ui-slot__marker {
  flex: none;
  color: var(--c-win);
  font-size: var(--fs-sm);
  text-shadow: var(--glow-win);
}

.ui-slot__result {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.ui-slot__footer { display: flex; flex-wrap: wrap; gap: var(--sp-2); align-items: center; }

/* ---------- Скины рамки (frameClass) ---------- */
/* Бандит 90-х: хром + красная эмаль, ступенчатая пиксельная рамка, CRT-сканлайны (статичные) */
.ui-slot--pixel {
  border-radius: 0;
  background: linear-gradient(180deg, #F2F2F2, #9A9A9A 45%, #E0E0E0 55%, #7A7A7A);
  box-shadow: 4px 0 0 #3A0000, -4px 0 0 #3A0000, 0 4px 0 #3A0000, 0 -4px 0 #3A0000, var(--shadow-lift);
  --lamp-on: #FFB000;
  --lamp-on-2: #FF2A1A;
}
.ui-slot--pixel .ui-slot__inner {
  border-radius: 0;
  background:
    repeating-linear-gradient(180deg, rgba(0, 0, 0, .06) 0 1px, transparent 1px 3px),
    #8B0000;
  box-shadow: inset 0 0 0 4px #5A0000;
}
.ui-slot--pixel .ui-slot__title {
  background: none;
  color: #FFB000;
  -webkit-text-fill-color: #FFB000;
  filter: none;
  font-family: var(--font-pixel);
  font-size: .8em;
  text-shadow: 2px 2px 0 #3A0000;
}
.ui-slot--pixel .ui-slot__star { color: #FFB000; }

/* Клоунский: шатёр, полосы 16px, разноцветные лампы */
.ui-slot--circus {
  background: repeating-linear-gradient(90deg, #E0103A 0 16px, #FFF4E0 16px 32px);
  box-shadow: var(--shadow-lift), 0 0 0 2px #FFD400;
  --lamp-on: #FFD400;
  --lamp-on-2: #00C2FF;
}
.ui-slot--circus .ui-slot__inner { box-shadow: inset 0 0 0 2px #FFD400; }

/* Серая реальность: ничего не светится, рулон кассовой ленты */
.ui-slot--paper {
  padding: 0;
  border-radius: var(--r-paper);
  background: var(--paper);
  box-shadow: 0 0 0 1px var(--ink), var(--shadow-paper);
  color: var(--ink);
}
.ui-slot--paper .ui-slot__inner {
  border-radius: var(--r-paper);
  background: var(--paper);
  box-shadow: none;
  font-family: var(--font-mono);
}
.ui-slot--paper .ui-slot__title {
  background: none;
  color: var(--ink);
  -webkit-text-fill-color: var(--ink);
  filter: none;
  font-family: var(--font-mono);
  font-weight: 700;
}
.ui-slot--paper .ui-slot__star,
.ui-slot--paper .ui-slot__marker { color: var(--ink); text-shadow: none; }

:root[data-theme="monday"] .ui-slot__title { filter: none; }

/* Изнанка: корпус под фильтром .vitrina, свечения обнулены токенами */
</style>
