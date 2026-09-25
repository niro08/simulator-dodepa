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
        :queued="toasts.waiting.value"
        :duration="toasts.current.value.kind === 'error' ? 3500 : 4500"
        @close="toasts.dismiss()"
      />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import type { GameEvent } from '@/game'
import { formatAchievementToast, formatRejection } from '@/i18n'
import { TOASTS } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useToasts } from '@/composables/useToasts'
import Toast from '@/components/ui/Toast.vue'

/**
 * Слой тостов (ux-flows «T»): подписка на onPresent — для спина это момент после анимации.
 * Ачивки — мета-событие achievementUnlocked (тексты i18n formatAchievementToast).
 */
const game = useGameStore()
const toasts = useToasts()

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
        const t = formatAchievementToast(e.id, e.rewards)
        toasts.push({
          kind: 'achievement',
          title: 'ДОСТИЖЕНИЕ!',
          name: t.v.replace(/^🏆 ДОСТИЖЕНИЕ: /, ''),
          subtitle: t.reward ? `${t.i} · ${t.reward}` : t.i
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
</style>
