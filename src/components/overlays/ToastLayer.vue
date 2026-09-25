<template>
  <Teleport to="body">
    <div class="ui-toast-region toast-layer">
      <Toast
        v-if="toasts.current.value"
        :key="toasts.current.value.id"
        :kind="toasts.current.value.kind"
        :title="toasts.current.value.title"
        :name="toasts.current.value.name"
        :subtitle="toasts.current.value.subtitle"
        :icon="toasts.current.value.icon"
        :reward="toasts.current.value.reward"
        :queued="toasts.waiting.value"
        :duration="toasts.current.value.kind === 'error' ? 3500 : toasts.current.value.kind === 'achievement' ? 5000 : 4500"
        @close="toasts.dismiss()"
      >
        <button
          v-if="toasts.current.value.action === 'wardrobe'"
          type="button"
          class="toast-layer__action"
          @click="toWardrobe"
        >
          {{ TOASTS.toWardrobe }}
        </button>
      </Toast>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import type { GameEvent } from '@/game'
import { achievementText, cosmeticRewardLine, formatRejection } from '@/i18n'
import { TOASTS } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import { useToasts } from '@/composables/useToasts'
import Toast from '@/components/ui/Toast.vue'

/**
 * Слой тостов (ux-flows «T»): подписка на onPresent — для спина это момент после анимации.
 * Ачивки — мета-событие achievementUnlocked (ux-flows «T», art-bible §3.10): название, честный подзаголовок,
 * чип награды и «В гардероб →», если дали косметику. Очередь — useToasts (виден один, «+N»).
 * Позиция: десктоп — справа сверху под шапкой (не над слотом и КРУТИТЬ), мобильный — сверху во всю ширину.
 */
const game = useGameStore()
const shell = useShell()
const toasts = useToasts()

/** Кнопка на тосте ачивки: Гардероб откроется на вкладке новой вещи; «Назад» вернёт в ран. */
function toWardrobe() {
  toasts.dismiss()
  shell.go('wardrobe')
}

function present(events: readonly GameEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'rejected':
        // Отказ ставки/спина показывает сам слот; остальное — тостом
        if (e.command !== 'slot/spin' && e.command !== 'bet/set') {
          toasts.push({ kind: 'error', title: TOASTS.rejectedTitle, name: formatRejection(e.command, e) })
        }
        break
      case 'withdrawPaid':
        toasts.push({ kind: 'system', name: TOASTS.withdrawPaid(e.net), subtitle: TOASTS.withdrawPaidHonest, icon: '💸' })
        break
      case 'bonusBusted':
        toasts.push({ kind: 'error', name: TOASTS.bonusBusted })
        break
      case 'bonusCleared':
        toasts.push({ kind: 'system', name: TOASTS.bonusCleared(e.released), icon: '🔓' })
        break
      case 'friendsBlocked':
        toasts.push({ kind: 'error', name: TOASTS.friendsBlocked })
        break
      case 'achievementUnlocked': {
        const t = achievementText(e.id)
        const rewards = e.rewards.filter((r) => game.cosmetics.items.some((i) => i.id === r))
        toasts.push({
          kind: 'achievement',
          title: TOASTS.achievementTitle,
          name: t.title,
          subtitle: t.honest,
          reward: rewards.length > 0 ? rewards.map(cosmeticRewardLine).join(' · ') : undefined,
          action: rewards.length > 0 ? 'wardrobe' : undefined
        })
        break
      }
      case 'forcedMfo':
        toasts.push({ kind: 'error', name: TOASTS.forcedMfo(e.amount) })
        break
      default:
        break
    }
  }
}

const off = game.onPresent(present)
onBeforeUnmount(off)
</script>

<style scoped>
.toast-layer {
  top: 84px;
  bottom: auto;
}
@media (max-width: 1023px) {
  .toast-layer {
    top: 104px;
  }
}
@media (max-width: 599px) {
  .toast-layer {
    top: 60px;
  }
}
.toast-layer__action {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  margin-top: var(--sp-2);
  padding: 0 var(--sp-3);
  border: 1px solid var(--c-gold);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--c-gold);
  font-family: var(--font-condensed);
  font-weight: 700;
  font-size: var(--fs-sm);
  letter-spacing: 0.04em;
}
.toast-layer__action:hover {
  background: color-mix(in srgb, var(--c-gold) 18%, transparent);
}
.toast-layer__action:focus-visible {
  outline: 3px solid var(--c-focus);
  outline-offset: 2px;
}
:root[data-layer='iznanka'] .toast-layer__action {
  border-color: var(--ink);
  color: var(--ink);
  font-family: var(--font-mono);
}
</style>
