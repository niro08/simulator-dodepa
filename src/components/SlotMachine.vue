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
              <span class="stat-value">{{ game.view.money }} ₽</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Энергия:</span>
              <span class="stat-value">⚡ {{ game.view.energy }}</span>
            </div>
          </div>

          <div class="bet-input-section">
            <label for="bet-amount">Размер ставки:</label>
            <input
              id="bet-amount"
              type="number"
              :value="betDraft"
              :min="minBet"
              :step="minBet"
              @input="onBetInput"
              @change="commitBet"
              :disabled="isSpinning"
            />
          </div>

          <div class="slot-display">
            <div class="slot-reel" v-for="(strip, index) in strips" :key="index" ref="reelEls">
              <div class="reel-symbols" :style="reelStyles[index]">
                <div v-for="(symbol, idx) in strip" :key="idx" class="symbol">
                  {{ SYMBOL_EMOJI[symbol] }}
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
            :disabled="isSpinning || !!spinBlock"
            @click="spin"
          >
            <span v-if="isSpinning">Крутим...</span>
            <span v-else>🎲 КРУТИТЬ</span>
          </button>

          <p v-if="spinBlock && !isSpinning" class="warning-text">{{ rejectionText(spinBlock) }}</p>
          <p v-else class="warning-text-placeholder">&nbsp;</p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { canExecute, type Rejection, type SymbolId } from '@/game'
import { useGameStore } from '@/stores/game'
import { eventTone, formatRejection, formatSpinBanner } from '@/i18n'
import { SYMBOL_EMOJI } from '@/skins/classic'

defineProps<{
  isVisible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const game = useGameStore()
const { symbols } = game.config.slot
const { reelBaseMs, reelStaggerMs, revealDelayMs } = game.config.slot.timing
const minBet = game.config.balance.limits.minBet
// Сколько символов пролетает между стартовым и итоговым (визуал, на исход не влияет)
const FILLER_SYMBOLS = 20

// ─── Ставка: черновик ввода, в стор — на change/blur (TD-09) ───
const betDraft = ref<number>(game.view.bet)
watch(() => game.view.bet, (value) => (betDraft.value = value))

function onBetInput(event: Event) {
  betDraft.value = Number((event.target as HTMLInputElement).value)
}

function commitBet() {
  if (betDraft.value !== game.view.bet) game.setBet(betDraft.value)
  betDraft.value = game.view.bet
}

// Доступность спина — предикат ядра на состоянии с черновой ставкой
const spinBlock = computed<Rejection | null>(() => {
  if (!game.run) return null
  const bet = Number.isFinite(betDraft.value) ? Math.floor(betDraft.value) : 0
  return canExecute({ ...game.run, bet }, { type: 'slot/spin' }, game.config)
})

function rejectionText(rejection: Rejection): string {
  const icon = rejection.reason === 'betTooLow' ? '⚠️' : '❌'
  return `${icon} ${formatRejection('slot/spin', rejection)}`
}

// ─── Барабаны: лента считается один раз на спин, анимация — CSS transition (TD-14) ───
const strips = ref<SymbolId[][]>([['cherry'], ['lemon'], ['orange']])
const offsets = ref<number[]>([0, 0, 0])
const durations = ref<number[]>([0, 0, 0])
const reelEls = ref<HTMLElement[]>([])

const reelStyles = computed(() =>
  offsets.value.map((y, i) => ({
    transform: `translateY(${y}px)`,
    transition: durations.value[i] ? `transform ${durations.value[i]}ms cubic-bezier(0.33, 1, 0.68, 1)` : 'none'
  }))
)

const isSpinning = ref(false)
const resultMessage = ref('')
const resultClass = ref('')

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Высота символа — из вёрстки (токен --reel-size), а не из ширины окна
function symbolHeight(): number {
  return reelEls.value[0]?.querySelector('.symbol')?.getBoundingClientRect().height || 80
}

// Лента начинается с символа, видимого до спина: итог не спойлерится (B-10)
function buildStrip(from: SymbolId, to: SymbolId, reelIndex: number): SymbolId[] {
  const filler = Array.from({ length: FILLER_SYMBOLS }, (_, i) => symbols[(i + reelIndex) % symbols.length] ?? to)
  return [from, ...filler, to]
}

async function animateReels(target: readonly SymbolId[]): Promise<boolean> {
  const current = strips.value.map((strip) => strip[strip.length - 1] ?? 'cherry')
  if (game.settings.skipSpinAnimation || game.settings.reducedMotion || prefersReducedMotion()) {
    strips.value = target.map((symbol) => [symbol])
    return false
  }

  strips.value = target.map((to, i) => buildStrip(current[i] ?? to, to, i))
  durations.value = [0, 0, 0]
  offsets.value = [0, 0, 0]
  await nextTick()
  await nextFrame()

  const height = symbolHeight()
  const times = target.map((_, i) => reelBaseMs + i * reelStaggerMs)
  durations.value = times
  offsets.value = strips.value.map((strip) => -(strip.length - 1) * height)
  await delay(Math.max(...times))

  // Схлопываем ленту до итогового символа
  durations.value = [0, 0, 0]
  offsets.value = [0, 0, 0]
  strips.value = target.map((symbol) => [symbol])
  return true
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
  commitBet()

  resultMessage.value = ''
  resultClass.value = ''

  // Исход считает ядро; стор уже применил и сохранил его (ADR-001)
  const outcome = game.spin()
  if (!outcome) return
  if (!outcome.spin) {
    resultMessage.value = rejectionText(outcome.rejection)
    resultClass.value = outcome.rejection.reason === 'betTooLow' ? 'warning' : 'error'
    return
  }

  isSpinning.value = true
  const animated = await animateReels(outcome.spin.reels)
  isSpinning.value = false

  // Задержка перед показом результата
  if (animated) await delay(revealDelayMs)

  resultMessage.value = formatSpinBanner(outcome.spin)
  resultClass.value = eventTone(outcome.spin)
  game.revealPending()
}

// Если компонент исчез посреди спина — результат всё равно показываем
onBeforeUnmount(() => game.revealPending())
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
  width: var(--reel-size);
  height: var(--reel-size);
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
  width: var(--reel-size);
  height: var(--reel-size);
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

  .symbol {
    font-size: 2.5rem;
    line-height: var(--reel-size);
  }

  .slot-title {
    font-size: 1.5rem;
  }

  .result-message p {
    font-size: 1.25rem;
  }
}
</style>

