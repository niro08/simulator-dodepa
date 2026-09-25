<template>
  <MetaScreen
    :title="ENDINGS_SCREEN.title"
    :counter="META.counter(openCount, game.endingsCollection.length)"
    :counter-aria="META.counterAria(openCount, game.endingsCollection.length)"
    width="lg"
  >
    <p class="end-intro">{{ ENDINGS_SCREEN.intro }} <span class="end-intro__note">{{ ENDINGS_SCREEN.hintNote }}</span></p>

    <ul class="end-grid">
      <li
        v-for="e in entries"
        :key="e.id"
        class="end paper"
        :class="{ 'end--open': e.unlocked, 'end--secret': !e.unlocked && isSecret(e) }"
      >
        <template v-if="e.unlocked">
          <p class="end__mark" aria-hidden="true">✓</p>
          <h2 class="end__title">{{ ENDINGS[e.id].title }}</h2>
          <p class="end__meta">
            <span>{{ ENDINGS_SCREEN.count(e.count) }}</span>
            <span v-if="e.firstAt">{{ ENDINGS_SCREEN.first(META.date(e.firstAt)) }}</span>
          </p>
          <div v-if="e.id === 'quit'" class="end__grades" role="group" :aria-label="ENDINGS_SCREEN.grades">
            <span
              v-for="g in GRADES"
              :key="g"
              class="end__grade"
              :class="{ 'end__grade--best': e.bestGrade === g }"
              :aria-label="e.bestGrade === g ? `${g}: ${ENDINGS_SCREEN.best}` : g"
            >{{ g }}</span>
            <span v-if="e.bestGrade" class="end__grade-note">{{ ENDINGS_SCREEN.best }}: {{ e.bestGrade }}</span>
          </div>
          <p v-if="e.achievementId" class="end__ach">{{ ENDINGS_SCREEN.achievement(achievementText(e.achievementId).title) }}</p>
          <button type="button" class="paper-btn end__read" @click="reading = e">{{ ENDINGS_SCREEN.read }}</button>
        </template>
        <template v-else>
          <p class="end__mark end__mark--locked" aria-hidden="true">▒▒</p>
          <h2 class="end__title end__title--locked">
            {{ isSecret(e) ? META.secret : META.unknown }}
          </h2>
          <p class="end__hint">«{{ ENDINGS[e.id].lockedHint }}»</p>
          <div v-if="e.id === 'quit'" class="end__grades" aria-hidden="true">
            <span v-for="g in GRADES" :key="g" class="end__grade">{{ g }}</span>
          </div>
        </template>
      </li>
    </ul>

    <Modal
      :open="reading !== null"
      variant="paper"
      size="md"
      :title="reading ? readTitle(reading) : ''"
      :form-no="ENDINGS_SCREEN.readTitle"
      @update:open="reading = null"
    >
      <p v-if="reading" class="end-read">{{ readText(reading) }}</p>
      <template #footer="{ close }">
        <button type="button" class="paper-btn" data-autofocus @click="close">{{ COMMON.close }} <kbd>Esc</kbd></button>
      </template>
    </Modal>
  </MetaScreen>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EndingCollectionEntry, Grade } from '@/game'
import { ENDINGS, QUIT_GRADES, achievementText, endingTitle } from '@/i18n'
import { COMMON, ENDINGS_SCREEN, META } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import Modal from '@/components/ui/Modal.vue'
import MetaScreen from './MetaScreen.vue'

/**
 * S05 Коллекция концовок (ux-flows §6, content-pack §1): 7 карточек в порядке приоритета GDD §3.9.
 * Открытые — название, сколько раз, «Читать» (текст концовки без Выписки); у «Завязал» — слоты оценок A/B/C.
 * Закрытые — «???» и подсказка-направление (lockedHint); секретная (её ачивка скрытая) — «СЕКРЕТ».
 */
const game = useGameStore()
const GRADES: readonly Grade[] = ['A', 'B', 'C']

// «Завязал» — первой: единственная хорошая (ux-flows S05), остальные — в порядке приоритета GDD §3.9
const entries = computed(() => [...game.endingsCollection].sort((a, b) => Number(b.id === 'quit') - Number(a.id === 'quit')))
const openCount = computed(() => game.endingsCollection.filter((e) => e.unlocked).length)
const reading = ref<EndingCollectionEntry | null>(null)

function isSecret(e: EndingCollectionEntry): boolean {
  return game.achievements.find((a) => a.id === e.achievementId)?.hidden ?? false
}

function readTitle(e: EndingCollectionEntry): string {
  return endingTitle(e.id, e.id === 'quit' ? e.bestGrade : null)
}

/** Текст концовки в режиме чтения: числа конкретного рана не хранятся — плейсхолдеры заменяем на «…». */
function readText(e: EndingCollectionEntry): string {
  const raw = e.id === 'quit' && e.bestGrade ? QUIT_GRADES[e.bestGrade].text : ENDINGS[e.id].text
  return raw.replace(/\{\w+\}/g, '…')
}
</script>

<style scoped>
.end-intro {
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}
.end-intro__note {
  color: var(--c-text-muted);
}
.end-grid {
  display: grid;
  gap: var(--sp-3);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.end {
  display: grid;
  align-content: start;
  gap: var(--sp-2);
  min-height: 200px;
  padding: var(--sp-4) var(--sp-3);
  border: 1px dashed var(--ink-muted);
  color: var(--ink);
}
.end--open {
  border: 1px solid var(--ink);
  background: var(--paper-white);
  box-shadow: 3px 3px 0 var(--stamp-green);
}
.end--secret {
  border-color: var(--stamp-red);
}
.end__mark {
  font-family: var(--font-mono);
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--stamp-green);
  line-height: 1;
}
.end__mark--locked {
  color: var(--ink-muted);
  letter-spacing: -0.1em;
}
.end__title {
  font-family: var(--font-condensed);
  font-size: var(--fs-lg);
  font-weight: 700;
  line-height: var(--lh-snug);
  text-transform: uppercase;
}
.end__title--locked {
  font-family: var(--font-mono);
  letter-spacing: 0.2em;
  color: var(--ink-muted);
}
.end--secret .end__title--locked {
  color: var(--stamp-red);
}
.end__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--ink-muted);
}
.end__hint {
  font-family: var(--font-hand, var(--font-mono));
  font-size: var(--fs-lg);
  line-height: 1.25;
  color: var(--ink);
}
.end__grades {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.end__grade {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px dashed var(--ink-muted);
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-weight: 700;
}
.end__grade--best {
  border: 3px double var(--stamp-red);
  color: var(--stamp-red);
  transform: rotate(-6deg);
}
.end__grade-note {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--ink-muted);
}
.end__ach {
  font-size: var(--fs-xs);
  color: var(--ink-muted);
}
.end__read {
  justify-self: start;
  margin-top: auto;
}
.end-read {
  font-size: var(--fs-md);
  line-height: 1.6;
  color: var(--ink);
}
@media (max-width: 1023px) {
  .end-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 599px) {
  .end-grid {
    grid-template-columns: 1fr;
    gap: var(--sp-2);
  }
  .end {
    min-height: 0;
    padding: var(--sp-3);
  }
}
</style>
