<template>
  <section class="st" aria-labelledby="st-title">
    <article class="st__sheet paper fx-print">
      <header class="st__head">
        <h2 id="st-title" ref="titleEl" class="st__title" tabindex="-1">{{ STATEMENT.title }}</h2>
        <span class="st__glasses">{{ STATEMENT.glassesOff }}</span>
      </header>
      <p>{{ s.title ? STATEMENT.holder(COSMETIC_NAMES[s.title] ?? s.title) : STATEMENT.holderDefault }}</p>
      <p>{{ STATEMENT.period(s.days, duration(s.playSec)) }}</p>
      <p v-if="endingLine" class="st__ending">{{ STATEMENT.ending(endingLine) }}</p>

      <h3 class="st__part">{{ STATEMENT.earned }}</h3>
      <div class="dots"><span>{{ STATEMENT.shifts }} ({{ stat(rs, 'shifts') }})</span><span>{{ money(stat(rs, 'shiftEarned')) }}₽</span></div>
      <div class="dots">
        <span>{{ STATEMENT.shady }} ({{ stat(rs, 'schemesSucceeded') }} / {{ stat(rs, 'schemes') }})</span>
        <span>{{ money(stat(rs, 'schemeEarned')) }}₽</span>
      </div>
      <div class="dots"><span>{{ STATEMENT.friends }} ({{ stat(rs, 'friendLoans') }})</span><span>{{ money(stat(rs, 'friendLoaned')) }}₽</span></div>

      <h3 class="st__part">{{ STATEMENT.casino }}</h3>
      <p v-if="s.spins === 0 && s.deposited === 0" class="st__muted">{{ STATEMENT.emptyCasino }}</p>
      <template v-else>
        <div class="dots"><span>{{ STATEMENT.spins }}</span><span>{{ s.spins }}</span></div>
        <div class="dots"><span>{{ STATEMENT.turnover }}</span><span>{{ money(stat(rs, 'totalWagered')) }}₽</span></div>
        <div class="dots"><span>{{ STATEMENT.won }}</span><span>{{ money(stat(rs, 'totalPaidOut')) }}₽</span></div>
        <div class="dots">
          <span>{{ STATEMENT.rtp }}</span>
          <span>{{ STATEMENT.rtpValue(s.rtpActual === null ? '—' : pct(s.rtpActual, 1), pct(s.rtpDeclared)) }}</span>
        </div>
        <div class="dots"><span>{{ STATEMENT.deposited }}</span><span>{{ money(s.deposited) }}₽</span></div>
        <div class="dots"><span>{{ STATEMENT.withdrawn }}</span><span>{{ money(s.withdrawnNet) }}₽</span></div>
        <div v-if="s.forfeited > 0" class="dots"><span>{{ STATEMENT.forfeited }}</span><span>{{ money(s.forfeited) }}₽</span></div>
        <div class="dots st__strong">
          <span>{{ STATEMENT.net }}</span>
          <span :class="s.casinoNetFinal < 0 ? 'minus' : 'plus'">{{ signedMoney(s.casinoNetFinal) }}₽</span>
        </div>
        <div class="dots"><span>{{ STATEMENT.ldw }}</span><span>{{ s.ldw }}</span></div>
        <div class="dots"><span>{{ STATEMENT.nearMiss }}</span><span>{{ s.nearMiss }}</span></div>
      </template>

      <h3 class="st__part">{{ STATEMENT.debts }}</h3>
      <div class="dots"><span>{{ STATEMENT.interest }}</span><span>{{ money(s.interestPaid) }}₽</span></div>
      <div v-if="s.billPenalties + s.schemeFines > 0" class="dots">
        <span>{{ STATEMENT.penalties }}</span><span>{{ money(s.billPenalties + s.schemeFines) }}₽</span>
      </div>
      <div class="dots"><span>{{ STATEMENT.bills }}</span><span>{{ stat(rs, 'billsPaid') }}</span></div>
      <div class="dots"><span>{{ STATEMENT.pawned }}</span><span>{{ stat(rs, 'itemsPawned') }} / {{ stat(rs, 'itemsRedeemed') }}</span></div>
      <div v-if="s.itemsLost.length" class="dots">
        <span>{{ STATEMENT.lost }}</span><span>{{ s.itemsLost.map((i) => ITEM_NAMES[i].split(' ')[0]).join(' ') }}</span>
      </div>
      <div class="dots"><span>{{ STATEMENT.tiltDays }}</span><span>{{ s.daysTilt70 }}</span></div>
      <div class="dots"><span>{{ STATEMENT.nights }}</span><span>{{ s.casinoNights }}</span></div>
      <div class="dots"><span>{{ STATEMENT.rep }}</span><span>{{ game.run?.rep ?? 0 }}</span></div>
      <div class="dots st__strong"><span>{{ STATEMENT.fullCost }}</span><span class="minus">{{ money(s.fullCost) }}₽</span></div>

      <hr class="st__rule" />
      <p class="st__net">{{ netLine }}</p>
      <template v-if="s.equivalents.length">
        <p>{{ STATEMENT.equivalentsTitle }}</p>
        <ul class="st__eq">
          <li v-for="eq in s.equivalents" :key="eq.id">— {{ eq.n }} {{ plural(eq.n, EQUIVALENT_FORMS[eq.id] ?? ['шт.', 'шт.', 'шт.']) }}</li>
        </ul>
      </template>

      <hr class="st__rule" />
      <h3 class="st__part">{{ STATEMENT.lifetimeTitle }}</h3>
      <p>{{ STATEMENT.lifetimeLost(Math.max(0, -s.lifetime.casinoNetFinal)) }}</p>
      <p>{{ STATEMENT.lifetimeRuns(s.lifetime.runs) }}</p>
      <p v-if="newAchievements.length" class="st__new">{{ STATEMENT.newAchievements }} {{ newAchievements.join(' · ') }}</p>

      <p class="st__closing">{{ closing }}</p>
      <p class="st__help">
        {{ STATEMENT.helpFooter }}
        <a :href="HELP_LINK.url" target="_blank" rel="noopener noreferrer">{{ HELP_LINK.text }}</a>
      </p>

      <div class="st__actions">
        <div class="st__action">
          <button type="button" class="paper-btn" @click="emit('again')">{{ STATEMENT.oneMore }}</button>
          <p class="st__fine">{{ STATEMENT.oneMoreFine }}</p>
        </div>
        <button type="button" class="paper-btn" @click="emit('menu')">{{ STATEMENT.toMenu }}</button>
      </div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { stat, type Statement } from '@/game'
