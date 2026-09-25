<template>
  <div
    class="ui-toast fx-toast-in"
    :class="`ui-toast--${kind}`"
    :role="kind === 'error' ? 'alert' : 'status'"
    :aria-live="kind === 'error' ? 'assertive' : 'polite'"
    aria-atomic="true"
    @mouseenter="hold(true)"
    @mouseleave="hold(false)"
    @focusin="hold(true)"
    @focusout="hold(false)"
  >
    <div class="ui-toast__medal" aria-hidden="true">
      <span class="ui-toast__icon">{{ icon ?? defaultIcon }}</span>
      <Stamp
        v-if="kind === 'achievement'"
        class="ui-toast__stamp"
        text="ЗАПИСАНО"
        tone="blue"
        size="sm"
        :rotate="-10"
        :animate="false"
        decorative
      />
    </div>
    <div class="ui-toast__body">
      <p v-if="heading" class="ui-toast__heading">{{ heading }}</p>
      <p v-if="name" class="ui-toast__name">{{ name }}</p>
      <p v-if="subtitle" class="ui-toast__subtitle">{{ subtitle }}</p>
      <p v-if="reward" class="ui-toast__reward">{{ reward }}</p>
      <slot />
    </div>
    <span v-if="queued > 0" class="ui-toast__queue" :aria-label="`ещё ${queued} в очереди`">+{{ queued }}</span>
    <button data-ui v-if="closable" type="button" class="ui-toast__close" aria-label="Закрыть уведомление" @click="dismiss">
      <span aria-hidden="true">✕</span>
    </button>
    <ParticleBurst
      v-if="kind === 'achievement'"
      variant="confetti"
      :count="8"
      :burst-key="1"
      :spread="120"
      :origin-x="12"
      :origin-y="40"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Тост (art-bible §3.10, ux-flows «T»). Не модальный, фокус не забирает.
 * Витрина: золотая рамка, 🏆 в круге, мини-конфетти 8 частиц. Изнанка: бумага, штамп «ЗАПИСАНО».
 * Автозакрытие через duration мс (0 — висит), пауза при наведении/фокусе.
 * Позиционирование и очередь — дело контейнера (класс-помощник .ui-toast-region ниже).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Stamp from './Stamp.vue'
import ParticleBurst from './ParticleBurst.vue'

const props = withDefaults(
  defineProps<{
    kind?: 'achievement' | 'system' | 'error'
    /** Надзаголовок: «ДОСТИЖЕНИЕ!». */
    title?: string
    /** Название ачивки / текст системного тоста. */
    name?: string
    /** Честный подзаголовок (моно). */
    subtitle?: string
    /** Строка-чип награды: «🎨 Открыт скин: Клоунский». */
    reward?: string
    icon?: string
    duration?: number
    closable?: boolean
    /** Сколько ещё ждут в очереди (пометка «+2»). */
    queued?: number
  }>(),
  {
    kind: 'achievement',
    title: undefined,
    name: undefined,
    subtitle: undefined,
    reward: undefined,
    icon: undefined,
    duration: 4500,
    closable: true,
    queued: 0
  }
)

const emit = defineEmits<{ close: [] }>()

const defaultIcon = computed(() => (props.kind === 'achievement' ? '🏆' : props.kind === 'error' ? '⚠️' : '✅'))
const heading = computed(() => props.title ?? (props.kind === 'achievement' ? 'ДОСТИЖЕНИЕ!' : undefined))

let remaining = props.duration
let startedAt = 0
let timer: ReturnType<typeof setTimeout> | undefined
const held = ref(false)

function start() {
  if (props.duration <= 0 || remaining <= 0) return
  startedAt = performance.now()
  timer = setTimeout(dismiss, remaining)
}
function stop() {
  if (!timer) return
  clearTimeout(timer)
  timer = undefined
  remaining -= performance.now() - startedAt
}
function hold(on: boolean) {
  if (held.value === on) return
  held.value = on
  if (on) stop()
  else start()
}
function dismiss() {
  stop()
  emit('close')
}

onMounted(start)
onBeforeUnmount(stop)
</script>

