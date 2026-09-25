<template>
  <Modal :open="open" variant="neon" size="md" :title="CASHIER.title" @update:open="(v) => !v && close()">
    <div class="cash__tabs" role="tablist" aria-label="Касса">
      <button
        id="cash-tab-dep"
        type="button"
        role="tab"
        class="cash__tab cash__tab--dep"
        :aria-selected="tab === 'deposit'"
        aria-controls="cash-panel"
        @click="tab = 'deposit'"
      >
        {{ CASHIER.tabDeposit }}
      </button>
      <button
        id="cash-tab-wd"
        type="button"
        role="tab"
        class="cash__tab cash__tab--wd"
        :aria-selected="tab === 'withdraw'"
        aria-controls="cash-panel"
        @click="tab = 'withdraw'"
      >
        {{ CASHIER.tabWithdraw }}
      </button>
    </div>

    <div v-if="hud" id="cash-panel" role="tabpanel" :aria-labelledby="tab === 'deposit' ? 'cash-tab-dep' : 'cash-tab-wd'" class="cash__panel">
      <template v-if="tab === 'deposit'">
        <p class="cash__from">{{ CASHIER.from(hud.wallet) }}</p>
        <template v-if="hud.wallet >= B.DEPOSIT_MIN">
          <label class="cash__amount">
            <span>{{ CASHIER.amount }}</span>
            <input
              v-model.number="depAmount"
              class="cash__input tabular"
              type="number"
              inputmode="numeric"
              :min="B.DEPOSIT_MIN"
              :max="hud.wallet"
              data-autofocus
              @change="clampDep"
              @keydown.enter.prevent="deposit"
            />
            <span>₽</span>
          </label>
          <div class="cash__chips">
            <button v-for="c in depChips" :key="c.label" type="button" class="cash__chip" @click="depAmount = c.value">{{ c.label }}</button>
          </div>
          <label v-if="bonusAvailable" class="cash__bonus">
            <input v-model="shell.bonusChecked.value" type="checkbox" />
            <span>
              <strong>{{ CASHIER.bonusCheck(bonusAmount) }}</strong>
              <span class="cash__fine">{{ CASHIER.bonusFine(bonusAmount * B.BONUS_WAGER_MULT) }}</span>
            </span>
          </label>
          <NeonButton
            variant="cta"
            size="lg"
            block
            :disabled="!!depReason"
            :disabled-reason="depReason ?? undefined"
            @click="deposit"
          >
            {{ CASHIER.depositCta(depAmount, withBonus ? bonusAmount : 0) }}
          </NeonButton>
          <p class="cash__after">{{ CASHIER.afterDeposit(hud.wallet - Math.max(0, depAmount), billHint) }}</p>
        </template>
        <template v-else>
          <p class="cash__empty">{{ CASHIER.emptyWallet }}</p>
          <NeonButton variant="secondary" @click="toLife">{{ CASHIER.openLife }}</NeonButton>
        </template>
        <p class="cash__honest">{{ CASHIER.honestDeposit }}</p>
      </template>

      <template v-else>
        <p class="cash__from">{{ CASHIER.withdrawFrom(hud.casino) }}</p>
        <label class="cash__amount">
          <span>{{ CASHIER.amount }}</span>
          <input
            v-model.number="wdAmount"
            class="cash__input tabular"
            type="number"
            inputmode="numeric"
            :min="B.WITHDRAW_MIN"
            :max="hud.casino"
            @keydown.enter.prevent="withdraw"
          />
          <span>₽ · {{ CASHIER.withdrawMin(B.WITHDRAW_MIN) }}</span>
        </label>
        <p class="cash__line">{{ CASHIER.withdrawFee(pct(B.WITHDRAW_FEE), wdFee, Math.max(0, wdAmount - wdFee)) }}</p>
        <p class="cash__line">{{ CASHIER.withdrawWhen(hud.day + 1) }}</p>
        <p v-if="hud.bill?.isToday" class="cash__warn">{{ CASHIER.withdrawBillToday }}</p>
        <p v-if="hud.bonus.state === 'active'" class="cash__warn">{{ CASHIER.withdrawLocked(hud.bonus.wagerLeft) }}</p>
        <NeonButton variant="secondary" :disabled="!!wdReason" :disabled-reason="wdReason ?? undefined" @click="withdraw">
          {{ CASHIER.withdrawCta }}
        </NeonButton>
        <div v-if="hud.withdrawals.length" class="cash__pending">
          <p class="cash__line"><strong>{{ CASHIER.pendingTitle }}</strong></p>
          <p v-for="(w, i) in hud.withdrawals" :key="i" class="cash__line">№{{ i + 1 }} {{ CASHIER.pending(w.net, w.arriveDay) }}</p>
        </div>
      </template>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatRejection } from '@/i18n'
import { CASHIER, pct } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'
import NeonButton from '@/components/ui/NeonButton.vue'

/**
 * S12 Касса. Асимметрия — пародия: депозит в один клик с подставленной суммой и галочкой бонуса,
 * вывод — бледная вкладка, минимум, комиссия, «утром». Условия написаны сразу, обычным шрифтом.
 */
const emit = defineEmits<{ deposited: []; toLife: [] }>()

