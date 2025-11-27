<template>
  <section class="panel work">
    <header>
      <h2>Подработка</h2>
      <p class="muted">Заработай честным трудом</p>
    </header>
    <div class="info">
      <p>⚡ Энергия: <strong>{{ energy }}</strong></p>
      <p class="hint">Требуется минимум 10⚡</p>
    </div>
    <div class="buttons">
      <button @click="$emit('work-job')" :disabled="energy < 10">
        💼 Подработать (+200₽, -10⚡)
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ energy: number }>()
</script>

<style scoped>
.panel.work {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.info {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: center;
}

.info p {
  margin: 0;
}

.info .hint {
  font-size: 0.75rem;
  color: #7c7c8a;
  font-style: italic;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.buttons button {
  flex: 1;
}
</style>

