<template>
  <Modal :open="shell.sleepConfirm.value" variant="paper" size="sm" :title="SLEEP_CONFIRM.title" @update:open="(v) => !v && (shell.sleepConfirm.value = false)">
    <template v-if="hud">
      <p v-if="billUnpaid && hud.bill" class="sl__warn">{{ SLEEP_CONFIRM.billWarn(hud.bill.total) }}</p>
      <p v-if="hud.energy > 0">{{ SLEEP_CONFIRM.energyLeft(hud.energy) }}</p>
      <p class="sl__honest">{{ LIFE.sleepHonest(hud.livingCost, sleepTiltDecay(B)) }}</p>
      <p v-if="earlyOn" id="sl-early" class="sl__early">{{ EVENING.early }}: {{ EVENING.earlyPreview(earlyPreview.tilt, earlyPreview.energy) }}</p>
      <p v-if="shell.inCasino.value" class="sl__honest">{{ SLEEP_CONFIRM.inCasinoNote }}</p>
    </template>
    <template #footer>
      <div class="sl__actions">
        <button type="button" class="paper-btn" :data-autofocus="billUnpaid || undefined" @click="shell.sleepConfirm.value = false">
          {{ SLEEP_CONFIRM.stay }} <kbd>Esc</kbd>
        </button>
        <button
          type="button"
          class="paper-btn"
          :class="{ 'paper-btn--primary': !earlyOn }"
          :data-autofocus="(!billUnpaid && !earlyOn) || undefined"
          @click="shell.confirmSleep()"
        >
          {{ SLEEP_CONFIRM.sleep }}
        </button>
        <button
          v-if="earlyOn"
          type="button"
          class="paper-btn paper-btn--primary"
          aria-describedby="sl-early"
          :data-autofocus="!billUnpaid || undefined"
          @click="shell.confirmEarly()"
        >
          🌙 {{ EVENING.early }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { canExecute, earlyBedPreview, sleepTiltDecay, type RunState } from '@/game'
import { EVENING, LIFE, SLEEP_CONFIRM } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'

/** S40 Сон: подтверждение, если остались ⚡ или неоплаченный счёт сегодня. Фокус — по ux-flows. */
const game = useGameStore()
const shell = useShell()
const B = game.config.balance
const hud = computed(() => game.hud)
const billUnpaid = computed(() => !!hud.value?.bill?.isToday && hud.value.bill.status !== 'paid')

/** Состояние после выхода из казино (confirmEarly идёт через viaLife); первый выход после пробуждения стоит ⚡. */
const afterLeave = computed<RunState | null>(() => {
  const run = game.run
  if (!run || run.location !== 'casino') return run
  const cost = run.wokeInCasino ? Math.min(B.WAKE_CASINO_LEAVE_ENERGY, Math.max(0, run.energy)) : 0
  const state: RunState = { ...run, location: 'life', energy: run.energy - cost }
  delete state.wokeInCasino
  return state
})
/** «Лечь пораньше» (quick-fix-evening §3.3): только при флаге и если ядро разрешает. */
const earlyOn = computed(
  () => B.FEATURE_EVENING_FIX && !!afterLeave.value && canExecute(afterLeave.value, { type: 'day/early' }, game.config) === null
)
const earlyPreview = computed(() => earlyBedPreview({ energy: afterLeave.value?.energy ?? 0 }, B))
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
.sl__early {
  margin-top: var(--sp-2);
  font-weight: 700;
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