const game = useGameStore()
const shell = useShell()
const B = game.config.balance
const hud = computed(() => game.hud)
const open = computed(() => shell.cashier.value !== null)
const tab = ref<'deposit' | 'withdraw'>('deposit')

watch(
  () => shell.cashier.value,
  (t) => {
    if (!t) return
    tab.value = t
    const wallet = hud.value?.wallet ?? 0
    depAmount.value = Math.max(B.DEPOSIT_MIN, Math.min(1000, wallet))
    wdAmount.value = Math.max(B.WITHDRAW_MIN, hud.value?.casino ?? 0)
  }
)

// ─── Депозит ───
const depAmount = ref(1000)
const depChips = computed(() => {
  const w = hud.value?.wallet ?? 0
  const list = [500, 1000]
    .filter((v) => v <= w)
    .map((v) => ({ label: `${v.toLocaleString('ru-RU')}`, value: v }))
  list.push({ label: CASHIER.wholeWallet(w), value: w })
  return list
})
const bonusAvailable = computed(() => hud.value?.bonus.state === 'available')
const withBonus = computed(() => bonusAvailable.value && shell.bonusChecked.value)
const bonusAmount = computed(() => Math.floor(Math.min(Math.max(0, depAmount.value), B.BONUS_DEPOSIT_CAP) * B.BONUS_MULT))
const depReason = computed(() => {
  const r = game.canExecute({ type: 'casino/deposit', amount: Math.floor(depAmount.value || 0), bonus: withBonus.value })
  return r ? formatRejection('casino/deposit', r) : null
})
const billHint = computed(() => (hud.value?.bill ? CASHIER.billHint(hud.value.bill.daysLeft, hud.value.bill.total) : ''))

function clampDep() {
  const w = hud.value?.wallet ?? 0
  depAmount.value = Math.max(B.DEPOSIT_MIN, Math.min(w, Math.floor(depAmount.value || 0)))
}

function deposit() {
  if (depReason.value) return
  const result = game.execute({ type: 'casino/deposit', amount: Math.floor(depAmount.value), bonus: withBonus.value })
  if (result?.ok) {
    shell.cashier.value = null
    emit('deposited')
  }
}

// ─── Вывод ───
const wdAmount = ref(1000)
const wdFee = computed(() => Math.floor(Math.max(0, wdAmount.value || 0) * B.WITHDRAW_FEE))
const wdReason = computed(() => {
  const r = game.canExecute({ type: 'casino/withdraw', amount: Math.floor(wdAmount.value || 0) })
  return r ? formatRejection('casino/withdraw', r) : null
})
function withdraw() {
  if (wdReason.value) return
  game.execute({ type: 'casino/withdraw', amount: Math.floor(wdAmount.value) })
}

function close() {
  shell.cashier.value = null
}
function toLife() {
  close()
  emit('toLife')
}
</script>

<style scoped>
.cash__tabs {
  display: flex;
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}
.cash__tab {
  min-height: var(--tap-min);
  padding: 0 var(--sp-4);
  border-radius: var(--r-sm);
  font-family: var(--font-display);
  font-weight: 700;
}
.cash__tab--dep {
  flex: 1;
  border: 2px solid var(--c-gold);
  background: transparent;
  color: var(--c-gold);
}
.cash__tab--dep[aria-selected='true'] {
  background: var(--c-cta-bg);
  color: var(--c-cta-text);
}
/* Вкладка вывода нарочно бледная — но контраст текста ≥ 4.5:1 */
.cash__tab--wd {
  border: 1px solid var(--c-line);
  background: transparent;
  color: var(--c-text-fine);
  font-family: var(--font-body);
  font-weight: 400;
  font-size: var(--fs-sm);
}
.cash__tab--wd[aria-selected='true'] {
  color: var(--c-text);
  border-color: var(--c-text-muted);
}
.cash__panel {
  display: grid;
  gap: var(--sp-3);
}
.cash__from,
.cash__line {
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}
.cash__amount {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2);
  font-size: var(--fs-sm);
}
.cash__input {
  width: 9ch;
  min-height: var(--tap-min);
  padding: 0 var(--sp-2);
  border: 2px solid var(--c-accent-2);
  border-radius: var(--r-sm);
  background: var(--c-page);
  font-family: var(--font-display);
  font-size: var(--fs-lg);
}
.cash__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
}
.cash__chip {
  min-height: 40px;
  padding: 0 var(--sp-3);
  border: 2px solid var(--c-accent-2);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--c-accent-2);
  font-weight: 700;
}
.cash__bonus {
  display: flex;
  gap: var(--sp-2);
  align-items: flex-start;
  padding: var(--sp-3);
  border: 2px dashed var(--c-accent-1);
  border-radius: var(--r-sm);
  font-size: var(--fs-sm);
}
.cash__bonus input {
  width: 22px;
  height: 22px;
  margin-top: 2px;
  accent-color: var(--c-accent-1);
}
.cash__fine {
  display: block;
  margin-top: var(--sp-1);
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}
.cash__after {
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}
.cash__empty,
.cash__warn {
  color: var(--c-gold);
  font-weight: 700;
  font-size: var(--fs-sm);
}
.cash__honest {
  padding-top: var(--sp-2);
  border-top: 1px dashed var(--c-line);
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.cash__pending {
  display: grid;
  gap: var(--sp-1);
}
</style>
