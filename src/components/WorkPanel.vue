<template>
  <section class="panel work">
    <header>
      <h2>Жизнь</h2>
      <p class="muted">Смена, темка, семья</p>
    </header>

    <p>⚡ {{ hud?.energy }} | ❤️ {{ hud?.rep }} | 🔥 {{ hud?.tilt }}</p>

    <div class="button-with-warning">
      <button @click="game.execute({ type: 'work/shift' })" :disabled="!!game.actions.shift">
        💼 Смена ≈{{ money(hud?.shiftPay ?? 0) }}₽ (−{{ B.SHIFT_ENERGY }}⚡)
      </button>
      <p v-if="game.actions.shift" class="warning-text">⚠️ {{ formatRejection('work/shift', game.actions.shift) }}</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>

    <div class="button-with-warning">
      <button @click="game.execute({ type: 'work/shady' })" :disabled="!!game.actions.shady" class="shady-button">
        😈 Темка (−{{ B.SHADY_ENERGY }}⚡, {{ signed(B.SHADY_REP) }}❤️, {{ pct(B.SHADY_SUCCESS) }} успех)
      </button>
      <p v-if="game.actions.shady" class="warning-text">⚠️ {{ formatRejection('work/shady', game.actions.shady) }}</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>

    <div class="button-with-warning">
      <button @click="game.execute({ type: 'family/help' })" :disabled="!!game.actions.family">
        🏡 Помочь семье (−{{ B.FAMILY_ENERGY }}⚡, {{ signed(B.FAMILY_REP) }}❤️, 🔥 −{{ B.TILT_FAMILY }})
      </button>
      <p v-if="game.actions.family" class="warning-text">⚠️ {{ formatRejection('family/help', game.actions.family) }}</p>
      <p v-else class="warning-text-placeholder">&nbsp;</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { formatRejection, money, signed } from '@/i18n'

const game = useGameStore()
// Числа — из конфига баланса, доступность — из ядра (TD-04)
const B = game.config.balance
const hud = computed(() => game.hud)
const pct = (x: number) => `${Math.round(x * 100)}%`
</script>

<style scoped>
.panel.work {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel.work > p {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  text-align: center;
  font-weight: 600;
}

.button-with-warning {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.button-with-warning button {
  width: 100%;
}

.shady-button {
  background: linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%) !important;
}

.shady-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%) !important;
}

.warning-text {
  color: #f59e0b;
  font-size: 0.875rem;
  margin: 0;
  text-align: center;
  font-weight: 600;
  padding: 0.25rem;
  min-height: 1.5rem;
}

.warning-text-placeholder {
  min-height: 1.5rem;
  margin: 0;
  padding: 0.25rem;
}
</style>

