<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="ui-modal"
      :class="`ui-modal--${variant}`"
      @mousedown.self="onBackdrop"
    >
      <div
        ref="dialog"
        class="ui-modal__dialog"
        :class="[dialogClass, { 'fx-conic-border': variant === 'neon' }]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="$slots.default ? bodyId : undefined"
        tabindex="-1"
        @keydown="onKeydown"
      >
        <div class="ui-modal__head">
          <p v-if="formNo && variant === 'paper'" class="ui-modal__form-no">{{ formNo }}</p>
          <h2 :id="titleId" class="ui-modal__title"><slot name="title">{{ title }}</slot></h2>
          <button data-ui
            v-if="closable"
            type="button"
            class="ui-modal__close"
            aria-label="Закрыть"
            @click="close"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div :id="bodyId" class="ui-modal__body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="ui-modal__foot">
          <slot name="footer" :close="close" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * Модалка (art-bible §3.7): neon — касса/бонус/«последний шанс», paper — счета/ломбард/банк/Выписка.
 * Teleport в body (вне .vitrina, чтобы фильтр Изнанки не ломал position: fixed).
 * Доступность: role=dialog, aria-modal, фокус-трап Tab/Shift+Tab, Esc закрывает (если closable),
 * фокус возвращается на элемент, открывший модалку. Первый фокус — [data-autofocus] или первый
 * фокусируемый элемент тела, иначе крестик. ✕ всегда контрастный, 44×44.
 * На мобильном (< 600px) — bottom-sheet.
 * Модалки могут стоять стопкой (Пауза поверх События/Счетов, Настройки поверх Паузы):
 * фокус держит только верхняя (modalStack), иначе обработчики focusin перетягивают фокус
 * друг у друга до переполнения стека (CD-21).
 */
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { isTopModal, popModal, pushModal } from './modalStack'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    variant?: 'neon' | 'paper'
    /** Можно ли закрыть (✕, Esc, клик по фону). Незакрываемые: события сна, S46, S50. */
    closable?: boolean
    closeOnBackdrop?: boolean
    /** Шапка-«бланк» бумажной модалки: «ФОРМА №7-СЧ». */
    formNo?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    title: '',
    variant: 'neon',
    closable: true,
    closeOnBackdrop: true,
    formNo: undefined,
    size: 'md'
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  close: []
}>()

const uid = useId()
const titleId = `ui-modal-title-${uid}`
const bodyId = `ui-modal-body-${uid}`
const dialog = ref<HTMLElement | null>(null)
let returnFocus: HTMLElement | null = null

const dialogClass = computed(() => [
  `ui-modal__dialog--${props.size}`,
  props.variant === 'paper' ? 'fx-paper-in' : 'fx-modal-in'
])

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

function focusables(): HTMLElement[] {
  const root = dialog.value
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0
  )
}

function close() {
  if (!props.closable) return
  emit('update:open', false)
  emit('close')
}

function onBackdrop() {
  if (props.closeOnBackdrop) close()
}

function onKeydown(event: KeyboardEvent) {
  if (!isTopModal(token)) return
  if (event.key === 'Escape') {
    if (props.closable) {
      event.stopPropagation()
      event.preventDefault()
      close()
    }
    return
  }
  if (event.key !== 'Tab') return
  const list = focusables()
  if (list.length === 0) {
    event.preventDefault()
    dialog.value?.focus()
    return
  }
  const first = list[0]!
  const last = list[list.length - 1]!
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === dialog.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/* Фокус, уходящий из модалки (клик мимо, программный фокус) — возвращаем внутрь */
function onFocusIn(event: FocusEvent) {
  if (!isTopModal(token)) return
  const root = dialog.value
  if (root && event.target instanceof Node && !root.contains(event.target)) {
    const target = focusables()[0] ?? root
    target.focus()
  }
}

let prevOverflow = ''
const token = Symbol('modal')

async function activate() {
  pushModal(token)
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  prevOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  document.addEventListener('focusin', onFocusIn)
  await nextTick()
  const root = dialog.value
  if (!root) return
  const preferred =
    root.querySelector<HTMLElement>('[data-autofocus]') ??
    root.querySelector<HTMLElement>('.ui-modal__body')?.querySelector<HTMLElement>(FOCUSABLE) ??
    focusables()[0] ??
    root
  preferred.focus()
}

function deactivate() {
  popModal(token)
  document.removeEventListener('focusin', onFocusIn)
  document.body.style.overflow = prevOverflow
  const target = returnFocus
  returnFocus = null
  if (target && document.contains(target)) target.focus()
}

watch(
  () => props.open,
  (isOpen, wasOpen) => {
    if (typeof document === 'undefined') return
    if (isOpen) void activate()
    else if (wasOpen) deactivate()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (props.open) deactivate()
})
</script>

<style scoped>
.ui-modal {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-3);
  background: var(--c-overlay);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}
