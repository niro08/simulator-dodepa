<template>
  <section class="proto paper" :aria-labelledby="titleId">
    <header class="proto__head">
      <h3 :id="titleId" class="proto__title">
        {{ PROTOCOL.title }} · <span class="proto__sub">{{ hud ? PROTOCOL.day(hud.day) : '' }}</span>
      </h3>
      <div class="proto__scope" role="radiogroup" aria-label="Период">
        <button type="button" role="radio" :aria-checked="scope === 'run'" @click="scope = 'run'">{{ PROTOCOL.scopeRun }}</button>
        <button type="button" role="radio" :aria-checked="scope === 'all'" @click="scope = 'all'">{{ PROTOCOL.scopeAll }}</button>
      </div>
    </header>
    <p v-if="scope === 'all' && firstRun" class="proto__note">{{ PROTOCOL.firstRun }}</p>

    <p v-if="data.spins === 0" class="proto__empty">{{ PROTOCOL.empty }}</p>
    <table v-else class="proto__table">
      <tbody>
        <tr>
          <th scope="row">{{ PROTOCOL.spins }}</th>
          <td>{{ data.spins }}</td>
        </tr>
        <tr>
          <th scope="row">{{ PROTOCOL.wagered }}</th>
          <td>{{ money(data.wagered) }}₽</td>
        </tr>
        <tr>
          <th scope="row">{{ PROTOCOL.paidOut }}</th>
          <td>{{ money(data.paidOut) }}₽</td>
        </tr>
        <tr>
          <th scope="row">{{ PROTOCOL.rtp }}</th>
          <td>{{ PROTOCOL.rtpValue(data.rtp === null ? '—' : pct(data.rtp), pct(rtpDeclared)) }}</td>
        </tr>
        <tr class="proto__total">
          <th scope="row">{{ PROTOCOL.net }}</th>
          <td :class="data.net < 0 ? 'minus' : 'plus'">
            {{ data.net > 0 ? '+' : '' }}{{ money(data.net) }}₽
            <span v-if="shawarma > 0" class="proto__eq">{{ PROTOCOL.netEq(shawarma) }}</span>
          </td>
        </tr>
        <tr>
          <th scope="row">{{ PROTOCOL.ldw }}</th>
          <td>{{ data.ldw }} <span class="proto__eq">— {{ PROTOCOL.ldwNote }}</span></td>
        </tr>
        <tr>
          <th scope="row">{{ PROTOCOL.nearMiss }}</th>
          <td>{{ data.nearMiss }} <span class="proto__eq">— {{ PROTOCOL.nearMissNote }}</span></td>
        </tr>
        <tr>
          <th scope="row">{{ PROTOCOL.winsShown }}</th>
          <td>{{ data.winsShowcase }} / {{ data.winsReal }}</td>
        </tr>
      </tbody>
    </table>

    <ul v-if="scope === 'run' && ub" class="proto__lines">
      <li v-if="ub.bonus">
        {{ PROTOCOL.bonus(ub.bonus.wagered, ub.bonus.wagerReq) }} ·
        {{ PROTOCOL.bonusExpected(ub.bonus.forecast.expectedLeft, pct(ub.bonus.forecast.pClear)) }}
      </li>
      <li>{{ PROTOCOL.withdrawable(ub.casino.withdrawable) }}</li>
      <li v-if="ub.casino.spins > 0">{{ PROTOCOL.luck(ub.casino.luck) }}</li>
      <li>{{ PROTOCOL.tilt(ub.tilt.value) }}</li>
      <li v-if="ub.debt.total > 0 || ub.debt.interestPaid > 0">
        {{ PROTOCOL.debt(ub.debt.total, ub.debt.interestTonight, ub.debt.interestPaid) }} · {{ PROTOCOL.mfoApr(pct(ub.debt.mfoApr)) }}
      </li>
      <li v-if="pawned + lostItems > 0">{{ PROTOCOL.items(pawned, lostItems) }}</li>
      <li>{{ PROTOCOL.nights(ub.casinoNights.n, ub.casinoNights.max) }}</li>
      <li v-if="ub.time.casinoHours > 0">{{ PROTOCOL.hours(ub.time.casinoHours, ub.time.unnoticedHours) }}</li>
      <li>{{ PROTOCOL.time(duration(playSec)) }} · {{ clock }}</li>
    </ul>
    <p v-else-if="scope === 'all'" class="proto__lines">{{ PROTOCOL.lifetimeLost(Math.max(0, -allNet)) }}</p>

    <p class="proto__help">
      {{ DISCLAIMER.help }}
      <a :href="HELP_LINK.url" target="_blank" rel="noopener noreferrer">{{ HELP_LINK.text }}</a>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useId } from 'vue'
