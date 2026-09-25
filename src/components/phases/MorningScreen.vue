<template>
  <section class="mo paper" aria-labelledby="mo-title">
    <h2 id="mo-title">{{ MORNING.title(day) }}</h2>
    <p>{{ MORNING.body }}</p>
    <button ref="btn" type="button" class="paper-btn paper-btn--primary" @click="game.execute({ type: 'day/wake' })">
      {{ MORNING.cta(day) }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { MORNING } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'

/** Фаза morning: обычно проходит сама (newGame будит сразу); экран — на случай сейва «до пробуждения». */
const game = useGameStore()
const day = computed(() => game.hud?.day ?? 1)
const btn = ref<HTMLElement | null>(null)
onMounted(() => btn.value?.focus())
</script>

<style scoped>
.mo {
  width: min(480px, calc(100% - 24px));
  margin: var(--sp-7) auto;
  display: grid;
  gap: var(--sp-3);
  padding: var(--sp-5);
}
</style>
