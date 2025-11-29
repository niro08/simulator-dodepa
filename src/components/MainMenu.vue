<template>
  <div class="main-menu">

    <!-- Снегопад -->
    <div class="snowfall-container" :class="{ 'fade-out': isTransitioning }">
      <div
        v-for="flake in snowflakes"
        :key="flake.id"
        class="snowflake"
        :style="{
          left: flake.left,
          animationDuration: `${flake.duration}, ${flake.rotationDuration}`,
          animationDelay: flake.delay,
          fontSize: flake.size,
          textShadow: `0 0 ${flake.glow}px ${flake.glowColor}, 0 0 ${flake.glow * 0.5}px ${flake.glowColor}, 0 0 ${flake.glow * 0.3}px ${flake.glowColor}`,
          '--rotation-start': `${flake.rotation}deg`,
          '--scale': flake.scale
        }"
      >
        {{ flake.symbol }}
      </div>
    </div>

    <!-- Контент меню -->
    <div class="menu-content" :class="{ 'fade-out': isTransitioning }">
      <h1 class="game-title">
        <span ref="emojiRef" class="title-icon">🎰</span>
        <span :class="{ 'fade-out': isTransitioning }">Симулятор Додепа</span>
        <span class="title-icon" :class="{ 'fade-out': isTransitioning }">💎</span>
      </h1>

      <div class="menu-buttons">
        <template v-if="hasSave">
          <button class="menu-btn primary" @click="continueGame">
            ▶️ Продолжить
          </button>
          <button class="menu-btn secondary" @click="newGame">
            ✨ Новая игра
          </button>
        </template>
        <template v-else>
          <button class="menu-btn primary" @click="startGame">
            🎮 Играть
          </button>
        </template>
      </div>

      <!-- Кнопка музыки -->
      <button class="music-toggle" @click="toggleMusic" :class="{ active: isMusicEnabled }">
        <span v-if="isMusicEnabled">🔊</span>
        <span v-else>🔇</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useBackgroundMusic } from '@/composables/useBackgroundMusic'

const emit = defineEmits<{
  startGame: [isNewGame: boolean]
}>()

defineProps<{
  hasSave: boolean
}>()

// Подключаем музыку
const { isPlaying: isMusicEnabled, toggle: toggleMusic, stop: stopMusic, getAudioIntensity } = useBackgroundMusic(`${import.meta.env.BASE_URL}audio/dep.mp3`)

// Символы для снегопада
const casinoSymbols = ['🎰', '🎲', '🃏', '💰', '💎', '⭐', '🍒', '🍋', '💸', '🎁', '🔔', '7️⃣', '🤡']

interface Snowflake {
  id: number
  symbol: string
  left: string
  duration: string
  delay: string
  size: string
  glow: number
  glowColor: string
  scale: number
  rotation: number
  rotationDuration: string
}

const snowflakes = ref<Snowflake[]>([])
const baseGlowValues = ref<number[]>([])
const baseScaleValues = ref<number[]>([])
let animationFrameId: number | null = null

// Состояние анимации перехода
const isTransitioning = ref(false)

// Генерация снежинок
function generateSnowflakes() {
  const flakes: Snowflake[] = []
  const count = 30

  for (let i = 0; i < count; i++) {
    const symbol = casinoSymbols[Math.floor(Math.random() * casinoSymbols.length)] || '🎰'
    const glowColors = ['#ffd700', '#ff69b4', '#00ffff', '#ff4500', '#9370db', '#00ff00']
    const glowColorIndex = Math.floor(Math.random() * glowColors.length)
    const glowColor = glowColors[glowColorIndex] ?? '#ffd700'

    const baseGlow = 2 + Math.random() * 8
    baseGlowValues.value.push(baseGlow)

    const baseScale = 1.0
    baseScaleValues.value.push(baseScale)

    flakes.push({
      id: i,
      symbol,
      left: `${Math.random() * 100}%`,
      duration: `${5 + Math.random() * 10}s`,
      delay: `${Math.random() * 5}s`,
      size: `${1 + Math.random() * 1.5}rem`,
      glow: baseGlow,
      glowColor,
      scale: baseScale,
      rotation: Math.random() * 360, // Случайный начальный угол
      rotationDuration: `${3 + Math.random() * 4}s` // Случайная скорость вращения
    })
  }

  snowflakes.value = flakes
}

