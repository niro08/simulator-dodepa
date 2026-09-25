<template>
  <Modal :open="shell.sleepConfirm.value" variant="paper" size="sm" :title="SLEEP_CONFIRM.title" @update:open="(v) => !v && (shell.sleepConfirm.value = false)">
    <template v-if="hud">
      <p v-if="billUnpaid && hud.bill" class="sl__warn">{{ SLEEP_CONFIRM.billWarn(hud.bill.total) }}</p>
      <p v-if="hud.energy > 0">{{ SLEEP_CONFIRM.energyLeft(hud.energy) }}</p>
      <p class="sl__honest">{{ LIFE.sleepHonest(hud.livingCost, B.TILT_SLEEP_DECAY) }}</p>
      <p v-if="shell.inCasino.value" class="sl__honest">{{ SLEEP_CONFIRM.inCasinoNote }}</p>
    </template>
    <template #footer>
      <div class="sl__actions">
        <button type="button" class="paper-btn" :data-autofocus="billUnpaid || undefined" @click="shell.sleepConfirm.value = false">
          {{ SLEEP_CONFIRM.stay }} <kbd>Esc</kbd>
        </button>
        <button type="button" class="paper-btn paper-btn--primary" :data-autofocus="!billUnpaid || undefined" @click="shell.confirmSleep()">
          {{ SLEEP_CONFIRM.sleep }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LIFE, SLEEP_CONFIRM } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'

/** S40 Сон: подтверждение, если остались ⚡ или неоплаченный счёт сегодня. Фокус — по ux-flows. */
const game = useGameStore()
const shell = useShell()
const B = game.config.balance
const hud = computed(() => game.hud)
const billUnpaid = computed(() => !!hud.value?.bill?.isToday && hud.value.bill.status !== 'paid')
</script>

<style scoped>
.sl__warn {
  margin-bottom: var(--sp-2);
  color: var(--stamp-red);
  font-weight: 700;
}
.sl__honest {
  margin-top: var(--sp-2);
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.sl__actions {
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
