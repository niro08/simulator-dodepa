<template>
  <section class="panel logs">
    <header>
      <h2>Хроника додепа</h2>
    </header>
    <p v-if="!game.log.length" class="muted empty-state">Тут появятся последние события...</p>
    <ul v-else>
      <li v-for="entry in game.log" :key="entry.id" :class="`log-${eventTone(entry.event)}`">
        {{ formatEvent(entry.event) }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/game'
import { eventTone, formatEvent } from '@/i18n'

// Хроника — события ядра, текст строит i18n; отказы оформлены отдельно (TD-06)
const game = useGameStore()
</script>

<style scoped>
.log-rejected {
  color: var(--color-warning);
  opacity: 0.85;
  font-style: italic;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  font-style: italic;
}
</style>

