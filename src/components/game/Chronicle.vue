<template>
  <section id="chronicle-zone" class="chron" aria-labelledby="chron-title" tabindex="-1">
    <h3 id="chron-title" class="chron__title">
      <span class="vitrina-only">{{ CHRONICLE.title }}</span>
      <span class="honest honest-inline">{{ CHRONICLE.titleHonest }}</span>
    </h3>
    <p v-if="!rows.length" class="chron__empty">{{ CHRONICLE.empty }}</p>
    <ol v-else class="chron__list">
      <li v-for="row in visible" :key="row.id" class="chron__row" :class="`chron__row--${row.tone}`">
        <span class="chron__when tabular">{{ CHRONICLE.day(row.day) }} {{ row.time }}</span>
        <span class="chron__text">
          <span :class="{ 'vitrina-only': !!row.honest }">{{ row.text }}</span>
          <span v-if="row.honest" class="honest honest-inline">{{ row.honest }}</span>
        </span>
        <span v-if="row.net !== null" class="chron__net tabular" :class="row.net < 0 ? 'chron__net--minus' : 'chron__net--plus'">
          {{ signedMoney(row.net) }}₽
        </span>
      </li>
    </ol>
    <button v-if="rows.length > limit" type="button" class="chron__more" @click="expanded = !expanded">
      {{ expanded ? CHRONICLE.less : CHRONICLE.more }} ({{ rows.length }})
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GameEvent } from '@/game'
import { eventTone, formatEvent, formatEventHonest, money } from '@/i18n'
import { CHRONICLE } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'

/**
 * Хроника (ux-flows S10): день, время, операция, итог со знаком. В Изнанке — протокол (честные дубли).
 * День записи восстанавливается по событиям dayStarted (хроника хранит события, а не строки).
 */
const game = useGameStore()
const expanded = ref(false)
const limit = 8

function netOf(e: GameEvent): number | null {
  switch (e.type) {
    case 'spin':
      return e.payout - e.bet
    case 'shiftWorked':
      return e.pay
    case 'schemeResolved':
      return e.success ? e.amount : -e.fine
    case 'friendBorrowed':
    case 'loanTaken':
    case 'itemPawned':
      return e.amount
    case 'withdrawPaid':
      return e.net
    case 'itemRedeemed':
      return -e.cost
    case 'livingCostPaid':
      return -e.amount
    case 'billPaid':
      return -e.amount
    case 'debtRepaid':
      return e.viaBill ? null : -e.amount
    case 'casinoNight':
      return -e.lost
    default:
      return null
  }
}

const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : money(n))

const rows = computed(() => {
  const log = game.log
  // Новые записи — в начале; день считаем от старых к новым
  const days = new Array<number>(log.length)
  let day = 1
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i]!.event
    if (e.type === 'dayStarted') day = e.day
    days[i] = day
  }
  return log
    .map((entry, i) => {
      const text = formatEvent(entry.event, entry.id)
      if (!text) return null
      const d = new Date(entry.t)
      return {
        id: entry.id,
        day: days[i] ?? 1,
        time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        text,
        honest: formatEventHonest(entry.event),
        tone: eventTone(entry.event),
        net: netOf(entry.event)
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
})

const visible = computed(() => (expanded.value ? rows.value : rows.value.slice(0, limit)))
</script>

<style scoped>
.chron {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-4);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: rgba(11, 6, 32, 0.6);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.chron:focus {
  outline: 2px solid var(--c-focus);
}
.chron__title {
  font-family: var(--font-condensed);
  font-size: var(--fs-sm);
  letter-spacing: var(--ls-wide);
  color: var(--c-text-muted);
}
.chron__empty {
  color: var(--c-text-muted);
}
.chron__list {
  display: grid;
  gap: var(--sp-1);
}
.chron__row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--sp-2);
  align-items: baseline;
  padding: 2px 0;
  border-bottom: 1px dashed var(--c-line);
}
.chron__when {
  color: var(--c-text-fine);
}
.chron__text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.chron__row--rejected .chron__text {
  color: var(--c-gold);
  font-style: italic;
}
.chron__row--warn .chron__text {
  color: var(--c-alert-fg);
}
.chron__row--win .chron__text,
.chron__row--jackpot .chron__text {
  color: var(--c-win);
}
.chron__net {
  font-weight: 700;
  white-space: nowrap;
}
.chron__net--plus {
  color: var(--c-win);
}
.chron__net--minus {
  color: #ff8a9c;
}
.chron__more {
  justify-self: start;
  min-height: 36px;
  padding: 0 var(--sp-3);
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--c-text-muted);
}

[data-layer='iznanka'] .chron {
  background: var(--paper);
  color: var(--ink);
  border-color: var(--ink);
  border-radius: var(--r-paper);
}
[data-layer='iznanka'] .chron__title,
[data-layer='iznanka'] .chron__when,
[data-layer='iznanka'] .chron__more,
[data-layer='iznanka'] .chron__row .chron__text {
  color: var(--ink);
  font-style: normal;
}
[data-layer='iznanka'] .chron__net--plus {
  color: var(--stamp-green);
}
[data-layer='iznanka'] .chron__net--minus {
  color: var(--stamp-red);
}
[data-layer='iznanka'] .chron__row {
  border-color: var(--paper-line);
}
</style>
