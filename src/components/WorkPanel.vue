<template>
  <section class="panel work">
    <header>
      <h2>Подработка</h2>
      <p class="muted">Заработай честным трудом</p>
    </header>
    <p>⚡ Энергия: {{ game.view.energy }} | ❤️ Репутация: {{ game.view.reputation }}</p>

    <div class="button-with-warning">
      <button @click="game.execute({ type: 'work/job' })" :disabled="!!jobBlock">
        💼 Подработать (-{{ job.energyCost }}⚡, {{ signed(job.reputationDelta) }}❤️)
      </button>
      <p v-if="jobBlock" class="warning-text">⚠️ {{ formatRejection('work/job', jobBlock) }}</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>

    <div class="button-with-warning">
      <button @click="game.execute({ type: 'work/shady' })" :disabled="!!shadyBlock" class="shady-button">
        😈 Замутить темку (-{{ shady.energyCost }}⚡, {{ signed(shady.reputationDelta) }}❤️)
      </button>
      <p v-if="shadyBlock" class="warning-text">⚠️ {{ formatRejection('work/shady', shadyBlock) }}</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { formatRejection, signed } from '@/i18n'

const game = useGameStore()
// Числа — из конфига баланса, доступность — из ядра (TD-04)
const { job, shady } = game.config.balance.work

const jobBlock = computed(() => game.canExecute({ type: 'work/job' }))
const shadyBlock = computed(() => game.canExecute({ type: 'work/shady' }))
</script>

<style scoped>
.panel.work {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel.work > p {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  text-align: center;
  font-weight: 600;
}

.button-with-warning {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.button-with-warning button {
  width: 100%;
}

.shady-button {
  background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%) !important;
}

.shady-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%) !important;
}

.warning-text {
  color: #f59e0b;
  font-size: 0.875rem;
  margin: 0;
  text-align: center;
  font-weight: 600;
  padding: 0.25rem;
  min-height: 1.5rem;
}

.warning-text-placeholder {
  min-height: 1.5rem;
  margin: 0;
  padding: 0.25rem;
}
</style>

