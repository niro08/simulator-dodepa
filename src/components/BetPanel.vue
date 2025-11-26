<template>
  <section class="panel" :class="{ secondary: secondary }">
    <header>
      <h2>Размер ставки</h2>
    </header>
    <input
      type="number"
      :value="modelValue"
      min="50"
      step="50"
      @input="onInput($event.target as HTMLInputElement)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ bet: number; secondary?: boolean }>()
const emit = defineEmits<{ 'update:bet': [value: number] }>()

const modelValue = computed({
  get: () => props.bet,
  set: (value: number) => emit('update:bet', value)
})

const secondary = computed(() => Boolean(props.secondary))

function onInput(target: HTMLInputElement) {
  const value = Number(target.value)
  modelValue.value = value
}
</script>

<style scoped>
.panel {
  background: rgba(20, 20, 30, 0.9);
  border-radius: 1rem;
  padding: 1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
}
.panel.secondary {
  background: rgba(15, 15, 25, 0.85);
}
header {
  margin-bottom: 0.5rem;
}
input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
}
</style>
