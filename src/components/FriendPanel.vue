<template>
  <section class="panel friend">
    <header>
      <h2>Друзья</h2>
      <p class="muted">Друзья не банк - занял и можно не отдавать</p>
    </header>
    <p>⚡ Энергия: {{ game.view.energy }} | ❤️ Репутация: {{ game.view.reputation }}</p>
    <div class="button-with-warning">
      <button @click="game.execute({ type: 'friends/borrow' })" :disabled="!!borrowBlock">
        🤝 Занять у друга (-{{ borrow.energyCost }}⚡, {{ signed(borrow.reputationDelta) }}❤️)
      </button>
      <div class="warnings-container">
        <p v-if="borrowBlock" class="warning-text">⚠️ {{ formatRejection('friends/borrow', borrowBlock) }}</p>
        <p v-else class="warning-text-placeholder">&nbsp;</p>
      </div>
    </div>

    <div class="button-with-warning">
      <button @click="game.execute({ type: 'friends/help' })" :disabled="!!helpBlock">
        ✨ Помочь другу (-{{ help.energyCost }}⚡, {{ signed(help.reputationDelta) }}❤️)
      </button>
      <p v-if="helpBlock" class="warning-text">⚠️ {{ formatRejection('friends/help', helpBlock) }}</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { formatRejection, signed } from '@/i18n'

const game = useGameStore()
const { borrow, help } = game.config.balance.friends

const borrowBlock = computed(() => game.canExecute({ type: 'friends/borrow' }))
const helpBlock = computed(() => game.canExecute({ type: 'friends/help' }))
</script>

<style scoped>
.panel.friend {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel.friend > p {
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

.warnings-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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