// Обновление свечения и размера снежинок по музыке
function updateSnowflakesGlow() {
  const intensity = getAudioIntensity()

  snowflakes.value.forEach((flake, index) => {
    const baseGlow = baseGlowValues.value[index] || 5
    const baseScale = baseScaleValues.value[index] || 1

    // Увеличиваем базовое свечение + добавляем интенсивность (до 60px)
    flake.glow = baseGlow + intensity * 5
    // Изменяем размер: базовый масштаб + пульсация (до +50% размера)
    flake.scale = baseScale + intensity * 0.5
  })

  animationFrameId = requestAnimationFrame(updateSnowflakesGlow)
}

function startTransition(isNewGame: boolean) {
  isTransitioning.value = true

  // Останавливаем основную музыку
  stopMusic()

  // Запускаем музыку перехода
  const transitionAudio = new Audio(`${import.meta.env.BASE_URL}audio/start_dep.mp3`)
  transitionAudio.volume = 0.5
  transitionAudio.play().catch(err => console.warn('Не удалось воспроизвести музыку перехода:', err))

  emit('startGame', isNewGame)
}

function continueGame() {
  startTransition(false)
}

function newGame() {
  if (confirm('Начать новую игру? Текущий прогресс будет удалён.')) {
    startTransition(true)
  }
}

function startGame() {
  startTransition(false)
}

onMounted(() => {
  generateSnowflakes()
  // Запускаем эквалайзер
  updateSnowflakesGlow()
})

onUnmounted(() => {
  // Останавливаем анимацию при размонтировании
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<style scoped>
.main-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}


/* Fade out для снегопада и контента */
.fade-out {
  animation: fadeOut 0.8s ease-out forwards;
}

@keyframes fadeOut {
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

/* Снегопад */
.snowfall-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  transition: opacity 0.8s ease-out;
}

.snowflake {
  position: absolute;
  top: -50px;
  animation: fall linear infinite, rotate linear infinite;
  opacity: 0.8;
  user-select: none;
  will-change: transform, top;
}

@keyframes fall {
  0% {
    top: -50px;
  }
  100% {
    top: 100vh;
  }
}

@keyframes rotate {
  0% {
    transform: rotate(var(--rotation-start, 0deg)) scale(var(--scale, 1));
  }
  100% {
    transform: rotate(calc(var(--rotation-start, 0deg) + 360deg)) scale(var(--scale, 1));
  }
}

/* Контент меню */
.menu-content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  transition: opacity 0.8s ease-out;
}

.game-title {
  font-size: 3rem;
  font-weight: 900;
  margin-bottom: 3rem;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%);
  -webkit-background-clip: text;
  background-clip: text;
  text-shadow: 0 0 40px rgba(255, 215, 0, 0.5);
  animation: titlePulse 3s ease-in-out infinite;
  line-height: 1.2;
}

.title-icon {
  display: inline-block;
  animation: iconSpin 4s linear infinite;
}


@keyframes titlePulse {
  0%, 100% {
    transform: scale(1);
    filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.5));
  }
  50% {
    transform: scale(1.05);
    filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.8));
  }
}

@keyframes iconSpin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Кнопки меню */
.menu-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.menu-btn {
  padding: 1.25rem 2rem;
  font-size: 1.5rem;
  font-weight: 700;
  border: none;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.menu-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.menu-btn:hover::before {
  width: 300px;
  height: 300px;
}

.menu-btn.primary {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  color: white;
  box-shadow: 0 8px 25px rgba(124, 58, 237, 0.5);
}

.menu-btn.primary:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 35px rgba(124, 58, 237, 0.7);
}

.menu-btn.secondary {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: white;
  box-shadow: 0 8px 25px rgba(30, 41, 59, 0.5);
}

.menu-btn.secondary:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 35px rgba(30, 41, 59, 0.7);
}

/* Кнопка музыки */
.music-toggle {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  background: rgba(20, 20, 30, 0.8);
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.music-toggle:hover {
  transform: scale(1.1) rotate(15deg);
  border-color: rgba(124, 58, 237, 0.6);
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.5);
}

.music-toggle.active {
  background: rgba(124, 58, 237, 0.3);
  border-color: #7c3aed;
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.6);
}

/* Адаптивность */
@media (max-width: 640px) {
  .game-title {
    font-size: 2rem;
  }

  .menu-btn {
    font-size: 1.25rem;
    padding: 1rem 1.5rem;
  }

  .music-toggle {
    bottom: 1rem;
    right: 1rem;
    width: 50px;
    height: 50px;
    font-size: 1.25rem;
  }
}
</style>

