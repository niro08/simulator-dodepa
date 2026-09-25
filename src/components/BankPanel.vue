<template>
  <section class="panel bank">
    <header>
      <h2>Деньги</h2>
      <p class="muted">Счета, банк, МФО</p>
    </header>

    <div class="info">
      <p>💼 Кошелёк: <strong>{{ money(hud?.wallet ?? 0) }} ₽</strong></p>
      <p>💳 Долг: <strong>{{ money(hud?.debt ?? 0) }} ₽</strong></p>
      <p v-if="hud?.debt">Проценты за ночь: <strong>≈{{ money(hud.interestTonight) }} ₽</strong></p>
    </div>

    <div v-if="hud?.bill" class="button-with-warning">
      <button @click="game.execute({ type: 'bills/pay' })" :disabled="!!game.actions.payBill">
        🧾 Оплатить счёт {{ money(hud.bill.total) }}₽
      </button>
      <p v-if="game.actions.payBill" class="warning-text">⚠️ {{ formatRejection('bills/pay', game.actions.payBill) }}</p>
    </div>

    <div class="buttons">
      <button @click="game.execute({ type: 'bank/loan' })" :disabled="!!game.actions.bankLoan">
        🏦 Кредит {{ money(B.BANK_LOAN) }}₽
      </button>
      <button @click="game.execute({ type: 'mfo/loan' })" :disabled="!!game.actions.mfoLoan">
        ⚡ МФО {{ money(B.MFO_LOAN) }}₽
      </button>
    </div>
    <p v-if="game.actions.bankLoan" class="warning-text">⚠️ {{ formatRejection('bank/loan', game.actions.bankLoan) }}</p>
    <p v-else class="warning-text-placeholder">&nbsp;</p>

    <div v-if="(hud?.debt ?? 0) > 0" class="repay-section">
      <label for="repay-amount">Сумма погашения:</label>
      <input
        id="repay-amount"
        type="number"
        :value="repayDraft"
        :min="repayMin"
        :max="Math.max(repayMin, Math.min(hud?.debt ?? 0, hud?.wallet ?? 0))"
        :step="B.REPAY_MIN"
        @input="onRepayInput"
        @change="normalizeRepayDraft"
      />
      <button @click="repayDebt" :disabled="isRejection(repayPlan)">💸 Погасить {{ money(repayLabel) }}₽</button>
      <p v-if="isRejection(repayPlan)" class="warning-text">⚠️ {{ formatRejection('debt/repay', repayPlan) }}</p>
    </div>
    <div v-else class="repay-section-placeholder"></div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { debtOf, isRejection, minRepayAmount, planRepay, type RepayPlan, type Rejection } from '@/game'
import { useGameStore } from '@/stores/game'
import { formatRejection, money } from '@/i18n'

const game = useGameStore()
const B = game.config.balance
const hud = computed(() => game.hud)

// Черновик суммы: пока вводят — любое число, на change нормализуем (TD-09)
const repayDraft = ref<number>(B.REPAY_MIN)
const repayMin = computed(() => minRepayAmount(hud.value?.debt ?? 0, game.config))
const repayPlan = computed<RepayPlan | Rejection>(() =>
  game.run ? planRepay(game.run, repayDraft.value, game.config) : { reason: 'no_debt' }
)

// Подпись кнопки: нормализованная ядром сумма, иначе то, что ввели
const repayLabel = computed<number>(() => {
  const plan = repayPlan.value
  if (!isRejection(plan)) return plan.amount
  return Number.isFinite(repayDraft.value) ? Math.max(0, Math.floor(repayDraft.value)) : 0
})

// Долг изменился — подстраиваем сумму (остаток < минимума гасится целиком, B-08)
watch(
  () => (game.run ? debtOf(game.run) : 0),
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
  game.execute({ type: 'debt/repay', amount: repayDraft.value })
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

.button-with-warning {
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

.repay-section-placeholder {
  min-height: 140px;
}
</style>
