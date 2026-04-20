<template>
  <Transition name="modal">
    <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="close">✕</button>

        <div class="slot-machine">
          <h2 class="slot-title">🎰 Слот-машина</h2>

          <div class="slot-stats">
            <div class="stat-item">
              <span class="stat-label">Баланс:</span>
              <span class="stat-value">{{ money }} ₽</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Энергия:</span>
              <span class="stat-value">⚡ {{ energy }}</span>
            </div>
          </div>

          <div class="bet-input-section">
            <label for="bet-amount">Размер ставки:</label>
            <input
              id="bet-amount"
              type="number"
              :value="bet"
              min="50"
              step="50"
              @input="onBetInput"
              :disabled="isSpinning"
            />
          </div>

          <div class="slot-display">
            <div class="slot-reel" v-for="(_, index) in reels" :key="index">
              <div
                class="reel-symbols"
                :class="{ spinning: isSpinning }"
                :style="{ transform: `translateY(${reelPositions[index]}px)` }"
              >
                <div v-for="(symbol, idx) in getReelSymbols(index)" :key="idx" class="symbol">
                  {{ symbol }}
                </div>
              </div>
            </div>
          </div>

          <div class="result-message">
            <p v-if="resultMessage" :class="resultClass">{{ resultMessage }}</p>
            <p v-else class="result-placeholder">&nbsp;</p>
          </div>

          <div class="slot-info">
            <p v-if="!isSpinning && !resultMessage" class="hint">Нажми кнопку, чтобы крутить!</p>
            <p v-else class="hint-placeholder">&nbsp;</p>
          </div>

          <button
            class="spin-button"
            :disabled="isSpinning || money < bet || bet < 50"
            @click="spin"
          >
            <span v-if="isSpinning">Крутим...</span>
            <span v-else>🎲 КРУТИТЬ</span>
          </button>

          <p v-if="bet < 50 && bet > 0" class="warning-text">⚠️ Минимальная ставка — 50₽</p>
          <p v-else-if="money < bet" class="warning-text">❌ Недостаточно денег для ставки</p>
          <p v-else class="warning-text-placeholder">&nbsp;</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  SLOT_WIN_CHANCE,
  SLOT_JACKPOT_CHANCE_ON_WIN,
  SLOT_JACKPOT_SYMBOL,
  calculateSlotWinAmount
} from '@/game/casinoGame'

const props = defineProps<{
  isVisible: boolean
  bet: number
  money: number
  energy: number
}>()

const emit = defineEmits<{
  close: []
  'bet-placed': []
  'spin-result': [result: { isWin: boolean; amount: number; isJackpot?: boolean }]
  'update:bet': [value: number]
}>()

function onBetInput(event: Event) {
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  emit('update:bet', value)
}

const symbols = ['🍒', '🍋', '🍊', '🍉', '⭐', '💎', '7️⃣', '🤡']
const nonJackpotSymbols = symbols.filter((symbol) => symbol !== SLOT_JACKPOT_SYMBOL)

// Определяем высоту символа в зависимости от размера экрана
const getSymbolHeight = (): number => {
  return window.innerWidth <= 640 ? 70 : 80
}

const reels = ref<string[]>(['🍒', '🍋', '🍊'])
// Начальная позиция - показываем первый символ (индекс 0) по центру барабана
const reelPositions = ref<number[]>([0, 0, 0])
const isSpinning = ref(false)
const resultMessage = ref('')
const resultClass = ref('')

function getRandomSymbol(pool: string[] = symbols): string {
  return pool[Math.floor(Math.random() * pool.length)] || '🍒'
}

function getReelSymbols(reelIndex: number): string[] {
  const finalSymbol = reels.value[reelIndex] || '🍒'

  // Создаём массив для прокрутки
  const result: string[] = []

  // Начинаем с финального символа (он будет виден до кручения)
  result.push(finalSymbol)

  // Добавляем несколько циклов всех символов для эффекта прокрутки
  for (let i = 0; i < 20; i++) {
    const symbol = symbols[i % symbols.length]
    if (symbol) result.push(symbol)
  }

  // В конце снова добавляем финальный символ - на нём остановится барабан
  result.push(finalSymbol)

  return result
}

function close() {
  if (!isSpinning.value) {
    emit('close')
  }
}

function handleOverlayClick() {
  close()
}

