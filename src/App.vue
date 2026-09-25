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

  <p v-if="game.readOnly" class="save-warning">
    ⚠️ Сейв создан более новой версией игры — прогресс не сохраняется.
  </p>

  <MainMenu
    v-if="!isGameStarted"
    :has-save="game.hasSave"
    @start-game="handleStartGame"
  />
  <CasinoUI
    v-else
    @exit-to-menu="handleExitToMenu"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'
import { usePlayTime } from '@/composables/usePlayTime'
import MainMenu from '@/components/MainMenu.vue'
import CasinoUI from '@/components/CasinoUI.vue'

const game = useGameStore()
// Активное время игры для статистики и Выписки (systems-spec §3.6)
usePlayTime()
const isGameStarted = ref(false)

// Состояние анимации: 'none' | 'growing' | 'shrinking'
const transitionState = ref<'none' | 'growing' | 'shrinking'>('none')

function handleStartGame(isNewGame: boolean) {
  // Защита от двойного старта (B-12)
  if (transitionState.value !== 'none') return

  // Этап 1: Увеличение (1.5 сек)
  transitionState.value = 'growing'

  setTimeout(() => {
    // Новая игра — явный сброс забега; «Играть» без сейва тоже создаёт забег
    if (isNewGame || !game.hasSave) {
      game.newGame()
    }
    isGameStarted.value = true

    // Этап 2: Сразу начинаем уменьшение (1 сек)
    transitionState.value = 'shrinking'

    setTimeout(() => {
      transitionState.value = 'none'
    }, 1000)
  }, 1500)
}

// Выход в меню только меняет экран: прогресс и сейв не трогаем (B-01)
function handleExitToMenu() {
  isGameStarted.value = false
}
</script>

<style>
.save-warning {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 0.5rem 1rem;
  text-align: center;
  font-weight: 600;
  background: var(--color-warning);
  color: var(--color-bg-primary);
}

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

