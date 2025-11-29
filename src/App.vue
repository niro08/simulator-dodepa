<template>
  <!-- Анимированный эмодзи для перехода -->
  <div v-if="transitionState !== 'none'" class="transition-emoji-wrapper">
    <div
      class="transition-emoji"
      :class="{
        'grow': transitionState === 'growing',
        'shrink': transitionState === 'shrinking'
      }"
    >
      🎰
    </div>
  </div>

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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCasinoStore } from '@/stores/casino'
import MainMenu from '@/components/MainMenu.vue'
import CasinoUI from '@/components/CasinoUI.vue'

const casinoStore = useCasinoStore()
const isGameStarted = ref(false)

// Состояние анимации: 'none' | 'growing' | 'shrinking'
const transitionState = ref<'none' | 'growing' | 'shrinking'>('none')

// Проверяем наличие сохранения
const hasSave = computed(() => {
  const saved = localStorage.getItem('dodepaSave')
  if (!saved) return false

  try {
    JSON.parse(saved) // Проверяем что это валидный JSON
    return true
  } catch {
    return false
  }
})

function handleStartGame(isNewGame: boolean) {
  // Этап 1: Увеличение (1.5 сек)
  transitionState.value = 'growing'

  setTimeout(() => {
    // Переход на игровой экран
    if (isNewGame) {
      localStorage.removeItem('dodepaSave')
      casinoStore.resetGame()
    }
    isGameStarted.value = true

    // Этап 2: Сразу начинаем уменьшение (1 сек)
    transitionState.value = 'shrinking'

    setTimeout(() => {
      transitionState.value = 'none'
    }, 1000)
  }, 1500)
}

function handleResetGame() {
  casinoStore.resetGame()
  isGameStarted.value = false
}
</script>

<style>
/* Wrapper для анимированного эмодзи */
.transition-emoji-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 10000;
  pointer-events: none;
}

/* Анимированный эмодзи */
.transition-emoji {
  position: fixed;
  top: 50vh;
  left: 50vw;
  transform: translate(-50%, -50%);
  font-size: 3rem;
  will-change: transform, font-size;
  opacity: 1;
}

/* Быстрая анимация вращения (0.3s на оборот - очень быстро) */
@keyframes spinFast {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

/* Этап 1: Увеличение с момента появления (1.5 сек) */
.transition-emoji.grow {
  animation: grow 1.5s ease-in forwards, spinFast 0.3s linear infinite;
}

@keyframes grow {
  from {
    font-size: 3rem;
  }
  to {
    font-size: 120vw;
  }
}


/* Этап 2: Уменьшение (1 сек) */
.transition-emoji.shrink {
  animation: shrink 1s ease-out forwards, spinFast 0.3s linear infinite;
}

@keyframes shrink {
  from {
    font-size: 120vw;
    opacity: 1;
  }
  to {
    font-size: 0;
    opacity: 0;
  }
}
</style>

