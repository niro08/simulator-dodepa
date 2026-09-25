<template>
  <span v-if="reasonShown" class="ui-btn-wrap" :class="{ 'ui-btn-wrap--block': block }">
    <button data-ui
      v-bind="buttonAttrs"
      @click="onClick"
    >
      <span v-if="icon || $slots.icon" class="ui-btn__icon" aria-hidden="true"><slot name="icon">{{ icon }}</slot></span>
      <span class="ui-btn__label"><slot /></span>
    </button>
    <span :id="reasonId" class="ui-btn__reason">{{ disabledReason }}</span>
  </span>
  <button data-ui
    v-else
    v-bind="buttonAttrs"
    @click="onClick"
  >
    <span v-if="icon || $slots.icon" class="ui-btn__icon" aria-hidden="true"><slot name="icon">{{ icon }}</slot></span>
    <span class="ui-btn__label"><slot /></span>
  </button>
</template>

<script setup lang="ts">
/**
 * Кнопка Витрины и Изнанки (art-bible §3.8). Без игровой логики.
 * Disabled делается через aria-disabled: кнопка остаётся в порядке фокуса,
 * а причина читается скринридером (aria-describedby) и видна подписью.
 */
import { computed, useId, useSlots } from 'vue'

export type NeonButtonVariant = 'cta' | 'hot' | 'secondary' | 'danger' | 'ghost' | 'paper' | 'paper-danger'
export type NeonButtonSize = 'sm' | 'md' | 'lg' | 'xl'

const props = withDefaults(
  defineProps<{
    variant?: NeonButtonVariant
    size?: NeonButtonSize
    type?: 'button' | 'submit' | 'reset'
    /** Эмодзи-иконка слева (декоративная, aria-hidden). */
    icon?: string
    /** Пульс CTA 1.2 с. На экране не больше двух пульсирующих кнопок. */
    pulse?: boolean
    /** Скошенная баннерная версия (skew −6°) + блик раз в 4.5 с. */
    skew?: boolean
    /** Блик-полоса без скоса. */
    shimmer?: boolean
    disabled?: boolean
    /** Причина блокировки: подпись под кнопкой и aria-describedby. */
    disabledReason?: string
    /** Обязателен, если в кнопке только эмодзи. */
    ariaLabel?: string
    block?: boolean
  }>(),
  {
    variant: 'cta',
    size: 'md',
    type: 'button',
    icon: undefined,
    pulse: false,
    skew: false,
    shimmer: false,
    disabled: false,
    disabledReason: undefined,
    ariaLabel: undefined,
    block: false
  }
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const slots = useSlots()
const reasonId = `ui-btn-reason-${useId()}`
const reasonShown = computed(() => props.disabled && !!props.disabledReason)

const buttonAttrs = computed(() => ({
  type: props.type,
  class: [
    'ui-btn',
    `ui-btn--${props.variant}`,
    `ui-btn--${props.size}`,
    {
      'ui-btn--skew': props.skew,
      'ui-btn--block': props.block,
      'ui-btn--disabled': props.disabled,
      'ui-btn--icon-only': !slots.default,
      'fx-pulse': props.pulse && !props.disabled,
      'fx-shimmer': (props.shimmer || props.skew) && !props.disabled
    }
  ],
  'aria-disabled': props.disabled ? true : undefined,
  'aria-label': props.ariaLabel,
  'aria-describedby': reasonShown.value ? reasonId : undefined,
  title: props.disabled ? props.disabledReason : undefined
}))

function onClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault()
    event.stopImmediatePropagation()
    return
  }
  emit('click', event)
}
</script>

<style scoped>
.ui-btn-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
}
.ui-btn-wrap--block { display: flex; align-items: stretch; }

.ui-btn {
  --btn-h: 40px;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-height: var(--btn-h);
  min-width: var(--tap-min);
  padding: 0 var(--sp-5);
  border: 0;
  border-radius: var(--r-md);
  font-family: var(--font-condensed);
  font-weight: 700;
  font-size: var(--fs-md);
  line-height: var(--lh-snug);
  letter-spacing: var(--ls-caps);
  text-transform: var(--tt-caps);
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: filter var(--t-fast) var(--ease-out), transform var(--t-fast) var(--ease-out),
    background-color var(--t-fast) var(--ease-out);
}
.ui-btn__icon { font-family: var(--font-emoji); font-size: 1.15em; line-height: 1; }
.ui-btn__label { display: inline-block; }
.ui-btn--block { display: flex; width: 100%; }
.ui-btn.ui-btn--icon-only { padding: 0; min-width: var(--btn-h); }
.ui-btn--icon-only .ui-btn__label { display: none; }

