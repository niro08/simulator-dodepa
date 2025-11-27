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
      <button @click="$emit('take-credit')">🏦 Взять кредит (-5⚡)</button>
    </div>
    <div v-if="debt > 0" class="repay-section">
      <label for="repay-amount">Сумма погашения:</label>
      <input
        id="repay-amount"
        type="number"
        :value="repayAmount"
        :min="100"
        :max="Math.min(debt, money)"
        step="100"
        @input="onRepayInput"
      />
      <button @click="$emit('repay-debt', repayAmount)" :disabled="money < repayAmount || repayAmount < 100">
        💸 Погасить {{ repayAmount }}₽ (+{{ Math.ceil(repayAmount / 200) }}❤️)
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ money: number; debt: number }>()

const repayAmount = ref(200)

// Автоматически подстраиваем сумму если долг меньше
watch(() => props.debt, (newDebt) => {
  if (newDebt > 0 && repayAmount.value > newDebt) {
    repayAmount.value = Math.min(newDebt, 200)
  }
})

function onRepayInput(event: Event) {
  const target = event.target as HTMLInputElement
  repayAmount.value = Number(target.value)
}
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

.repay-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
}

.repay-section label {
  font-size: 0.875rem;
  color: #a0a0b0;
  font-weight: 600;
}

.repay-section input {
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(124, 58, 237, 0.4);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 1rem;
  text-align: center;
}

.repay-section input:focus {
  outline: none;
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
}

.repay-section button {
  width: 100%;
}
</style>
