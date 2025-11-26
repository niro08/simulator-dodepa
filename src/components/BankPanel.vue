<template>
  <section class="panel bank">
    <header>
      <h2>Банк</h2>
      <p class="muted">Управляй кредитами и долгами</p>
    </header>
    <div class="info">
      <p>💼 На руках: <strong>{{ money }} ₽</strong></p>
      <p>💳 Долг: <strong>{{ debt }} ₽</strong></p>
    </div>
    <div class="buttons">
      <button @click="$emit('take-credit')">🏦 Взять кредит</button>
      <button @click="$emit('repay-debt')" :disabled="debt <= 0">💸 Погасить долг</button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ money: number; debt: number }>()
</script>

<style scoped>
.panel.bank {
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
}

.info p {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.buttons {
  display: flex;
  gap: 0.5rem;
}

.buttons button {
  flex: 1;
}
</style>
