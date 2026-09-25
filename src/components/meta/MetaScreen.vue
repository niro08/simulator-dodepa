<template>
  <div class="meta" :class="`meta--${width}`">
    <header class="meta__head">
      <button ref="backBtn" type="button" class="paper-btn meta__back" @click="shell.goBackFromMeta()">
        {{ shell.metaReturn.value === 'game' && game.run ? COMMON.backToRun : COMMON.back }}
      </button>
      <h1 class="meta__title">{{ title }}</h1>
      <span v-if="counter" class="meta__count" :aria-label="counterAria">{{ counter }}</span>
      <div v-if="$slots.actions" class="meta__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { COMMON } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'

/**
 * Каркас экранов меты S03 Гардероб / S04 Достижения / S05 Концовки (ux-flows §6, голос «Бумага»):
 * «← Назад» (в меню или обратно в ран, если пришли с тоста), заголовок, счётчик N / M, слот фильтров.
 * Esc — то же, что «Назад» (App.vue). Фокус при входе — на «Назад».
 */
withDefaults(defineProps<{ title: string; counter?: string; counterAria?: string; width?: 'md' | 'lg' }>(), {
  counter: '',
  counterAria: undefined,
  width: 'md'
})

const game = useGameStore()
const shell = useShell()
const backBtn = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  backBtn.value?.focus()
  window.scrollTo(0, 0)
})
</script>

<style scoped>
.meta {
  min-height: 100vh;
  width: min(960px, 100%);
  margin: 0 auto;
  padding: var(--sp-4);
  display: grid;
  align-content: start;
  gap: var(--sp-4);
}
.meta--lg {
  width: min(1200px, 100%);
}
.meta__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--sp-2) var(--sp-3);
}
.meta__title {
  font-family: var(--font-display);
  font-size: var(--fs-2xl);
  text-transform: var(--tt-display);
  line-height: var(--lh-tight);
}
.meta__count {
  padding: 2px var(--sp-2);
  border-radius: var(--r-pill);
  background: var(--c-panel-2);
  color: var(--c-text);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.meta__actions {
  margin-left: auto;
}
@media (max-width: 599px) {
  .meta {
    padding: var(--sp-3);
    gap: var(--sp-3);
  }
  .meta__title {
    font-size: var(--fs-xl);
  }
  .meta__actions {
    margin-left: 0;
    flex-basis: 100%;
  }
}
</style>
