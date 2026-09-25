<template>
  <section class="panel bank">
    <header>
      <h2>Банк</h2>
      <p class="muted">Управляй кредитами и долгами</p>
    </header>
    <div class="info">
      <p>💼 На руках: <strong>{{ game.view.money }} ₽</strong></p>
      <p>💳 Долг: <strong>{{ game.view.debt }} ₽</strong></p>
    </div>
    <div class="buttons">
      <button @click="game.execute({ type: 'bank/credit' })" :disabled="!!creditBlock">
        🏦 Взять кредит (-{{ credit.energyCost }}⚡, {{ signed(credit.reputationDelta) }}❤️)
      </button>
    </div>
    <p v-if="creditBlock" class="warning-text">⚠️ {{ formatRejection('bank/credit', creditBlock) }}</p>
    <p v-else class="warning-text-placeholder">&nbsp;</p>
    <div v-if="game.view.debt > 0" class="repay-section">
      <label for="repay-amount">Сумма погашения:</label>
      <input
        id="repay-amount"
        type="number"
        :value="repayDraft"
        :min="repayMin"
        :max="Math.max(repayMin, Math.min(game.view.debt, game.view.money))"
        :step="repay.minAmount"
        @input="onRepayInput"
        @change="normalizeRepayDraft"
      />
      <button @click="repayDebt" :disabled="isRejection(repayPlan)">
        💸 Погасить {{ repayLabel.amount }}₽ (+{{ repayLabel.reputationGain }}❤️)
      </button>
    </div>
    <div v-else class="repay-section-placeholder"></div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isRejection, minRepayAmount, planRepay, type RepayPlan, type Rejection } from '@/game'
import { useGameStore } from '@/stores/game'
import { formatRejection, signed } from '@/i18n'

const game = useGameStore()
const { credit, repay } = game.config.balance.bank

const creditBlock = computed(() => game.canExecute({ type: 'bank/credit' }))

// Черновик суммы: пока вводят — любое число, на change нормализуем (TD-09)
const repayDraft = ref<number>(repay.minAmount)
const repayMin = computed(() => minRepayAmount(game.view.debt, game.config))

const repayPlan = computed<RepayPlan | Rejection>(() =>
  game.run ? planRepay(game.run, repayDraft.value, game.config) : { reason: 'noDebt' }
)

// Подпись кнопки: нормализованная ядром сумма, иначе то, что ввели
const repayLabel = computed<RepayPlan>(() => {
  const plan = repayPlan.value
  if (!isRejection(plan)) return plan
  const amount = Number.isFinite(repayDraft.value) ? Math.max(0, Math.floor(repayDraft.value)) : 0
  return { amount, reputationGain: Math.floor(amount / repay.reputationPerAmount) }
})

// Долг изменился — подстраиваем сумму (остаток < минимума гасится целиком, B-08)
watch(
  () => game.view.debt,
  (debt) => {
    if (debt > 0 && (repayDraft.value > debt || repayDraft.value < repayMin.value)) {
      repayDraft.value = repayMin.value
    }
  },
  { immediate: true }
)

function onRepayInput(event: Event) {
  const target = event.target as HTMLInputElement
  repayDraft.value = Number(target.value)
}

function normalizeRepayDraft() {
  const plan = repayPlan.value
  repayDraft.value = isRejection(plan) ? repayMin.value : plan.amount
}

function repayDebt() {
  game.execute({ type: 'bank/repay', amount: repayDraft.value })
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
