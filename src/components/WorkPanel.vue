<template>
  <section class="panel work">
    <header>
      <h2>Подработка</h2>
      <p class="muted">Заработай честным трудом</p>
    </header>
    <p>⚡ Энергия: {{ energy }} | ❤️ Репутация: {{ reputation }}</p>

    <div class="button-with-warning">
      <button @click="$emit('work-job')" :disabled="energy < JOB_COST">
        💼 Подработать (-{{ JOB_COST }}⚡, +{{ JOB_REPUTATION_GAIN }}❤️)
      </button>
      <p v-if="energy < JOB_COST" class="warning-text">⚠️ Слишком устал для подработки</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>

    <div class="button-with-warning">
      <button @click="$emit('shady-deal')" :disabled="energy < SHADY_DEAL_COST" class="shady-button">
        😈 Замутить темку (-{{ SHADY_DEAL_COST }}⚡, -{{ SHADY_DEAL_REPUTATION_LOSS }}❤️)
      </button>
      <p v-if="energy < SHADY_DEAL_COST" class="warning-text">⚠️ Слишком устал для темных дел</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ energy: number; reputation: number }>()

const JOB_COST = 10
const JOB_REPUTATION_GAIN = 1
const SHADY_DEAL_COST = 10
const SHADY_DEAL_REPUTATION_LOSS = 3
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

