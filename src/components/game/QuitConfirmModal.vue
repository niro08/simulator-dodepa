<template>
  <Modal
    :open="shell.quitConfirm.value"
    variant="paper"
    size="sm"
    :title="QUIT_CONFIRM.title"
    @update:open="(v) => !v && (shell.quitConfirm.value = false)"
  >
    <template v-if="forfeit">
      <p v-if="forfeit.casino > 0" class="qc__warn" data-testid="quit-confirm-casino">{{ QUIT_CONFIRM.casino(forfeit.casino) }}</p>
      <p v-if="forfeit.withdrawals > 0" class="qc__warn">{{ QUIT_CONFIRM.withdrawals(forfeit.withdrawals) }}</p>
      <p v-if="forfeit.casino > 0 && forfeit.withdrawals > 0">{{ QUIT_CONFIRM.total(forfeit.total) }}</p>
      <p class="qc__honest">{{ QUIT_CONFIRM.honest }}</p>
    </template>
    <template #footer>
      <div class="qc__actions">
        <button type="button" class="paper-btn" data-autofocus @click="shell.quitConfirm.value = false">
          {{ QUIT_CONFIRM.back }} <kbd>Esc</kbd>
        </button>
        <button type="button" class="paper-btn paper-btn--primary" @click="shell.confirmQuit()">
          {{ QUIT_CONFIRM.confirm }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { QUIT_CONFIRM } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'

/**
 * «ЗАВЯЗАТЬ» с деньгами на сайте или выводом в очереди (GDD §3.7, E24): что сгорит и почему.
 * Фокус — на «Назад», чтобы двойной Enter не закрыл ран случайно. Сам выбор не отговаривает: «Завязать» остаётся главной кнопкой.
 */
const game = useGameStore()
const shell = useShell()
const forfeit = computed(() => game.hud?.quitForfeit ?? null)
</script>

<style scoped>
.qc__warn {
  margin-bottom: var(--sp-2);
  color: var(--stamp-red);
  font-weight: 700;
}
.qc__honest {
  margin-top: var(--sp-2);
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.qc__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-3);
}
kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
}
</style>
