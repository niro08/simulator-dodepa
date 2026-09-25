<template>
  <Modal :open="!!view" variant="paper" size="md" :closable="false" :form-no="EVENT_CARD.kicker(day)">
    <template #title>
      <span class="ev__speaker">{{ card?.speaker ?? '…' }}</span>
    </template>
    <p class="ev__text">«{{ card?.text ?? view?.eventId }}»</p>
    <div class="ev__options" @keydown="onKey">
      <button
        v-for="opt in view?.options ?? []"
        :key="opt.index"
        type="button"
        class="ev__opt"
        :class="`ev__opt--${opt.index === 0 ? 'a' : 'b'}`"
        :aria-disabled="!opt.affordable || !armed || undefined"
        :aria-keyshortcuts="opt.index === 0 ? 'ArrowLeft 1' : 'ArrowRight 2'"
        :data-autofocus="opt.index === 0 || undefined"
        @click="choose(opt.index)"
      >
        <span class="ev__opt-title">{{ opt.index === 0 ? '← ' : '' }}{{ card?.options[opt.index] ?? `Вариант ${opt.index + 1}` }}{{ opt.index === 1 ? ' →' : '' }}</span>
        <span class="ev__opt-fx">{{ effectLine(opt.index, opt.cost) }}</span>
        <span v-if="!opt.affordable && opt.rejection" class="paper-reason">⚠ {{ formatRejection('event/choose', opt.rejection) }}</span>
        <span class="ev__opt-key">{{ opt.index === 0 ? '⟨←⟩ или ⟨1⟩' : '⟨→⟩ или ⟨2⟩' }}</span>
      </button>
    </div>
    <p class="ev__note">{{ EVENT_CARD.walletNote(hud?.wallet ?? 0) }}</p>
  </Modal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SleepEventEffect } from '@/game'
import { formatRejection, formatSleepEventCard, money } from '@/i18n'
import { EVENT_CARD } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'

/**
 * S42 Карточка события (Reigns): эффекты видны на кнопках до выбора (пиллар 3).
 * Защита от случайного выбора: варианты активны через 400 мс. ← / 1 и → / 2 — выбор, Esc — пауза поверх.
 */
const game = useGameStore()
const shell = useShell()
const view = computed(() => (game.phase === 'event' ? game.pendingEvent : null))
const card = computed(() => (view.value ? formatSleepEventCard(view.value) : null))
const hud = computed(() => game.hud)
const day = computed(() => Math.max(1, (hud.value?.day ?? 2) - 1))

const armed = ref(false)
let armTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => view.value?.eventId,
  (id) => {
    armed.value = false
    if (armTimer) clearTimeout(armTimer)
    if (id) armTimer = setTimeout(() => (armed.value = true), 400)
  },
  { immediate: true }
)

function effectsOf(index: number): SleepEventEffect | null {
  const id = view.value?.eventId
  const def = game.config.events.pool.find((e) => e.id === id)
  return def?.options[index]?.effect ?? null
}

const sign = (n: number) => (n > 0 ? `+${money(n)}` : money(n))

function effectLine(index: number, cost: number): string {
  const fx = effectsOf(index)
  const parts: string[] = []
  if (cost > 0) parts.push(EVENT_CARD.cost(cost))
  if (fx) {
    if (fx.wallet) parts.push(`👛 ${sign(fx.wallet)}₽`)
    if (fx.casino) parts.push(`🎰 ${sign(fx.casino)}₽`)
    if (fx.rep) parts.push(`❤️ ${sign(fx.rep)}`)
    if (fx.tilt) parts.push(`🔥 ${sign(fx.tilt)}`)
    if (fx.energyToday) parts.push(`⚡ ${sign(fx.energyToday)}`)
    if (fx.energyNextMorning) parts.push(`⚡ завтра ${sign(fx.energyNextMorning)}`)
    if (fx.debtMfo) parts.push(`💳 +${money(fx.debtMfo)}₽ долга`)
  }
  return parts.length ? parts.join(' · ') : EVENT_CARD.noCost
}

function choose(index: number) {
  const opt = view.value?.options[index]
  if (!opt || !opt.affordable || !armed.value) return
  game.execute({ type: 'event/choose', option: index })
}

function onKey(event: KeyboardEvent) {
  const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('.ev__opt'))
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    buttons[event.key === 'ArrowLeft' ? 0 : 1]?.focus()
    event.preventDefault()
  }
}

/** 1 / 2 — выбор сразу (ux-flows §5). */
function onGlobalKey(event: KeyboardEvent) {
  if (!view.value || shell.overlays.value.length > 0 || event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key === '1') choose(0)
  else if (event.key === '2') choose(1)
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
  if (armTimer) clearTimeout(armTimer)
})
</script>

<style scoped>
.ev__speaker {
  font-family: var(--font-mono);
}
.ev__text {
  margin: var(--sp-2) 0 var(--sp-4);
  font-family: var(--font-hand);
  font-size: var(--fs-xl);
  line-height: var(--lh-snug);
}
.ev__options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}
.ev__opt {
  display: grid;
  gap: var(--sp-1);
  align-content: start;
  min-height: 96px;
  padding: var(--sp-3);
  border: 2px solid var(--ink);
  border-radius: var(--r-xs);
  background: var(--paper-white);
  color: var(--ink);
  text-align: left;
  box-shadow: 3px 3px 0 var(--ink);
}
.ev__opt--b {
  text-align: right;
}
.ev__opt:hover:not([aria-disabled='true']) {
  background: var(--highlighter);
}
.ev__opt[aria-disabled='true'] {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}
.ev__opt-title {
  font-family: var(--font-mono);
  font-weight: 700;
}
.ev__opt-fx {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}
.ev__opt-key {
  color: var(--ink-muted);
  font-size: var(--fs-fine);
}
.ev__note {
  margin-top: var(--sp-3);
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
@media (max-width: 599px) {
  .ev__options {
    grid-template-columns: 1fr;
  }
  .ev__opt--b {
    text-align: left;
  }
}
</style>