import { achievementText, COSMETIC_NAMES, endingTitle, ITEM_NAMES, money } from '@/i18n'
import { duration, EQUIVALENT_FORMS, HELP_LINK, pct, plural, STATEMENT } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'

/**
 * S51 Выписка (CD-17, systems-spec §3.5): всегда Изнанка, моношрифт, тишина.
 * «Ещё ран?» и «В меню» одного веса; фокус — первая строка (сначала читают, потом решают).
 */
const props = defineProps<{ statement: Statement }>()
const emit = defineEmits<{ again: []; menu: [] }>()
const game = useGameStore()
const s = computed(() => props.statement)
const rs = computed(() => game.run?.stats ?? {})

const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : money(n))
const endingLine = computed(() => (s.value.endingId ? endingTitle(s.value.endingId, s.value.grade) : ''))
const netLine = computed(() => {
  const n = s.value.casinoNetFinal
  return n < 0 ? STATEMENT.netNegative(n) : n > 0 ? STATEMENT.netPositive(n) : STATEMENT.netZero
})
const newAchievements = computed(() => s.value.newAchievements.map((id) => achievementText(id).title))
const closing = computed(() => {
  let h = 0
  for (const ch of s.value.runId) h = (h * 31 + ch.charCodeAt(0)) | 0
  return STATEMENT.closing[Math.abs(h) % STATEMENT.closing.length]
})

const titleEl = ref<HTMLElement | null>(null)
onMounted(async () => {
  await nextTick()
  titleEl.value?.focus({ preventScroll: false })
})
</script>

<style scoped>
.st {
  display: grid;
  justify-items: center;
  padding: var(--sp-6) var(--sp-3) var(--sp-7);
}
.st__sheet {
  width: min(720px, 100%);
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-6) var(--sp-5);
  background: var(--paper-white);
  font-size: var(--fs-sm);
}
.st__head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--sp-2);
  padding-bottom: var(--sp-2);
  border-bottom: 2px solid var(--ink);
}
.st__title {
  font-size: var(--fs-lg);
  font-weight: 700;
}
.st__title:focus {
  outline: 2px dashed var(--ink);
  outline-offset: 4px;
}
.st__glasses {
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.st__ending {
  font-weight: 700;
}
.st__part {
  margin-top: var(--sp-4);
  font-size: var(--fs-xs);
  letter-spacing: var(--ls-wide);
}
.st__strong {
  font-weight: 700;
}
.st__muted,
.st__fine,
.st__closing {
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.st__rule {
  width: 100%;
  border: 0;
  border-top: 1px dashed var(--ink);
  margin: var(--sp-3) 0;
}
.st__net {
  font-size: var(--fs-md);
  font-weight: 700;
}
.st__eq {
  display: grid;
  gap: 2px;
}
.st__new {
  margin-top: var(--sp-2);
}
.st__closing {
  margin-top: var(--sp-4);
  font-style: italic;
}
.st__help a {
  color: var(--stamp-blue);
  font-weight: 700;
}
.st__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--sp-4);
  margin-top: var(--sp-5);
}
.st__action {
  display: grid;
  gap: var(--sp-1);
  max-width: 34ch;
}
.st__actions .paper-btn {
  min-width: 180px;
}
@media (max-width: 599px) {
  .st__action,
  .st__actions > .paper-btn,
  .st__action .paper-btn {
    width: 100%;
    max-width: none;
  }
}
</style>