import { casinoNetFinal, rtpActual, stat } from '@/game'
import { money } from '@/i18n'
import { DISCLAIMER, duration, HELP_LINK, pct, PROTOCOL } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'

/**
 * Протокол Изнанки (ux-flows S10i, systems-spec §3.4): честные цифры из store.underbelly,
 * «Всё время» — из profile.stats. Реальные часы — рядом (CV: время не прячем).
 */
const titleId = `proto-${useId()}`
const game = useGameStore()
const hud = computed(() => game.hud)
const ub = computed(() => game.underbelly)
const scope = ref<'run' | 'all'>('run')
const rtpDeclared = computed(() => ub.value?.slot.rtpDeclared ?? 0.9)
const firstRun = computed(() => stat(game.profile.stats, 'runsFinished') === 0)
const allNet = computed(() => casinoNetFinal(game.profile.stats))
const playSec = computed(() => (game.run ? stat(game.run.stats, 'playSec') : 0))

const data = computed(() => {
  if (scope.value === 'all') {
    const s = game.profile.stats
    return {
      spins: stat(s, 'spins'),
      wagered: stat(s, 'totalWagered'),
      paidOut: stat(s, 'totalPaidOut'),
      rtp: rtpActual(s),
      net: casinoNetFinal(s),
      ldw: stat(s, 'ldw'),
      nearMiss: stat(s, 'nearMiss'),
      winsShowcase: stat(s, 'winsShowcase'),
      winsReal: stat(s, 'winsReal')
    }
  }
  const c = ub.value?.casino
  return {
    spins: c?.spins ?? 0,
    wagered: c?.totalWagered ?? 0,
    paidOut: c?.totalPaidOut ?? 0,
    rtp: c?.rtpActual ?? null,
    net: c?.casinoNetLive ?? 0,
    ldw: c?.ldw ?? 0,
    nearMiss: c?.nearMiss ?? 0,
    winsShowcase: c?.winsShowcase ?? 0,
    winsReal: c?.winsReal ?? 0
  }
})

const SHAWARMA = game.config.stats.EQUIVALENTS.find((e) => e.id === 'EQ_SHAWARMA')?.price
const shawarma = computed(() =>
  typeof SHAWARMA === 'number' && data.value.net < 0 ? Math.floor(-data.value.net / SHAWARMA) : 0
)
const pawned = computed(() => ub.value?.items.filter((i) => i.status === 'pawned').length ?? 0)
const lostItems = computed(() => ub.value?.items.filter((i) => i.status === 'sold').length ?? 0)

// Реальные часы: минутная точность, без мигания
const now = ref(new Date())
const timer = setInterval(() => (now.value = new Date()), 30_000)
onBeforeUnmount(() => clearInterval(timer))
const clock = computed(() => `${String(now.value.getHours()).padStart(2, '0')}:${String(now.value.getMinutes()).padStart(2, '0')}`)
</script>

<style scoped>
.proto {
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-4);
  font-size: var(--fs-sm);
}
.proto__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--sp-2);
}
.proto__title {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
  text-transform: uppercase;
}
.proto__sub {
  font-weight: 400;
  text-transform: none;
}
.proto__scope {
  display: inline-flex;
  border: 2px solid var(--ink);
}
.proto__scope button {
  min-height: 36px;
  padding: 0 var(--sp-3);
  border: 0;
  background: var(--paper-white);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.proto__scope button[aria-checked='true'] {
  background: var(--ink);
  color: var(--paper-white);
}
.proto__table {
  width: 100%;
  border-collapse: collapse;
}
.proto__table th {
  padding: 3px 0;
  text-align: left;
  font-weight: 400;
  border-bottom: 1px dotted var(--ink-muted);
}
.proto__table td {
  padding: 3px 0 3px var(--sp-3);
  text-align: right;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  border-bottom: 1px dotted var(--ink-muted);
}
.proto__total th,
.proto__total td {
  font-weight: 700;
  font-size: var(--fs-md);
  border-bottom: 2px solid var(--ink);
}
.proto__eq {
  display: block;
  font-size: var(--fs-xs);
  font-weight: 400;
  color: var(--ink-muted);
}
.proto__lines {
  display: grid;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
}
.proto__lines li::before {
  content: '— ';
}
.proto__empty,
.proto__note {
  color: var(--ink-muted);
}
.proto__help {
  padding-top: var(--sp-2);
  border-top: 1px dashed var(--ink-muted);
  font-size: var(--fs-xs);
}
.proto__help a {
  color: var(--stamp-blue);
  font-weight: 700;
}
</style>