.ui-modal--paper { background: var(--c-overlay-paper); }

.ui-modal__dialog {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  max-height: calc(100dvh - 24px);
  border-radius: var(--r-lg);
  outline: none;
}
.ui-modal__dialog--sm { max-width: 360px; }
.ui-modal__dialog--lg { max-width: 640px; }

/* Неоновая: фон панели, рамка — вращающееся conic-кольцо (vfx.css) */
.ui-modal--neon .ui-modal__dialog {
  color: var(--c-text);
  box-shadow: var(--shadow-lift), var(--glow-1);
  font-family: var(--font-body);
}
.ui-modal--neon .ui-modal__head {
  padding: var(--sp-4) var(--sp-7) var(--sp-3) var(--sp-5);
  background: linear-gradient(90deg, color-mix(in srgb, var(--c-accent-1) 28%, transparent), transparent);
  border-bottom: 1px solid var(--c-line);
}
.ui-modal--neon .ui-modal__title {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--fs-xl);
  line-height: var(--lh-snug);
  text-transform: var(--tt-display);
}

/* Бумажная: бланк, перфорация сверху, моно */
.ui-modal--paper .ui-modal__dialog {
  background: var(--paper);
  color: var(--ink);
  border-radius: var(--r-paper);
  box-shadow: var(--shadow-paper), 0 12px 32px rgba(0, 0, 0, .35);
  font-family: var(--font-mono);
}
.ui-modal--paper .ui-modal__dialog::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 0;
  right: 0;
  height: 8px;
  background: var(--perforation);
  transform: scaleY(-1);
}
.ui-modal--paper .ui-modal__head {
  padding: var(--sp-4) var(--sp-7) var(--sp-3) var(--sp-5);
  border-bottom: 1px solid var(--ink);
}
.ui-modal__form-no {
  margin: 0 0 var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: .08em;
}
.ui-modal--paper .ui-modal__title {
  font-size: var(--fs-lg);
  font-weight: 700;
  text-transform: uppercase;
}

.ui-modal__title { margin: 0; }
.ui-modal__body {
  min-height: 0;
  padding: var(--sp-5);
  overflow: auto;
  line-height: var(--lh-body);
}
.ui-modal__foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  align-items: center;
  justify-content: flex-end;
  padding: 0 var(--sp-5) var(--sp-5);
}

/* ✕ — всегда контрастный (пародия не распространяется на доступность) */
.ui-modal__close {
  position: absolute;
  top: var(--sp-2);
  right: var(--sp-2);
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 2px solid currentColor;
  border-radius: var(--r-sm);
  background: var(--c-panel);
  color: var(--c-text);
  font-size: var(--fs-lg);
  line-height: 1;
  cursor: pointer;
  z-index: 1;
}
.ui-modal--paper .ui-modal__close { background: var(--paper); color: var(--ink); border-radius: var(--r-paper); }
.ui-modal__close:focus-visible { outline: 3px solid var(--c-focus); outline-offset: 2px; }
.ui-modal--paper .ui-modal__close:focus-visible { outline: 2px dashed var(--ink); }

/* Мобильный: bottom-sheet */
@media (max-width: 599px) {
  .ui-modal { align-items: flex-end; padding: 0 var(--sp-3); }
  .ui-modal__dialog {
    max-width: none;
    max-height: calc(100dvh - 48px);
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .ui-modal--neon .ui-modal__dialog.fx-modal-in { animation-name: fx-sheet-in; }
}
</style>
