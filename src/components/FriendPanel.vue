<template>
  <section class="panel friend">
    <header>
      <h2>Друзья</h2>
      <p class="muted">Друзья не банк - занял и можно не отдавать</p>
    </header>
    <p>⚡ Энергия: {{ energy }} | ❤️ Репутация: {{ reputation }}</p>
    <div class="button-with-warning">
      <button @click="$emit('borrow-money')" :disabled="reputation <= 0 || energy < BORROW_COST">
        🤝 Занять у друга (-{{ BORROW_COST }}⚡, -1❤️)
      </button>
      <div class="warnings-container">
        <p v-if="reputation <= 0" class="warning-text">⚠️ Тебе больше никто не доверяет</p>
        <p v-if="energy < BORROW_COST" class="warning-text">⚠️ Нет сил выпросить деньги</p>
        <p v-if="reputation > 0 && energy >= BORROW_COST" class="warning-text-placeholder">&nbsp;</p>
      </div>
    </div>

    <div class="button-with-warning">
      <button @click="$emit('help-friend')" :disabled="energy < HELP_COST">
        ✨ Помочь другу (-{{ HELP_COST }}⚡, +1❤️)
      </button>
      <p v-if="energy < HELP_COST" class="warning-text">⚠️ Нет энергии, чтобы помогать</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ energy: number; reputation: number }>()

const BORROW_COST = 5
const HELP_COST = 5
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
