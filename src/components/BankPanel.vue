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
      <button @click="$emit('take-credit')" :disabled="energy < CREDIT_COST || reputation - CREDIT_REPUTATION_LOSS < 0">
        🏦 Взять кредит (-{{ CREDIT_COST }}⚡, -{{ CREDIT_REPUTATION_LOSS }}❤️)
      </button>
    </div>
    <p v-if="reputation - CREDIT_REPUTATION_LOSS < 0" class="warning-text">⚠️ Банк отказал в кредите из-за низкой репутации</p>
    <p v-else-if="energy < CREDIT_COST" class="warning-text">⚠️ Нет сил на оформление кредита</p>
    <p v-else class="warning-text-placeholder">&nbsp;</p>
    <div v-if="debt > 0" class="repay-section">
      <label for="repay-amount">Сумма погашения:</label>
      <input
        id="repay-amount"
        type="number"
        :value="repayAmount"
        :min="REPAY_MIN_AMOUNT"
        :max="Math.min(debt, money)"
        :step="REPAY_MIN_AMOUNT"
        @input="onRepayInput"
      />
      <button @click="$emit('repay-debt', repayAmount)" :disabled="money < repayAmount || repayAmount < REPAY_MIN_AMOUNT">
        💸 Погасить {{ repayAmount }}₽ (+{{ Math.floor(repayAmount / REPAY_REPUTATION_INTERVAL) }}❤️)
      </button>
    </div>
    <div v-else class="repay-section-placeholder"></div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ money: number; debt: number; energy: number; reputation: number }>()

const CREDIT_COST = 15
const CREDIT_REPUTATION_LOSS = 2
const REPAY_MIN_AMOUNT = 1000
const REPAY_REPUTATION_INTERVAL = 1000

const repayAmount = ref(REPAY_MIN_AMOUNT)

// Автоматически подстраиваем сумму если долг меньше
watch(() => props.debt, (newDebt) => {
  if (newDebt > 0 && repayAmount.value > newDebt) {
    repayAmount.value = Math.min(newDebt, REPAY_MIN_AMOUNT)
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

.repay-section-placeholder {
  min-height: 140px;
}
</style>
