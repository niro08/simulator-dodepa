<template>
  <div class="main-menu">
    <!-- Снегопад -->
    <div class="snowfall-container">
      <div
        v-for="flake in snowflakes"
        :key="flake.id"
        class="snowflake"
        :style="{
          left: flake.left,
          animationDuration: flake.duration,
          animationDelay: flake.delay,
          fontSize: flake.size,
          filter: `drop-shadow(0 0 ${flake.glow}px ${flake.glowColor})`
        }"
      >
        {{ flake.symbol }}
      </div>
    </div>

    <!-- Контент меню -->
    <div class="menu-content">
      <h1 class="game-title">
        <span class="title-icon">🎰</span>
        Симулятор Додепа
        <span class="title-icon">💎</span>
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
import { ref, onMounted } from 'vue'

const emit = defineEmits<{
  startGame: [isNewGame: boolean]
}>()

defineProps<{
  hasSave: boolean
}>()

const isMusicEnabled = ref(false)

// Символы для снегопада
const casinoSymbols = ['🎰', '🎲', '🃏', '💰', '💎', '⭐', '🍒', '🍋', '💸', '🎁', '🔔', '7️⃣']

interface Snowflake {
  id: number
  symbol: string
  left: string
  duration: string
  delay: string
  size: string
  glow: number
  glowColor: string
}

const snowflakes = ref<Snowflake[]>([])

// Генерация снежинок
function generateSnowflakes() {
  const flakes: Snowflake[] = []
  const count = 30 // Количество снежинок

  for (let i = 0; i < count; i++) {
    const symbol = casinoSymbols[Math.floor(Math.random() * casinoSymbols.length)] || '🎰'
    const glowColors = ['#ffd700', '#ff69b4', '#00ffff', '#ff4500', '#9370db', '#00ff00']
    const glowColorIndex = Math.floor(Math.random() * glowColors.length)
    const glowColor = glowColors[glowColorIndex] ?? '#ffd700'

    flakes.push({
      id: i,
      symbol,
      left: `${Math.random() * 100}%`,
      duration: `${5 + Math.random() * 10}s`,
      delay: `${Math.random() * 5}s`,
      size: `${1 + Math.random() * 1.5}rem`,
      glow: 2 + Math.random() * 8,
      glowColor
    })
  }

  snowflakes.value = flakes
}

function toggleMusic() {
  isMusicEnabled.value = !isMusicEnabled.value
  // TODO: Добавим логику включения музыки позже
}

function continueGame() {
  emit('startGame', false)
}

function newGame() {
  if (confirm('Начать новую игру? Текущий прогресс будет удалён.')) {
    emit('startGame', true)
  }
}

function startGame() {
  emit('startGame', false)
}

onMounted(() => {
  generateSnowflakes()
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

/* Снегопад */
.snowfall-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.snowflake {
  position: absolute;
  top: -50px;
  animation: fall linear infinite;
  opacity: 0.8;
  user-select: none;
}

@keyframes fall {
  0% {
    transform: translateY(-50px) rotate(0deg);
  }
  100% {
    transform: translateY(100vh) rotate(360deg);
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
}

.game-title {
  font-size: 3rem;
  font-weight: 900;
  margin-bottom: 3rem;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 50%, #ffd700 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
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

