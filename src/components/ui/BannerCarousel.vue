<template>
  <section
    class="ui-carousel"
    :class="{ 'ui-carousel--calm': motionReduced }"
    aria-roledescription="карусель"
    :aria-label="ariaLabel"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focused = true"
    @focusout="onFocusOut"
  >
    <div class="ui-carousel__viewport" :aria-live="autoplayActive ? 'off' : 'polite'">
      <div
        class="ui-carousel__track"
        :style="motionReduced ? undefined : { transform: `translateX(${-index * 100}%)` }"
      >
        <div
          v-for="(slide, i) in slides"
          :key="slide.id"
          class="ui-carousel__slide"
          :class="[`ui-carousel__slide--${slide.tone ?? 'magenta'}`, { 'ui-carousel__slide--active': i === index }]"
          role="group"
          aria-roledescription="слайд"
          :aria-label="`${i + 1} из ${slides.length}: ${slide.title}`"
          :aria-hidden="i === index ? undefined : 'true'"
          :inert="i === index ? undefined : true"
        >
          <div class="ui-carousel__rays" aria-hidden="true"><div class="fx-rays" /></div>
          <div class="ui-carousel__spot" aria-hidden="true" />
          <div v-if="slide.emoji" class="ui-carousel__emoji fx-float" aria-hidden="true">{{ slide.emoji }}</div>

          <div class="ui-carousel__copy">
            <p v-if="slide.kicker" class="ui-carousel__kicker">{{ slide.kicker }}</p>
            <h2 class="ui-carousel__title">{{ slide.title }}</h2>
            <p v-if="slide.hero" class="ui-carousel__hero">{{ slide.hero }}</p>
            <NeonButton
              v-if="slide.cta"
              variant="hot"
              size="md"
              skew
              class="ui-carousel__cta"
              @click="emit('cta', slide.id)"
            >
              {{ slide.cta }}
            </NeonButton>
            <p class="ui-carousel__fine">{{ slide.fine }}</p>
          </div>

          <div v-if="slide.timer" class="ui-carousel__timer" role="timer" aria-live="off">
            <template v-if="extended">Мы продлили специально для вас! 🎁</template>
            <template v-else>⏰ Бонус сгорит через <b class="tabular">{{ timerText }}</b></template>
          </div>

          <div class="honest ui-carousel__honest-stamp"><Stamp text="ПРИЁМ" :rotate="-8" overlay decorative /></div>
          <slot name="honest" :slide="slide" />
        </div>
      </div>
    </div>

    <div class="ui-carousel__nav">
      <button data-ui type="button" class="ui-carousel__arrow" aria-label="Предыдущий баннер" @click="go(index - 1)">
        <span aria-hidden="true">‹</span>
      </button>
      <div class="ui-carousel__dots" role="group" aria-label="Выбор баннера">
        <button data-ui
          v-for="(slide, i) in slides"
          :key="slide.id"
          type="button"
          class="ui-carousel__dot"
          :class="{ 'ui-carousel__dot--active': i === index }"
          :aria-label="`Баннер ${i + 1}`"
          :aria-current="i === index ? 'true' : undefined"
          @click="go(i)"
        />
      </div>
      <button data-ui type="button" class="ui-carousel__arrow" aria-label="Следующий баннер" @click="go(index + 1)">
        <span aria-hidden="true">›</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Хиро-карусель (art-bible §3.2). Слайды — данные, у каждого обязательная сноска `fine`
 * (пиллар 1: у «крика» есть бумажный двойник). Автосмена 6 с, translateX 450 мс,
 * пауза при hover/focus. В calm — без автосмены, только стрелки, кроссфейд.
 *
 * Врущий таймер (слайд с timer: true): тикает 1 Гц без мигания, на 00:00 показывает
 * «Мы продлили…» 600 мс, сбрасывается и эмитит `timer-reset` с числом сгораний
 * (игра засчитывает ачивку #22 сама — компонент логики не знает).
 *
 * Изнанка (html[data-layer="iznanka"]): заголовок зачёркнут, сноска вырастает до --fs-xl,
 * поверх — штамп «ПРИЁМ». Свои честные ярлыки — в слот #honest (класс .honest).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'
import NeonButton from './NeonButton.vue'
import Stamp from './Stamp.vue'

export interface BannerSlide {
  id: string
  kicker?: string
  title: string
  /** Цифра-герой: «200%». */
  hero?: string
  cta?: string
  /** Сноска мелким шрифтом — обязательна. */
  fine: string
  emoji?: string
  tone?: 'magenta' | 'cyan' | 'gold'
  /** Показать врущий таймер на этом слайде. */
  timer?: boolean
}

const props = withDefaults(
  defineProps<{
    slides: readonly BannerSlide[]
    /** Автосмена, мс. 0 — выключена. */
    interval?: number
    /** Стартовое значение врущего таймера, с (04:59). */
    timerSeconds?: number
    ariaLabel?: string
  }>(),
  { interval: 6000, timerSeconds: 299, ariaLabel: 'Акции' }
)

const emit = defineEmits<{
  cta: [slideId: string]
  'update:index': [index: number]
  /** Таймер «сгорел» и обнулился; burns — сколько раз уже. */
  'timer-reset': [burns: number]
}>()

const { motionReduced } = useTheme()

const index = ref(0)
const hovered = ref(false)
const focused = ref(false)

function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  const root = event.currentTarget as HTMLElement | null
  if (!root || !(next instanceof Node) || !root.contains(next)) focused.value = false
}

