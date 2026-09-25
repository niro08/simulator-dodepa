<template>
  <Modal :open="open" variant="paper" size="sm" :closable="false" :form-no="BILLS.formNo">
    <template #title>{{ bill ? BILLS.title(bill.week) : '' }}</template>
    <template v-if="bill && hud">
      <Stamp v-if="bill.status === 'deferred'" class="bl__stamp" :text="BILLS.overdue" size="sm" :animate="false" />
      <p class="bl__deadline">{{ BILLS.deadline }}</p>
      <dl class="bl__lines">
        <div class="dots">
          <dt>{{ BILLS.living }}</dt>
          <dd>{{ money(bill.fixed) }}₽</dd>
        </div>
        <div v-if="bill.total > bill.fixed" class="dots">
          <dt>{{ BILLS.debtPart }}</dt>
          <dd>{{ money(bill.total - bill.fixed) }}₽</dd>
        </div>
        <div class="dots bl__total">
          <dt>{{ BILLS.total }}</dt>
          <dd>{{ money(bill.total) }}₽</dd>
        </div>
      </dl>
      <p class="bl__wallet">
        {{ BILLS.wallet(hud.wallet) }}
        <strong :class="short > 0 ? 'minus' : 'plus'">{{ short > 0 ? BILLS.short(short) : BILLS.enough }}</strong>
      </p>
      <p v-if="short > 0" class="bl__where">{{ BILLS.where }}</p>

      <div class="bl__actions">
        <button
          type="button"
          class="paper-btn paper-btn--primary"
          :data-autofocus="!payReason || undefined"
          :aria-disabled="!!payReason || undefined"
          @click="!payReason && game.execute({ type: 'bills/pay' })"
        >
          {{ BILLS.pay(bill.total) }}
        </button>
        <p v-if="payReason" class="paper-reason">⚠ {{ payReason }}</p>
        <button
          type="button"
          class="paper-btn"
          :aria-disabled="!!game.actions.deferBill || undefined"
          @click="!game.actions.deferBill && game.execute({ type: 'bills/defer' })"
        >
          {{ BILLS.defer(deferTotal) }}
        </button>
        <p v-if="game.actions.deferBill" class="paper-reason">⚠ {{ BILLS.deferUsed }}</p>
        <button v-if="!hud.forcedEnd" type="button" class="paper-btn" :data-autofocus="payReason ? true : undefined" @click="game.execute({ type: 'day/resume' })">
          {{ BILLS.back }}
        </button>
        <button type="button" class="paper-btn bl__refuse" @click="refuse">{{ BILLS.refuse }}</button>
        <p class="bl__note">{{ BILLS.refuseNote }}</p>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatRejection, money } from '@/i18n'
import { BILLS } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import Modal from '@/components/ui/Modal.vue'
import Stamp from '@/components/ui/Stamp.vue'

/** S44 Счёт недели (фаза bills): платится только из кошелька. «Позже» — назад в день, если он не закончен тильтом. */
const game = useGameStore()
const B = game.config.balance
const hud = computed(() => game.hud)
const open = computed(() => game.phase === 'bills')
const bill = computed(() => hud.value?.bill ?? null)
const short = computed(() => (bill.value && hud.value ? Math.max(0, bill.value.total - hud.value.wallet) : 0))
const payReason = computed(() => (game.actions.payBill ? formatRejection('bills/pay', game.actions.payBill) : null))
const deferTotal = computed(() =>
  bill.value ? Math.ceil(bill.value.fixed * (1 + B.GRACE_PENALTY)) + (bill.value.total - bill.value.fixed) : 0
)

function refuse() {
  game.execute({ type: 'bills/refuse' })
}
</script>

<style scoped>
.bl__stamp {
  float: right;
}
.bl__deadline {
  font-weight: 700;
}
.bl__lines {
  display: grid;
  gap: var(--sp-1);
  margin: var(--sp-3) 0;
  font-size: var(--fs-sm);
}
.bl__lines dd {
  margin: 0;
}
.bl__total {
  font-weight: 700;
  font-size: var(--fs-md);
}
.bl__wallet,
.bl__where,
.bl__note {
  font-size: var(--fs-sm);
}
.bl__where,
.bl__note {
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.bl__actions {
  display: grid;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}
.bl__refuse {
  border-color: var(--stamp-red);
  color: var(--stamp-red);
  box-shadow: 2px 2px 0 var(--stamp-red);
}
</style>
