<template>
  <section class="en paper" aria-labelledby="en-title" @keydown.enter="onEnter">
    <p class="en__kicker">{{ kicker }}</p>
    <h2 id="en-title" ref="titleEl" class="en__title" tabindex="-1">{{ title }}</h2>
    <p class="en__text">{{ text }}</p>
    <p class="en__why">{{ why }}</p>
    <button type="button" class="paper-btn paper-btn--primary en__btn" @click="emit('statement')">
      {{ ENDING_SCREEN.toStatement }} <kbd>Enter</kbd>
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { collectorsCause, ITEM_IDS, stat, weekOf, type EndingId, type Statement } from '@/game'
import { collectorsStatementLine, ENDINGS, endingTitle, fillPlaceholders, QUIT_GRADES } from '@/i18n'
import { ENDING_SCREEN } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'

/** S50 Концовка: тишина, fade 300 мс, механическая причина одной строкой. Фокус — заголовок. */
const props = defineProps<{ statement: Statement }>()
const emit = defineEmits<{ statement: [] }>()
const game = useGameStore()
const B = game.config.balance

const id = computed<EndingId | null>(() => props.statement.endingId)
const entry = computed(() => game.endingsCollection.find((e) => e.id === id.value))
const unlockedCount = computed(() => game.endingsCollection.filter((e) => e.unlocked).length)
const kicker = computed(() =>
  id.value ? ENDING_SCREEN.kicker(unlockedCount.value, game.endingsCollection.length || 7, entry.value?.count === 1) : ENDING_SCREEN.abandoned
)
const title = computed(() => (id.value ? endingTitle(id.value, props.statement.grade) : ENDING_SCREEN.abandoned))

const vars = computed(() => {
  const run = game.run
  const s = run?.stats ?? {}
  const count =
    id.value === 'jail' ? stat(s, 'schemes') : id.value === 'family_left' ? stat(s, 'friendLoans') : stat(s, 'itemsRedeemed')
  return {
    // «Коллекторы»: неделя неоплаченного счёта, а не текущего дня (QA-02)
    week: run && id.value === 'collectors' ? collectorsCause(run).week : weekOf(run?.day ?? 1),
    rep: run?.rep ?? 0,
    count,
    wallet: run?.wallet ?? 0,
    casino_balance: run?.casino ?? 0
  }
})

const text = computed(() => {
  if (!id.value) return ''
  const g = props.statement.grade
  const raw = id.value === 'quit' && g ? QUIT_GRADES[g].text : ENDINGS[id.value].text
  return fillPlaceholders(raw, vars.value)
})
/** «День 12 из 28» или «День 36 · неделя 6» в режиме «Ещё неделю» (QA-03). */
const dayLine = computed(() => {
  const days = props.statement.days
  return ENDING_SCREEN.dayLine(days, B.RUN_DAYS, props.statement.extraWeeks > 0 || days > B.RUN_DAYS ? weekOf(days) : undefined)
})
const why = computed(() => {
  if (!id.value) return ''
  const g = props.statement.grade
  if (id.value === 'quit' && g) {
    const run = game.run
    const owned = run ? ITEM_IDS.filter((i) => run.items[i] === 'owned').length : 0
    return `${dayLine.value} · ${ENDING_SCREEN.grade(g)}: ${ENDING_SCREEN.gradeWhy(owned, ITEM_IDS.length, run?.rep ?? 0, B.QUIT_GRADE_A_REP)}`
  }
  const line =
    id.value === 'collectors' && game.run
      ? collectorsStatementLine(collectorsCause(game.run))
      : fillPlaceholders(ENDINGS[id.value].statementLine, vars.value)
  return `${dayLine.value} · ${line}`
})

const titleEl = ref<HTMLElement | null>(null)
/** Enter на заголовке — к выписке (на кнопке Enter срабатывает нативно). */
function onEnter(event: KeyboardEvent) {
  if (event.target === titleEl.value) {
    event.preventDefault()
    emit('statement')
  }
}
onMounted(async () => {
  await nextTick()
  titleEl.value?.focus({ preventScroll: true })
})
</script>

<style scoped>
.en {
  width: min(640px, calc(100% - 24px));
  margin: var(--sp-7) auto;
  display: grid;
  gap: var(--sp-4);
  padding: var(--sp-6) var(--sp-5);
  text-align: center;
  animation: honest-in 300ms linear both;
}
.en__kicker {
  font-size: var(--fs-xs);
  letter-spacing: var(--ls-wide);
  color: var(--ink-muted);
}
.en__title {
  font-family: var(--font-condensed);
  font-size: var(--fs-3xl);
  text-transform: uppercase;
  line-height: var(--lh-tight);
}
.en__text {
  font-family: var(--font-body);
  font-size: var(--fs-md);
  line-height: var(--lh-body);
  text-align: left;
}
.en__why {
  padding-top: var(--sp-3);
  border-top: 1px dashed var(--ink);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.en__btn {
  justify-self: center;
  min-height: 52px;
}
kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  font-weight: 400;
}
</style>