async function spin() {
  if (isSpinning.value) return

  resultMessage.value = ''
  resultClass.value = ''

  // Валидация минимальной ставки
  if (props.bet < 50) {
    resultMessage.value = '⚠️ Минимальная ставка — 50₽'
    resultClass.value = 'warning'
    return
  }

  // Проверка баланса
  if (props.money < props.bet) {
    resultMessage.value = '❌ Недостаточно денег для ставки'
    resultClass.value = 'error'
    return
  }

  const isWin = Math.random() < SLOT_WIN_CHANCE
  const isJackpot = isWin && Math.random() < SLOT_JACKPOT_CHANCE_ON_WIN

  // Устанавливаем финальный результат ДО начала анимации
  if (isWin) {
    const winSymbol = isJackpot ? SLOT_JACKPOT_SYMBOL : getRandomSymbol(nonJackpotSymbols)
    reels.value = [winSymbol, winSymbol, winSymbol]
  } else {
    const sym1 = getRandomSymbol()
    let sym2 = getRandomSymbol()
    let sym3 = getRandomSymbol()

    while (sym1 === sym2 && sym2 === sym3) {
      sym3 = getRandomSymbol()
    }

    reels.value = [sym1, sym2, sym3]
  }

  // Снимаем ставку перед началом анимации
  emit('bet-placed')

  // Теперь начинаем анимацию
  isSpinning.value = true

  // Анимация вращения каждого барабана
  const spinPromises = reels.value.map((finalSymbol, reelIndex) => {
    return new Promise<void>((resolve) => {
      const spinTime = 2000 + reelIndex * 300
      const startTime = Date.now()
      const SYMBOL_HEIGHT = getSymbolHeight()

      // Начальная позиция - 0 (первый символ - финальный)
      // Финальная позиция - последний символ в массиве (индекс 21, так как добавили символ в начало и конец)
      const startPosition = 0
      const finalPosition = -SYMBOL_HEIGHT * 21

      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / spinTime, 1)

        if (progress < 1) {
          // Плавная прокрутка с замедлением в конце
          const easeOut = 1 - Math.pow(1 - progress, 3)
          reelPositions.value[reelIndex] = startPosition + (finalPosition - startPosition) * easeOut
          requestAnimationFrame(animate)
        } else {
          // Устанавливаем финальную позицию
          reelPositions.value[reelIndex] = finalPosition
          resolve()
        }
      }

      // Сбрасываем позицию в начало перед анимацией
      reelPositions.value[reelIndex] = startPosition
      animate()
    })
  })

  await Promise.all(spinPromises)
  isSpinning.value = false

  // Задержка перед показом результата
  await new Promise(resolve => setTimeout(resolve, 300))

  // Показываем результат
  if (isWin) {
    const winAmount = calculateSlotWinAmount(props.bet, isJackpot)

    if (isJackpot) {
      resultMessage.value = `💥 ДЖЕКПОТ 777! +${winAmount}₽`
      resultClass.value = 'jackpot'
      emit('spin-result', { isWin: true, amount: winAmount, isJackpot: true })
      return
    }

    resultMessage.value = `🎉 ВЫИГРЫШ! +${winAmount}₽`
    resultClass.value = 'win'
    emit('spin-result', { isWin: true, amount: winAmount, isJackpot: false })
  } else {
    resultMessage.value = `😔 Не повезло... +5⚡`
    resultClass.value = 'lose'
    emit('spin-result', { isWin: false, amount: 0, isJackpot: false })
  }



}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 1.5rem;
  padding: 2rem;
  max-width: 500px;
  width: 100%;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(124, 58, 237, 0.3);
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
}

.close-btn:hover {
  background: rgba(229, 62, 62, 0.8);
  transform: rotate(90deg);
}

.slot-machine {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.slot-title {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  text-shadow: 0 0 30px rgba(255, 215, 0, 0.5);
}

.slot-stats {
  display: flex;
  gap: 2rem;
  padding: 1rem 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.75rem;
  border: 1px solid rgba(124, 58, 237, 0.3);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-label {
  font-size: 0.875rem;
  color: #a0a0b0;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
}

.bet-input-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bet-input-section label {
  font-size: 0.875rem;
  color: #a0a0b0;
  font-weight: 600;
}

.bet-input-section input {
  width: 100%;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(124, 58, 237, 0.4);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 1.125rem;
  font-weight: 600;
  text-align: center;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.bet-input-section input:focus {
  outline: none;
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
}

.bet-input-section input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slot-display {
  display: flex;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 1rem;
  border: 3px solid rgba(255, 215, 0, 0.4);
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.6);
}

.slot-reel {
  position: relative;
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%);
  border-radius: 0.75rem;
  overflow: hidden;
  border: 2px solid rgba(124, 58, 237, 0.4);
  box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.4);
}

.reel-symbols {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.symbol {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  user-select: none;
}

.result-message {
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-placeholder {
  min-height: 70px;
  margin: 0;
}

.result-message p {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  animation: resultPulse 0.5s ease;
}

.result-message .win {
  color: #10b981;
  background: rgba(16, 185, 129, 0.2);
  border: 2px solid #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.8);
}

.result-message .jackpot {
  color: #ffd700;
  background: rgba(255, 215, 0, 0.2);
  border: 2px solid #ffd700;
  text-shadow: 0 0 14px rgba(255, 215, 0, 0.9);
}

.result-message .lose {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
  border: 2px solid #f59e0b;
}

.result-message .warning {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
  border: 2px solid #f59e0b;
  text-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
}

.result-message .error {
  color: #e53e3e;
  background: rgba(229, 62, 62, 0.2);
  border: 2px solid #e53e3e;
  text-shadow: 0 0 10px rgba(229, 62, 62, 0.6);
}

.slot-info {
  text-align: center;
  color: #a0a0b0;
  min-height: 30px;
}

.slot-info p {
  margin: 0.25rem 0;
}

.hint-placeholder {
  min-height: 30px;
}

.warning-text-placeholder {
  min-height: 1.5rem;
  margin: 0;
  padding: 0.25rem;
}

.slot-info .hint {
  font-size: 0.875rem;
  font-style: italic;
  color: #7c7c8a;
}

.spin-button {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  border: none;
  border-radius: 1rem;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
}

.spin-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(124, 58, 237, 0.6);
}

.spin-button:active:not(:disabled) {
  transform: translateY(0);
}

.spin-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.warning-text {
  color: #f59e0b;
  font-size: 0.875rem;
  margin: 0;
  text-align: center;
  font-weight: 600;
  padding: 0.25rem;
}

/* Animations */

@keyframes resultPulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: all 0.3s ease;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
  opacity: 0;
}

@media (max-width: 640px) {
  .modal-content {
    padding: 1.5rem;
  }

  .slot-display {
    padding: 1rem;
    gap: 0.5rem;
  }

  .slot-reel {
    width: 70px;
    height: 70px;
  }

  .symbol {
    width: 70px;
    height: 70px;
    font-size: 2.5rem;
    line-height: 70px;
  }

  .slot-title {
    font-size: 1.5rem;
  }

  .result-message p {
    font-size: 1.25rem;
  }
}
</style>

