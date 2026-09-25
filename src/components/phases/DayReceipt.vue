<template>
  <section class="rc" aria-labelledby="rc-title">
    <article v-if="s.casinoNight" class="rc__night paper" aria-label="Ночь в казино">
      <h2 class="rc__night-title">🌃 {{ RECEIPT.casinoNightTitle }}</h2>
      <p>{{ RECEIPT.casinoNightBody(s.casinoNightLoss) }}</p>
      <p class="rc__night-count">
        {{ RECEIPT.casinoNightCounter(hud?.casinoNights ?? 0, hud?.casinoNightsMax ?? 3) }}
        <template v-if="hud && hud.casinoNights === hud.casinoNightsMax - 1"> {{ RECEIPT.casinoNightLast }}</template>
      </p>
    </article>

    <article class="rc__sheet paper fx-print">
      <header class="rc__head">
        <h2 id="rc-title" class="rc__title">{{ RECEIPT.title(s.day) }}</h2>
        <span class="rc__no">{{ RECEIPT.no(s.day) }}</span>
      </header>

      <h3 class="rc__part">{{ RECEIPT.dayPart }}</h3>
      <div class="dots">
        <span>{{ RECEIPT.earned }}</span>
        <span class="plus">+{{ money(s.earned) }}₽</span>
      </div>
      <div v-if="s.casinoWagered > 0" class="dots">
        <span>{{ RECEIPT.casino(s.casinoWagered, s.casinoPaidOut) }}</span>
        <span :class="casinoNet < 0 ? 'minus' : 'plus'">{{ signedMoney(casinoNet) }}₽</span>
      </div>

      <h3 class="rc__part">{{ RECEIPT.nightPart }}</h3>
      <div v-if="s.casinoNight" class="dots">
        <span>{{ RECEIPT.casinoNight }}</span>
        <span class="minus">−{{ money(s.casinoNightLoss) }}₽</span>
      </div>
      <div class="dots">
        <span>{{ RECEIPT.living }}</span>
        <span class="minus">−{{ money(s.livingCost) }}₽</span>
      </div>
      <div v-if="s.interest > 0" class="dots">
        <span>{{ RECEIPT.interest }}</span>
        <span class="minus">+{{ money(s.interest) }}₽ {{ RECEIPT.toDebt }}</span>
      </div>
      <div v-if="s.forcedMfo > 0" class="dots">
        <span>{{ RECEIPT.forcedMfo }}</span>
        <span class="minus">+{{ money(s.forcedMfo) }}₽ {{ RECEIPT.toDebt }}</span>
      </div>
      <div class="dots">
        <span>{{ RECEIPT.rep }}</span>
        <span>{{ signed(s.repDelta) }}</span>
      </div>
      <div class="dots">
        <span>{{ RECEIPT.tilt }}</span>
        <span>{{ signed(s.tiltDelta) }}</span>
      </div>
      <p v-if="s.eventRolled" class="rc__note">{{ RECEIPT.event }}</p>
      <p v-else-if="!s.casinoNight && s.interest === 0" class="rc__note">{{ RECEIPT.quiet }}</p>

      <hr class="rc__rule" />
      <div class="rc__totals">
        <div class="dots">
          <span>{{ RECEIPT.wallet }}</span>
          <span :class="{ minus: s.wallet < 0 }">{{ money(s.wallet) }}₽</span>
        </div>
        <div class="dots">
          <span>{{ RECEIPT.casinoBal }}</span>
          <span>{{ money(s.casino) }}₽</span>
        </div>
        <div class="dots">
          <span>{{ RECEIPT.debt }}</span>
          <span>{{ money(s.debt) }}₽</span>
        </div>
      </div>
      <Stamp v-if="s.wallet < 0" class="rc__stamp" :text="RECEIPT.walletMinus" size="sm" />
      <p v-if="hud?.bill" class="rc__bill">
        {{ LIFE.bill(hud.bill.daysLeft, hud.bill.week) }} · {{ money(hud.bill.total) }}₽
      </p>
      <p class="rc__sign">{{ RECEIPT.sign }}</p>

      <button ref="nextBtn" type="button" class="paper-btn paper-btn--primary rc__next" @click="wake">
        {{ RECEIPT.next(s.day + 1) }} <kbd>Enter</kbd>
      </button>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type { DaySummary } from '@/game'
import { money, signed } from '@/i18n'
import { LIFE, RECEIPT } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import Stamp from '@/components/ui/Stamp.vue'

/**
 * S43 Счёт дня (+ S45 «Ночь в казино» сверху): все изменения со знаком, ничего не списывается молча.
 * Витринные «выигрыши» не пересказываются — только нетто казино.
 */
const props = defineProps<{ summary: DaySummary }>()
const game = useGameStore()
const hud = computed(() => game.hud)
const s = computed(() => props.summary)
const casinoNet = computed(() => s.value.casinoPaidOut - s.value.casinoWagered)
const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : money(n))

const nextBtn = ref<HTMLElement | null>(null)
function wake() {
  game.execute({ type: 'day/wake' })
}
onMounted(async () => {
  await nextTick()
  nextBtn.value?.focus({ preventScroll: true })
})
</script>

<style scoped>
.rc {
  display: grid;
  justify-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5) var(--sp-3) var(--sp-7);
}
.rc__night {
  width: min(560px, 100%);
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-4);
  background: var(--paper-dark);
  color: var(--paper-dark-text);
}
.rc__night-title {
  font-family: var(--font-condensed);
  letter-spacing: var(--ls-wide);
}
.rc__night-count {
  color: var(--paper-dark-muted);
  font-size: var(--fs-sm);
}
.rc__sheet {
  position: relative;
  width: min(560px, 100%);
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-5) var(--sp-4);
  background: var(--paper-white);
  font-size: var(--fs-sm);
}
.rc__sheet::before,
.rc__sheet::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 8px;
  background: var(--perforation);
}
.rc__sheet::before {
  top: -8px;
  transform: rotate(180deg);
}
.rc__sheet::after {
  bottom: -8px;
}
.rc__head {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
  flex-wrap: wrap;
  padding-bottom: var(--sp-2);
  border-bottom: 1px dashed var(--ink);
}
.rc__title {
  font-size: var(--fs-md);
  font-weight: 700;
}
.rc__no {
  color: var(--ink-muted);
}
.rc__part {
  margin-top: var(--sp-3);
  font-size: var(--fs-xs);
  letter-spacing: var(--ls-wide);
  color: var(--ink-muted);
}
.rc__note,
.rc__sign {
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.rc__rule {
  width: 100%;
  border: 0;
  border-top: 1px dashed var(--ink);
  margin: var(--sp-3) 0 var(--sp-2);
}
.rc__totals {
  display: grid;
  gap: var(--sp-1);
  font-weight: 700;
}
.rc__stamp {
  justify-self: end;
}
.rc__bill {
  margin-top: var(--sp-2);
  font-weight: 700;
}
.rc__next {
  margin-top: var(--sp-4);
  width: 100%;
  min-height: 52px;
}
kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  font-weight: 400;
}
</style>
