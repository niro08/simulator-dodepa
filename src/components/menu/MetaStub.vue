<template>
  <div class="meta">
    <header class="meta__head">
      <button ref="backBtn" type="button" class="paper-btn" @click="shell.go('menu')">{{ COMMON.back }}</button>
      <h1 class="meta__title">{{ text.title }}</h1>
      <span v-if="counter" class="meta__count">{{ counter }}</span>
    </header>

    <section class="meta__sheet paper">
      <p class="meta__empty">{{ text.empty }}</p>
      <p class="meta__note">{{ text.note }}</p>

      <ul v-if="kind === 'endings'" class="meta__endings">
        <li v-for="id in ENDING_IDS" :key="id" class="meta__ending" :class="{ 'meta__ending--open': !!game.profile.endings[id] }">
          <template v-if="game.profile.endings[id]">
            <span class="meta__ending-mark" aria-hidden="true">✓</span>
            <span>{{ ENDINGS[id].title }}</span>
            <span v-if="game.profile.endings[id]?.bestGrade" class="meta__ending-sub">
              лучшая: {{ game.profile.endings[id]?.bestGrade }}
            </span>
            <span class="meta__ending-sub">×{{ game.profile.endings[id]?.count }}</span>
          </template>
          <template v-else>
            <span class="meta__ending-mark" aria-hidden="true">▒</span>
            <span>??? — «{{ ENDINGS[id].lockedHint }}»</span>
          </template>
        </li>
      </ul>

      <p class="meta__soon">{{ META_STUB.soon }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ENDING_IDS } from '@/game'
import { ENDINGS } from '@/i18n'
import { COMMON, META_STUB } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'

/**
 * Заглушки S03 Гардероб / S04 Достижения / S05 Концовки (CD-16). Наполнит CD-19/CD-13,
 * когда в сторе появится API меты. Esc и «← Назад» — в меню.
 */
const props = defineProps<{ kind: 'wardrobe' | 'achievements' | 'endings' }>()

const game = useGameStore()
const shell = useShell()
const backBtn = ref<HTMLElement | null>(null)

const text = computed(() => META_STUB[props.kind])
const counter = computed(() => {
  if (props.kind === 'endings')
    return META_STUB.counter(game.endingsCollection.filter((e) => e.unlocked).length, game.endingsCollection.length)
  if (props.kind === 'achievements')
    return META_STUB.counter(game.achievements.filter((a) => a.unlocked).length, game.achievements.length)
  return ''
})

onMounted(async () => {
  await nextTick()
  backBtn.value?.focus()
})
</script>

<style scoped>
.meta {
  min-height: 100vh;
  width: min(880px, 100%);
  margin: 0 auto;
  padding: var(--sp-4);
  display: grid;
  align-content: start;
  gap: var(--sp-4);
}
.meta__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-3);
}
.meta__title {
  font-family: var(--font-display);
  font-size: var(--fs-2xl);
  text-transform: var(--tt-display);
}
.meta__count {
  font-family: var(--font-mono);
  color: var(--c-text-muted);
}
.meta__sheet {
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-5);
}
.meta__empty {
  font-weight: 700;
}
.meta__note,
.meta__soon {
  color: var(--ink-muted);
  font-size: var(--fs-sm);
}
.meta__endings {
  display: grid;
  gap: var(--sp-2);
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}
.meta__ending {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 1px dashed var(--ink-muted);
  font-size: var(--fs-sm);
}
.meta__ending--open {
  border-style: solid;
  border-color: var(--ink);
  background: var(--paper-white);
}
.meta__ending-sub {
  color: var(--ink-muted);
}
</style>
