<template>
  <section class="panel friend">
    <header>
      <h2>Друзья</h2>
      <p class="muted">Репутация: ❤️ {{ reputation }}</p>
    </header>
    <p>⚡ Энергия: {{ energy }}</p>
    <div class="buttons">
      <button @click="$emit('borrow-money')" :disabled="reputation <= 0 || energy < 5">🤝 Занять у друга (-5⚡, -1❤️)</button>
      <button @click="$emit('help-friend')" :disabled="energy < 5">✨ Помочь другу (-5⚡, +1❤️)</button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ energy: number; reputation: number }>()
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

.buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.buttons button {
  width: 100%;
}
</style>