function go(i: number) {
  const n = props.slides.length
  if (n === 0) return
  index.value = ((i % n) + n) % n
  emit('update:index', index.value)
}

const autoplayActive = computed(
  () => props.interval > 0 && !motionReduced.value && !hovered.value && !focused.value && props.slides.length > 1
)

let autoTimer: ReturnType<typeof setInterval> | undefined
watch(
  autoplayActive,
  (on) => {
    if (autoTimer) clearInterval(autoTimer)
    autoTimer = on ? setInterval(() => go(index.value + 1), props.interval) : undefined
  },
  { immediate: true }
)

/* Врущий таймер */
const remaining = ref(props.timerSeconds)
const extended = ref(false)
const burns = ref(0)
let tick: ReturnType<typeof setInterval> | undefined
let extendTimer: ReturnType<typeof setTimeout> | undefined

const hasTimer = computed(() => props.slides.some((s) => s.timer))
const timerText = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

watch(
  hasTimer,
  (on) => {
    if (tick) clearInterval(tick)
    tick = undefined
    if (!on) return
    tick = setInterval(() => {
      if (extended.value) return
      if (remaining.value > 0) {
        remaining.value -= 1
        return
      }
      extended.value = true
      burns.value += 1
      emit('timer-reset', burns.value)
      extendTimer = setTimeout(() => {
        remaining.value = props.timerSeconds
        extended.value = false
      }, 600)
    }, 1000)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (autoTimer) clearInterval(autoTimer)
  if (tick) clearInterval(tick)
  if (extendTimer) clearTimeout(extendTimer)
})
</script>

<style scoped>
.ui-carousel {
  position: relative;
  width: 100%;
  border-radius: var(--r-lg);
  box-shadow: inset 0 0 0 var(--border-w) var(--c-line-neon), var(--glow-1);
  background: var(--c-panel);
  color: var(--c-text);
}
.ui-carousel__viewport {
  position: relative;
  overflow: hidden;
  border-radius: inherit;
  height: 280px;
}
.ui-carousel__track {
  display: flex;
  height: 100%;
  transition: transform var(--t-slow) var(--ease-out);
}
.ui-carousel__slide {
  position: relative;
  flex: 0 0 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
}
/* Кроссфейд в calm: слайды стопкой, меняется только opacity */
.ui-carousel--calm .ui-carousel__track { display: grid; }
.ui-carousel--calm .ui-carousel__slide {
  grid-area: 1 / 1;
  opacity: 0;
  transition: opacity var(--t-base) linear;
}
.ui-carousel--calm .ui-carousel__slide--active { opacity: 1; }

.ui-carousel__rays {
  position: absolute;
  z-index: -2;
  width: 900px;
  height: 900px;
  right: -300px;
  top: 50%;
  margin-top: -450px;
  pointer-events: none;
}
.ui-carousel__rays .fx-rays { inset: 0; }
.ui-carousel__spot {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: radial-gradient(60% 90% at 78% 50%, var(--spot, rgba(255, 43, 214, .35)), transparent 70%);
}
.ui-carousel__slide--cyan { --spot: rgba(0, 229, 255, .28); }
.ui-carousel__slide--gold { --spot: rgba(255, 196, 61, .3); }

.ui-carousel__emoji {
  position: absolute;
  right: 6%;
  top: 50%;
  margin-top: -48px;
  font-family: var(--font-emoji);
  font-size: 88px;
  line-height: 1;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, .5));
}

.ui-carousel__copy {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-2);
  max-width: 64%;
  height: 100%;
  justify-content: center;
  padding: var(--sp-5) var(--sp-5) var(--sp-6) var(--sp-6);
}
.ui-carousel__copy > :not(.ui-carousel__fine) { transform: skewX(var(--skew-banner)); }
.ui-carousel__copy > .ui-carousel__cta { transform: none; }
.ui-carousel__copy p,
.ui-carousel__copy h3 { margin: 0; }
.ui-carousel__kicker {
  font-family: var(--font-condensed);
  font-weight: 500;
  font-size: var(--fs-sm);
  letter-spacing: var(--ls-wide);
  text-transform: var(--tt-caps);
  color: var(--c-accent-2);
}
.ui-carousel__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--fs-xl);
  line-height: var(--lh-snug);
  text-transform: var(--tt-display);
}
.ui-carousel__hero {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--fs-hero);
  line-height: var(--lh-tight);
  background: var(--gold-emboss);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 3px 0 rgba(122, 74, 0, .9));
}
.ui-carousel__cta { margin-top: var(--sp-1); }
.ui-carousel__fine {
  max-width: 44ch;
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  line-height: 1.35;
  color: var(--c-text-fine);
}

