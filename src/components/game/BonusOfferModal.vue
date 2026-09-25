<template>
  <Modal :open="shell.bonusOffer.value" variant="neon" size="md" :title="BONUS_OFFER.title" @update:open="(v) => !v && decline()">
    <p class="bo__body">{{ BONUS_OFFER.body(example, example * (1 + B.BONUS_MULT)) }}</p>
    <p class="bo__timer">⏱ {{ BONUS_OFFER.timer }}</p>
    <div class="bo__actions">
      <NeonButton variant="hot" size="lg" skew @click="take">{{ BONUS_OFFER.take }}</NeonButton>
      <NeonButton variant="secondary" size="lg" data-autofocus @click="decline">{{ BONUS_OFFER.decline }}</NeonButton>
    </div>
    <div class="bo__terms">
      <p>{{ BONUS_OFFER.termsTitle }}</p>
      <ul>
        <li v-for="(t, i) in terms" :key="i">{{ t }}</li>
      </ul>
      <p class="bo__honest">{{ BONUS_OFFER.honest }}</p>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { BONUS_OFFER } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'
import NeonButton from '@/components/ui/NeonButton.vue'

/**
 * S13 Бонус 200%. Обе кнопки работают. Фокус по умолчанию — «Без бонуса»:
 * Витрина кричит «ЗАБРАТЬ», клавиатура в ловушку не толкает.
 */
const game = useGameStore()
const shell = useShell()
const B = game.config.balance
const example = 1000
const terms = computed(() => BONUS_OFFER.terms(B.BONUS_MULT, B.BONUS_DEPOSIT_CAP, B.BONUS_WAGER_MULT, B.BONUS_MAX_BET))

function take() {
  shell.bonusChecked.value = true
  shell.bonusOffer.value = false
  shell.openCashier('deposit')
}
function decline() {
  shell.bonusChecked.value = false
  shell.bonusOffer.value = false
}
</script>

<style scoped>
.bo__body {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  font-weight: 700;
}
.bo__timer {
  color: var(--c-gold);
  font-weight: 700;
}
.bo__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
  margin: var(--sp-4) 0;
}
.bo__terms {
  display: grid;
  gap: var(--sp-1);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-line);
  font-size: var(--fs-sm);
}
.bo__terms ul {
  padding-left: var(--sp-5);
  list-style: disc;
}
.bo__honest {
  margin-top: var(--sp-2);
  font-family: var(--font-mono);
  color: var(--c-text-muted);
}
</style>
