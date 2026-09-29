<template>
  <Modal :open="shell.exitStep.value > 0" variant="neon" size="sm" :title="EXIT_CONFIRM.title" :closable="false">
    <p class="ex__body">{{ EXIT_CONFIRM.lines[idx] }}</p>
    <div class="ex__actions">
      <NeonButton variant="cta" size="lg" pulse @click="shell.exitStay()">
        {{ EXIT_CONFIRM.stay }}
      </NeonButton>
      <button type="button" class="ex__leave" data-autofocus aria-keyshortcuts="Escape" @click="shell.exitLeave()">
        {{ EXIT_CONFIRM.leave }}<template v-if="leaveCost > 0"> · {{ EVENING.leaveCost(leaveCost) }}</template> <kbd aria-hidden="true">Esc</kbd>
      </button>
    </div>
    <!-- Разоблачение видно всегда, не только в режиме 👓 -->
    <p class="ex__honest">{{ EXIT_CONFIRM.honest[idx] }}</p>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EVENING, EXIT_CONFIRM } from '@/i18n/ui'
import { useShell } from '@/composables/useShell'
import { useGameStore } from '@/stores/game'
import Modal from '@/components/ui/Modal.vue'
import NeonButton from '@/components/ui/NeonButton.vue'

/**
 * S14 Выход из казино при 🔥 ≥ 70: одно подтверждение, раз в игровой день (useShell). Фокус — на «уйти»,
 * Esc и Enter без перемещения фокуса = уйти. «Остаться» ничего не крутит само.
 */
const shell = useShell()
const game = useGameStore()
// Реплика дня: у каждого дня своя, пара «Витрина/Изнанка» — по одному индексу
/** Первый выход после пробуждения в казино стоит ⚡ (quick-fix-evening §3.4); при флаге false wokeInCasino не бывает. */
const leaveCost = computed(() => {
  const run = game.run
  return run?.wokeInCasino ? Math.min(game.config.balance.WAKE_CASINO_LEAVE_ENERGY, Math.max(0, run.energy)) : 0
})
const idx = computed(() => (game.hud?.day ?? 0) % EXIT_CONFIRM.lines.length)
</script>

<style scoped>
.ex__body {
  font-size: var(--fs-md);
  font-weight: 700;
}
.ex__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  margin: var(--sp-4) 0;
}
.ex__leave {
  min-height: var(--tap-min);
  padding: 0 var(--sp-3);
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}
.ex__leave kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
}
.ex__honest {
  padding: var(--sp-2);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
</style>
