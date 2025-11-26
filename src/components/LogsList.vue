<template>
  <section class="panel logs">
    <header>
      <h2>Хроника додепа</h2>
    </header>
    <p v-if="!logs.length" class="muted empty-state">Тут появятся последние события...</p>
    <ul v-else>
      <li v-for="(entry, index) in logs" :key="index">
        {{ entry }}
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{ logs: string[] }>()
</script>

<style scoped>
.empty-state {
  text-align: center;
  padding: 2rem;
  font-style: italic;
}
</style>

