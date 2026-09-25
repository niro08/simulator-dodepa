<template>
  <MetaScreen
    :title="ACHIEVEMENTS_SCREEN.title"
    :counter="META.counter(openCount, total)"
    :counter-aria="META.counterAria(openCount, total)"
    width="lg"
  >
    <template #actions>
      <div class="ach-filter" role="radiogroup" :aria-label="ACHIEVEMENTS_SCREEN.filtersAria">
        <button
          v-for="f in FILTERS"
          :key="f"
          type="button"
          role="radio"
          class="ach-filter__btn"
          :aria-checked="filter === f"
          :tabindex="filter === f ? 0 : -1"
          @click="filter = f"
          @keydown.right.prevent="step(1)"
          @keydown.left.prevent="step(-1)"
        >
          {{ ACHIEVEMENTS_SCREEN.filters[f] }}
          <span class="ach-filter__n">{{ counts[f] }}</span>
        </button>
      </div>
    </template>

    <p v-if="openCount === 0" class="ach-empty paper">{{ ACHIEVEMENTS_SCREEN.empty }}</p>

    <ul class="ach-grid">
      <li
        v-for="a in shown"
        :key="a.id"
        class="ach paper"
        :class="{ 'ach--open': a.unlocked, 'ach--secret': a.secret }"
      >
        <div class="ach__medal" aria-hidden="true">{{ a.unlocked ? '🏆' : a.secret ? '❓' : '🔒' }}</div>
        <div class="ach__body">
          <p class="ach__title">
            <span>{{ text(a).title }}</span>
            <span v-if="a.secret" class="ach__secret-tag">{{ META.secret }}</span>
          </p>

          <template v-if="a.secret">
            <p class="ach__hint">{{ ACHIEVEMENTS_SCREEN.secretHint(text(a).desc) }}</p>
            <p v-if="a.rewards.length" class="ach__reward ach__reward--unknown">{{ ACHIEVEMENTS_SCREEN.secretReward }}</p>
          </template>
          <template v-else>
            <p class="ach__cond">{{ text(a).condition }}</p>
            <p v-if="a.unlocked" class="ach__desc">{{ text(a).desc }}</p>
            <p class="ach__honest">
              <span class="ach__honest-k">{{ ACHIEVEMENTS_SCREEN.honest }}</span> {{ text(a).honest }}
            </p>
            <ul v-if="a.rewards.length" class="ach__rewards">
              <li v-for="r in a.rewards" :key="r" class="ach__reward">{{ cosmeticChip(r) }}</li>
            </ul>
          </template>
        </div>

        <div class="ach__state">
          <template v-if="a.unlocked">
            <span class="ach__date">{{ ACHIEVEMENTS_SCREEN.unlockedOn(a.unlockedAt ? META.date(a.unlockedAt) : '') }}</span>
          </template>
          <template v-else-if="a.progress">
            <span class="ach__num">{{ ACHIEVEMENTS_SCREEN.progress(a.progress.current, a.progress.target) }}</span>
            <span
              class="ach__bar"
              role="progressbar"
              :aria-valuenow="a.progress.current"
              :aria-valuemin="0"
              :aria-valuemax="a.progress.target"
              :aria-label="text(a).title"
            >
              <span :style="{ width: `${Math.round((a.progress.current / a.progress.target) * 100)}%` }" />
            </span>
            <span class="ach__scope">{{ ACHIEVEMENTS_SCREEN.scope[a.progress.scope] }}</span>
          </template>
          <span v-else class="ach__locked">{{ META.locked }}</span>
        </div>
      </li>
    </ul>

    <p v-if="shown.length === 0" class="ach-empty paper">{{ ACHIEVEMENTS_SCREEN.noneInFilter }}</p>
    <p class="ach-foot">{{ ACHIEVEMENTS_SCREEN.foot }}</p>
  </MetaScreen>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { AchievementView } from '@/game'
import { achievementText } from '@/i18n'
import { ACHIEVEMENTS_SCREEN, META, cosmeticChip } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import MetaScreen from './MetaScreen.vue'

/**
 * S04 Достижения (ux-flows §6, systems-spec §4, content-pack §3). Порядок: открытые по дате (новые сверху),
 * закрытые с прогрессом (ближайшие к открытию сверху), закрытые без прогресса, секреты.
 * Честный подзаголовок Изнанки виден всегда (мета — зона честности); скрытые закрытые — «???» с намёком.
 */
const game = useGameStore()

const FILTERS = ['all', 'open', 'locked'] as const
type Filter = (typeof FILTERS)[number]
const filter = ref<Filter>('all')

const text = (a: AchievementView) => achievementText(a.id, a.secret)

function rank(a: AchievementView): number {
  if (a.unlocked) return 0
  if (a.secret) return 3
  return a.progress ? 1 : 2
}