.ui-carousel__timer {
  position: absolute;
  top: var(--sp-3);
  right: var(--sp-3);
  padding: var(--sp-1) var(--sp-3);
  border-radius: var(--r-sm);
  background: var(--c-alert);
  color: var(--c-alert-text);
  font-family: var(--font-condensed);
  font-weight: 500;
  font-size: var(--fs-sm);
  box-shadow: var(--glow-alert);
}
.ui-carousel__timer b { font-family: var(--font-mono); font-weight: 700; }

.ui-carousel__honest-stamp { position: absolute; top: 52%; right: 30%; width: 0; height: 0; z-index: 3; }

/* Навигация */
.ui-carousel__nav {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--sp-1);
  padding: 0 var(--sp-2) var(--sp-1);
  pointer-events: none;
}
.ui-carousel__nav > * { pointer-events: auto; }
.ui-carousel__arrow {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--c-text);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}
.ui-carousel__arrow:hover { background: color-mix(in srgb, var(--c-text) 12%, transparent); }
.ui-carousel__dots { display: flex; align-items: center; }
.ui-carousel__dot {
  position: relative;
  width: 24px;
  height: 44px;
  border: 0;
  background: none;
  cursor: pointer;
}
.ui-carousel__dot::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: var(--r-pill);
  background: var(--c-text-muted);
  transition: width var(--t-fast) var(--ease-out), margin var(--t-fast) var(--ease-out);
}
.ui-carousel__dot--active { width: 32px; }
.ui-carousel__dot--active::before { width: 24px; margin-left: -12px; background: var(--c-gold); }
.ui-carousel__arrow:focus-visible,
.ui-carousel__dot:focus-visible { outline: 3px solid var(--c-focus); outline-offset: -3px; border-radius: var(--r-sm); }

/* Мобильный: 200px */
/* Мобильный: 200px по §3.2 + 40px на обязательную сноску (TA: иначе сноска наезжает на точки) */
@media (max-width: 599px) {
  .ui-carousel__viewport { height: 240px; }
  .ui-carousel__copy {
    max-width: 100%;
    justify-content: flex-start;
    padding: 40px var(--sp-4) 44px;
    gap: 6px;
  }
  .ui-carousel__kicker { display: none; }
  .ui-carousel__emoji { font-size: 32px; right: var(--sp-3); top: 4px; margin-top: 0; }
  .ui-carousel__title { font-size: var(--fs-md); max-width: 72%; }
  .ui-carousel__hero { font-size: 2.5rem; }
  .ui-carousel__timer { font-size: var(--fs-xs); padding: 2px var(--sp-2); top: var(--sp-2); left: var(--sp-4); right: auto; }
  .ui-carousel__fine { max-width: 100%; }
  .ui-carousel__nav { padding-bottom: 0; }
  .ui-carousel__arrow { width: 44px; }
  .ui-carousel__rays { width: 600px; height: 600px; margin-top: -300px; right: -260px; }
}

/* «Утро понедельника»: баннер — «квартальный отчёт», без лучей и пятен */
:root[data-theme="monday"] .ui-carousel__rays { display: none; }
:root[data-theme="monday"] .ui-carousel__spot { background: linear-gradient(90deg, transparent 55%, var(--c-panel-2)); }

/* Изнанка: обещание зачёркнуто, сноска становится заголовком */
:root[data-layer="iznanka"] .ui-carousel__title,
:root[data-layer="iznanka"] .ui-carousel__hero {
  text-decoration: line-through 3px var(--stamp-red);
  opacity: .6;
}
:root[data-layer="iznanka"] .ui-carousel__hero { -webkit-text-fill-color: var(--c-text); background: none; filter: none; }
:root[data-layer="iznanka"] .ui-carousel__fine {
  max-width: none;
  padding: var(--sp-2) var(--sp-3);
  background: var(--paper);
  color: var(--ink);
  font-size: var(--fs-lg);
  line-height: 1.3;
  box-shadow: var(--shadow-paper);
}
:root[data-layer="iznanka"] .ui-carousel__copy { max-width: 100%; }
:root[data-layer="iznanka"] .ui-carousel__copy > * { transform: none; }
:root[data-layer="iznanka"] .ui-carousel__emoji,
:root[data-layer="iznanka"] .ui-carousel__rays { display: none; }
</style>
