<template>
  <Modal
    :open="shell.exitStep.value > 0"
    variant="neon"
    size="sm"
    :title="step === 1 ? EXIT_CONFIRM.step1Title : EXIT_CONFIRM.step2Title"
    :closable="false"
  >
    <p class="ex__body">{{ step === 1 ? EXIT_CONFIRM.step1Body : EXIT_CONFIRM.step2Body }}</p>
    <p v-if="step === 2" class="ex__fine">{{ EXIT_CONFIRM.step2Fine }}</p>
    <div :key="step" class="ex__actions">
      <NeonButton variant="cta" size="lg" pulse @click="shell.exitStay()">
        {{ step === 1 ? EXIT_CONFIRM.step1Stay : EXIT_CONFIRM.step2Stay }}
      </NeonButton>
      <button type="button" class="ex__leave" data-autofocus @click="shell.exitLeave()">
        {{ step === 1 ? EXIT_CONFIRM.step1Leave : EXIT_CONFIRM.step2Leave }} <kbd>Esc</kbd>
      </button>
    </div>
    <!-- Разоблачение видно всегда, не только в режиме 👓 -->
    <p class="ex__honest">{{ step === 1 ? EXIT_CONFIRM.step1Honest : EXIT_CONFIRM.step2Honest }}</p>
  </Modal>
</template>

<script setup lang="ts">
import { computed, nextTick, watch } from 'vue'
import { EXIT_CONFIRM } from '@/i18n/ui'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'
import NeonButton from '@/components/ui/NeonButton.vue'

/**
 * S14 Выход из казино при 🔥 ≥ 70: два подтверждения (пародия). Фокус — на «уйти»,
 * Esc и Enter без перемещения фокуса = уйти. «Остаться» ничего не крутит само.
 */
const shell = useShell()
const step = computed(() => shell.exitStep.value)

// Второй шаг — тот же диалог: фокус снова на «уйти»
watch(step, async (s) => {
  if (s !== 2) return
  await nextTick()
  document.querySelector<HTMLElement>('.ex__leave')?.focus()
})
</script>

<style scoped>
.ex__body {
  font-size: var(--fs-md);
  font-weight: 700;
}
.ex__fine {
  font-size: var(--fs-sm);
  color: var(--c-text-muted);
}
.ex__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-3);
  margin: var(--sp-4) 0;
}
.ex__leave {
  min-height: var(--tap-min);
  padding: 0 var(--sp-3);
  border: 1px solid var(--c-line);
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}
.ex__leave kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
}
.ex__honest {
  padding: var(--sp-2);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
</style>