const sorted = computed(() =>
  [...game.achievements].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    if (a.unlocked) return (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)
    if (a.progress && b.progress) return b.progress.current / b.progress.target - a.progress.current / a.progress.target
    return 0
  })
)

const total = computed(() => game.achievements.length)
const openCount = computed(() => game.achievements.filter((a) => a.unlocked).length)
const counts = computed<Record<Filter, number>>(() => ({
  all: total.value,
  open: openCount.value,
  locked: total.value - openCount.value
}))

const shown = computed(() =>
  sorted.value.filter((a) => filter.value === 'all' || (filter.value === 'open' ? a.unlocked : !a.unlocked))
)

/** Стрелки ←/→ внутри группы фильтров (roving tabindex). */
async function step(dir: 1 | -1) {
  const i = FILTERS.indexOf(filter.value)
  filter.value = FILTERS[(i + dir + FILTERS.length) % FILTERS.length] as Filter
  await nextTick()
  ;(document.querySelector('.ach-filter__btn[aria-checked="true"]') as HTMLElement | null)?.focus()
}
</script>

<style scoped>
.ach-filter {
  display: inline-flex;
  gap: 0;
  border: 2px solid var(--ink);
  border-radius: var(--r-xs);
  background: var(--paper-white);
  box-shadow: 2px 2px 0 var(--ink);
}
.ach-filter__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  min-height: var(--tap-min);
  padding: 0 var(--sp-3);
  border: 0;
  background: none;
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.ach-filter__btn + .ach-filter__btn {
  border-left: 1px solid var(--ink);
}
.ach-filter__btn[aria-checked='true'] {
  background: var(--ink);
  color: var(--paper-white);
}
.ach-filter__btn:focus-visible {
  outline: 2px solid var(--stamp-blue);
  outline-offset: -4px;
}
.ach-filter__n {
  font-weight: 400;
  opacity: 0.8;
}

.ach-empty {
  padding: var(--sp-3) var(--sp-4);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  color: var(--ink);
}

.ach-grid {
  display: grid;
  gap: var(--sp-3);
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
}
.ach {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: var(--sp-3);
  align-items: start;
  padding: var(--sp-3);
  border: 1px dashed var(--ink-muted);
  color: var(--ink);
}
.ach--open {
  border: 1px solid var(--ink);
  background: var(--paper-white);
  box-shadow: 3px 3px 0 var(--gold-deep, #b8860b);
}
.ach__medal {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--paper-2);
  font-family: var(--font-emoji);
  font-size: 22px;
}
.ach--open .ach__medal {
  background: var(--gold-bevel);
}
.ach__body {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.ach__title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--sp-2);
  font-family: var(--font-condensed);
  font-size: var(--fs-lg);
  font-weight: 700;
  line-height: var(--lh-snug);
}
.ach--secret .ach__title {
  font-family: var(--font-mono);
  letter-spacing: 0.2em;
}
.ach__secret-tag {
  padding: 0 6px;
  border: 1px solid var(--stamp-red);
  color: var(--stamp-red);
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  letter-spacing: 0.08em;
  transform: rotate(-3deg);
}
.ach__cond {
  font-size: var(--fs-sm);
  font-weight: 700;
}
.ach__desc {
  font-size: var(--fs-sm);
}
.ach__hint {
  font-family: var(--font-hand, var(--font-mono));
  font-size: var(--fs-md);
  color: var(--ink-muted);
}
.ach__honest {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--ink-muted);
  line-height: 1.45;
}
.ach__honest-k {
  font-weight: 700;
}
.ach__rewards {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}
.ach__reward {
  display: inline-block;
  padding: 1px var(--sp-2);
  border: 1px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--paper-2);
  font-size: var(--fs-xs);
}
.ach__reward--unknown {
  justify-self: start;
  border-style: dashed;
  color: var(--ink-muted);
}
.ach__state {
  display: grid;
  justify-items: end;
  gap: 4px;
  min-width: 72px;
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.ach__date {
  color: var(--stamp-green);
  font-weight: 700;
  white-space: nowrap;
}
.ach__num {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ach__bar {
  display: block;
  width: 72px;
  height: 8px;
  border: 1px solid var(--ink);
  background: var(--paper-white);
}
.ach__bar > span {
  display: block;
  height: 100%;
  background: var(--ink);
}
.ach__scope,
.ach__locked {
  color: var(--ink-muted);
  white-space: nowrap;
}
.ach-foot {
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}

@media (max-width: 599px) {
  .ach-grid {
    grid-template-columns: 1fr;
  }
  .ach {
    grid-template-columns: 36px 1fr;
    gap: var(--sp-2) var(--sp-3);
  }
  .ach__medal {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }
  .ach__state {
    grid-column: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px var(--sp-2);
  }
  .ach-filter {
    display: flex;
  }
  .ach-filter__btn {
    flex: 1;
    justify-content: center;
    padding: 0 var(--sp-2);
  }
}
</style>