/* Размеры (§3.8). Тач-зона ≥ 44 обеспечивается ::before у маленьких */
.ui-btn--sm { --btn-h: 32px; padding: 0 var(--sp-3); font-size: var(--fs-sm); }
.ui-btn--md { --btn-h: 44px; }
.ui-btn--lg { --btn-h: 48px; font-size: var(--fs-lg); padding: 0 var(--sp-6); }
.ui-btn--xl { --btn-h: 56px; font-size: var(--fs-xl); padding: 0 var(--sp-7); }
.ui-btn--sm::before {
  content: '';
  position: absolute;
  inset: -6px 0;
}

.ui-btn:focus-visible {
  outline: 3px solid var(--c-focus);
  outline-offset: 2px;
}

/* CTA — золото с тёмным текстом, кромка снизу */
.ui-btn--cta {
  background: var(--c-cta-bg);
  color: var(--c-cta-text);
  box-shadow: 0 4px 0 var(--c-cta-edge), var(--glow-gold);
}
.ui-btn--cta:hover:not(.ui-btn--disabled) { filter: brightness(1.08); }
.ui-btn--cta:active:not(.ui-btn--disabled) {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--c-cta-edge), var(--glow-gold);
}

/* Hot — баннерная «горячая» */
.ui-btn--hot {
  background: var(--c-hot-bg);
  color: var(--c-hot-text);
  box-shadow: var(--glow-1);
}
.ui-btn--hot:hover:not(.ui-btn--disabled) { filter: brightness(1.1); }
.ui-btn--skew { transform: skewX(var(--skew-banner)); }
.ui-btn--skew > .ui-btn__label,
.ui-btn--skew > .ui-btn__icon { transform: skewX(calc(var(--skew-banner) * -1)); }
.ui-btn--skew:active:not(.ui-btn--disabled) { transform: skewX(var(--skew-banner)) translateY(2px); }

/* Secondary — прозрачная с трубкой */
.ui-btn--secondary {
  background: transparent;
  color: var(--c-secondary-text);
  box-shadow: inset 0 0 0 var(--border-w) var(--c-secondary-line);
  font-weight: 500;
}
.ui-btn--secondary:hover:not(.ui-btn--disabled) {
  background: color-mix(in srgb, var(--c-secondary-line) 12%, transparent);
  box-shadow: inset 0 0 0 var(--border-w) var(--c-secondary-line), var(--glow-2);
}

/* Danger — «ДОДЕП ВСЁ» */
.ui-btn--danger {
  background: var(--c-danger-bg);
  color: var(--c-danger-text);
  box-shadow: var(--glow-alert);
}
.ui-btn--danger:hover:not(.ui-btn--disabled) { animation: fx-jitter 240ms linear 2; }

/* Ghost — ссылка */
.ui-btn--ghost {
  --btn-h: 44px;
  background: none;
  color: var(--c-text-muted);
  font-family: var(--font-body);
  font-weight: 400;
  font-size: var(--fs-sm);
  text-transform: none;
  letter-spacing: 0;
  text-decoration: underline;
  text-underline-offset: 3px;
  padding: 0 var(--sp-2);
}
.ui-btn--ghost:hover:not(.ui-btn--disabled) { color: var(--c-text); }

/* Бумажные — «Жизнь» и Изнанка */
.ui-btn--paper,
.ui-btn--paper-danger {
  --btn-h: 44px;
  background: var(--paper);
  color: var(--ink);
  border-radius: var(--r-paper);
  box-shadow: inset 0 0 0 2px var(--ink);
  font-family: var(--font-body);
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0;
}
.ui-btn--paper-danger { color: var(--stamp-red); box-shadow: inset 0 0 0 2px var(--stamp-red); }
.ui-btn--paper:hover:not(.ui-btn--disabled) { box-shadow: inset 0 0 0 2px var(--ink), 3px 3px 0 var(--ink); }
.ui-btn--paper-danger:hover:not(.ui-btn--disabled) { box-shadow: inset 0 0 0 2px var(--stamp-red), 3px 3px 0 var(--stamp-red); }
.ui-btn--paper:active:not(.ui-btn--disabled),
.ui-btn--paper-danger:active:not(.ui-btn--disabled) { transform: translate(3px, 3px); }
.ui-btn--paper:focus-visible,
.ui-btn--paper-danger:focus-visible { outline: 2px dashed var(--ink); }

/* Disabled */
.ui-btn--disabled {
  opacity: .45;
  cursor: not-allowed;
}
.ui-btn__reason {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  color: var(--c-text-muted);
  text-align: center;
}

/* Изнанка: всё, что кричит, становится бумажным */
:root[data-layer="iznanka"] .ui-btn:not(.ui-btn--ghost) {
  background: var(--paper);
  color: var(--ink);
  box-shadow: inset 0 0 0 2px var(--ink);
  border-radius: var(--r-paper);
  font-family: var(--font-mono);
  text-transform: none;
  transform: none;
}
/* CD-21: кольцо внутри бумажной кнопки — снаружи ink на тёмной серой Витрине давал 1.06:1 */
:root[data-layer="iznanka"] .ui-btn:not(.ui-btn--ghost):focus-visible { outline: 2px dashed var(--ink); outline-offset: -6px; }
</style>