<style scoped>
.ui-toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  width: 340px;
  max-width: 100%;
  padding: var(--sp-3) var(--sp-7) var(--sp-3) var(--sp-3);
  border-radius: var(--r-md);
  background: var(--c-panel);
  color: var(--c-text);
  font-family: var(--font-body);
  box-shadow: inset 0 0 0 2px var(--c-gold), var(--glow-gold), var(--shadow-lift);
  overflow: visible;
}
.ui-toast--system { box-shadow: inset 0 0 0 2px var(--c-win), var(--shadow-lift); }
.ui-toast--error { box-shadow: inset 0 0 0 2px var(--c-alert), var(--glow-alert), var(--shadow-lift); }

.ui-toast__medal {
  flex: none;
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--gold-bevel);
}
.ui-toast--system .ui-toast__medal,
.ui-toast--error .ui-toast__medal { background: var(--c-panel-2); }
.ui-toast__icon { font-family: var(--font-emoji); font-size: 28px; line-height: 1; }
.ui-toast__stamp { display: none; }

.ui-toast__body { min-width: 0; }
.ui-toast__body p { margin: 0; }
.ui-toast__heading {
  font-family: var(--font-condensed);
  font-weight: 700;
  font-size: var(--fs-xs);
  letter-spacing: .08em;
  text-transform: var(--tt-caps);
  color: var(--c-gold);
}
.ui-toast__name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--fs-md);
  line-height: var(--lh-snug);
}
.ui-toast__subtitle {
  margin-top: 2px !important;
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
  line-height: 1.4;
}
.ui-toast__reward {
  display: inline-block;
  margin-top: var(--sp-2) !important;
  padding: 2px var(--sp-2);
  border-radius: var(--r-pill);
  background: var(--c-panel-2);
  font-size: var(--fs-xs);
}
.ui-toast__queue {
  position: absolute;
  right: var(--sp-3);
  bottom: var(--sp-2);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}
.ui-toast__close {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 44px;
  height: 44px;
  border: 0;
  background: none;
  color: var(--c-text);
  font-size: var(--fs-md);
  cursor: pointer;
}
.ui-toast__close:focus-visible { outline: 3px solid var(--c-focus); outline-offset: -4px; }

/* Изнанка: та же структура на бумаге, 🏆 заменён штампом */
:root[data-layer="iznanka"] .ui-toast {
  background: var(--paper);
  color: var(--ink);
  border-radius: var(--r-paper);
  box-shadow: inset 0 0 0 1px var(--ink), var(--shadow-paper);
  font-family: var(--font-mono);
}
:root[data-layer="iznanka"] .ui-toast__medal { background: none; width: 72px; }
:root[data-layer="iznanka"] .ui-toast__icon { display: none; }
:root[data-layer="iznanka"] .ui-toast__stamp { display: inline-block; }
:root[data-layer="iznanka"] .ui-toast__heading,
:root[data-layer="iznanka"] .ui-toast__subtitle,
:root[data-layer="iznanka"] .ui-toast__queue { color: var(--ink-muted); }
:root[data-layer="iznanka"] .ui-toast__name { font-family: var(--font-mono); font-weight: 700; }
:root[data-layer="iznanka"] .ui-toast__reward { background: var(--paper-2); }
:root[data-layer="iznanka"] .ui-toast__close { color: var(--ink); }
:root[data-layer="iznanka"] .ui-toast .fx-particles { display: none; }
:root[data-layer="iznanka"] .ui-toast.fx-toast-in { animation-name: honest-in; }

/* Контейнер-помощник: снизу справа (десктоп), сверху по центру (мобильный) */
:global(.ui-toast-region) {
  position: fixed;
  z-index: var(--z-toast);
  right: var(--sp-5);
  bottom: var(--sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  pointer-events: none;
}
:global(.ui-toast-region > *) { pointer-events: auto; }
@media (max-width: 599px) {
  :global(.ui-toast-region) { left: var(--sp-3); right: var(--sp-3); bottom: auto; top: 64px; }
  .ui-toast { width: 100%; }
}
</style>
