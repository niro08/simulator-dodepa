<template>
  <Transition name="fade" mode="out-in">
    <MainMenu
      v-if="!isGameStarted"
      :has-save="hasSave"
      @start-game="handleStartGame"
    />
    <CasinoUI
      v-else
      :stats="casinoStore.stats"
      :logs="casinoStore.logs"
      @bet-placed="casinoStore.placeBet"
      @spin-result="casinoStore.handleSlotResult"
      @work-job="casinoStore.workJob"
      @shady-deal="casinoStore.shadyDeal"
      @borrow-money="casinoStore.borrowMoney"
      @take-credit="casinoStore.takeCredit"
      @help-friend="casinoStore.helpFriend"
      @repay-debt="casinoStore.repayDebtAmount"
      @reset-game="handleResetGame"
      @update:bet="casinoStore.setBet"
    />
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCasinoStore } from '@/stores/casino'
import MainMenu from '@/components/MainMenu.vue'
import CasinoUI from '@/components/CasinoUI.vue'

const casinoStore = useCasinoStore()
const isGameStarted = ref(false)

// Проверяем наличие сохранения
const hasSave = computed(() => {
  const saved = localStorage.getItem('dodepaSave')
  if (!saved) return false

  try {
    const data = JSON.parse(saved)
    // Проверяем, что есть значимые данные (не начальное состояние)
    return data.money !== 1000 || data.energy !== 50 || data.debt !== 0
  } catch {
    return false
  }
})

function handleStartGame(isNewGame: boolean) {
  if (isNewGame) {
    // Очищаем сохранение и сбрасываем игру
    localStorage.removeItem('dodepaSave')
    casinoStore.resetGame()
  }

  isGameStarted.value = true
}

function handleResetGame() {
  casinoStore.resetGame()
  isGameStarted.value = false
}
</script>

<style>
/* Анимация перехода fade */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: scale(1.1);
}

.fade-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>

