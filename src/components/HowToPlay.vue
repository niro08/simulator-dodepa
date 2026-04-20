<template>
  <Transition name="modal">
    <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="close">✕</button>

        <div class="guide">
          <h2 class="guide-title">📖 Как играть</h2>

          <div class="guide-section">
            <h3>🎯 Цель игры</h3>
            <p>Играй в казино, зарабатывай энергию додепа и продолжай депать! Главное — не проиграть всё.</p>
          </div>

          <div class="guide-section">
            <h3>💰 Основные ресурсы</h3>
            <ul>
              <li><strong>Деньги (₽)</strong> — нужны для ставок в казино</li>
              <li><strong>Энергия (⚡)</strong> — валюта додепа, получаешь при проигрышах</li>
              <li><strong>Репутация (❤️)</strong> — влияет на суммы займов и кредитов</li>
              <li><strong>Долг (💳)</strong> — кредиты, которые нужно возвращать</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>🎰 Казино</h3>
            <p><strong>Слот-машина:</strong></p>
            <ul>
              <li>Минимальная ставка: {{ MIN_BET }}₽</li>
              <li>При выигрыше: получаешь х{{ SLOT_BASE_MIN_MULTIPLIER }}-х{{ SLOT_BASE_MAX_MULTIPLIER }} от ставки</li>
              <li>Джекпот 777: редкий выигрыш х{{ SLOT_JACKPOT_MULTIPLIER }}</li>
              <li>При проигрыше: +{{ SLOT_LOSS_ENERGY_GAIN }}⚡ только при ставке от {{ SLOT_ENERGY_GAIN_MIN_BET }}₽</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>💼 Способы заработка</h3>
            <p><strong>Подработка (-{{ JOB_COST }}⚡, +{{ JOB_REPUTATION_GAIN }}❤️):</strong></p>
            <ul>
              <li>Честный заработок ~{{ WORK_REWARD_MIN }}-{{ WORK_REWARD_MAX }}₽</li>
              <li>Повышает репутацию</li>
            </ul>

            <p><strong>Замутить темку (-{{ SHADY_DEAL_COST }}⚡, -{{ SHADY_DEAL_REPUTATION_LOSS }}❤️):</strong></p>
            <ul>
              <li>Нечестный заработок ~{{ SHADY_DEAL_REWARD_MIN }}-{{ SHADY_DEAL_REWARD_MAX }}₽</li>
              <li>Снижает репутацию</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>👥 Друзья</h3>
            <p><em>"Друзья не банк - занял и можно не отдавать"</em></p>
            <ul>
              <li><strong>Занять у друга (-{{ BORROW_COST }}⚡, -{{ BORROW_REPUTATION_LOSS }}❤️):</strong> ~{{ BORROW_REWARD_MIN }}-{{ BORROW_REWARD_MAX }}₽</li>
              <li><strong>Помочь другу (-{{ HELP_COST }}⚡, +{{ HELP_REPUTATION_GAIN }}❤️):</strong> повышает репутацию</li>
              <li>Требуется репутация минимум {{ BORROW_MIN_REPUTATION }}❤️</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>🏦 Банк</h3>
            <p><strong>Взять кредит (-{{ CREDIT_COST }}⚡, -{{ CREDIT_REPUTATION_LOSS }}❤️):</strong></p>
            <ul>
              <li>Получаешь ~{{ CREDIT_REWARD_MIN }}-{{ CREDIT_REWARD_MAX }}₽</li>
              <li>Долг увеличивается на {{ CREDIT_DEBT_PERCENT_MIN }}-{{ CREDIT_DEBT_PERCENT_MAX }}% от суммы</li>
              <li>Банк откажет при долге выше {{ CREDIT_MAX_DEBT_FOR_NEW_LOAN }}₽</li>
            </ul>

            <p><strong>Погасить долг:</strong></p>
            <ul>
              <li>Минимум {{ REPAY_MIN_AMOUNT }}₽ за раз</li>
              <li>+1❤️ за каждые {{ REPAY_REPUTATION_INTERVAL }}₽ погашения</li>
            </ul>
          </div>

          <div class="guide-section">
            <h3>⚠️ Советы</h3>
            <ul>
              <li>Следи за репутацией — от неё зависят суммы займов</li>
              <li>Не бери много кредитов — долг растёт с процентами</li>
              <li>Баланс между честным и нечестным заработком</li>
              <li>Проигрыши дают энергию — это не всегда плохо!</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import {
  MIN_BET,
  JOB_COST,
  JOB_REPUTATION_GAIN,
  SHADY_DEAL_COST,
  SHADY_DEAL_REPUTATION_LOSS,
  BORROW_COST,
  BORROW_REPUTATION_LOSS,
  BORROW_MIN_REPUTATION,
  CREDIT_COST,
  CREDIT_REPUTATION_LOSS,
  CREDIT_MAX_DEBT_FOR_NEW_LOAN,
  HELP_COST,
  HELP_REPUTATION_GAIN,
  REPAY_MIN_AMOUNT,
  REPAY_REPUTATION_INTERVAL,
  SLOT_BASE_MIN_MULTIPLIER,
  SLOT_BASE_MAX_MULTIPLIER,
  SLOT_LOSS_ENERGY_GAIN,
  SLOT_ENERGY_GAIN_MIN_BET,
  SLOT_JACKPOT_MULTIPLIER,
  WORK_REWARD_MIN,
  WORK_REWARD_MAX,
  SHADY_DEAL_REWARD_MIN,
  SHADY_DEAL_REWARD_MAX,
  BORROW_REWARD_MIN,
  BORROW_REWARD_MAX,
  CREDIT_REWARD_MIN,
  CREDIT_REWARD_MAX,
  CREDIT_DEBT_PERCENT_MIN,
  CREDIT_DEBT_PERCENT_MAX
} from '@/game/casinoGame'

defineProps<{
  isVisible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function close() {
  emit('close')
}

function handleOverlayClick() {
  close()
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
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
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
  z-index: 10;
}

.close-btn:hover {
  background: rgba(229, 62, 62, 0.8);
  transform: rotate(90deg);
}

.guide {
  color: white;
}

.guide-title {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.guide-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.75rem;
  border: 1px solid rgba(124, 58, 237, 0.2);
}

.guide-section h3 {
  color: #a78bfa;
  font-size: 1.25rem;
  margin: 0 0 0.75rem 0;
  font-weight: 700;
}

.guide-section p {
  margin: 0.5rem 0;
  line-height: 1.6;
  color: #e0e0e0;
}

.guide-section ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  list-style: none;
}

.guide-section ul li {
  margin: 0.5rem 0;
  line-height: 1.6;
  color: #d0d0d0;
  position: relative;
}

.guide-section ul li::before {
  content: "•";
  color: #7c3aed;
  font-weight: bold;
  font-size: 1.2rem;
  position: absolute;
  left: -1.2rem;
}

.guide-section strong {
  color: #ffd700;
}

.guide-section em {
  color: #a78bfa;
  font-style: italic;
}

/* Анимация модального окна */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
  opacity: 0;
}

/* Скроллбар */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: rgba(124, 58, 237, 0.5);
  border-radius: 10px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 58, 237, 0.7);
}

@media (max-width: 640px) {
  .modal-content {
    padding: 1.5rem;
    max-height: 85vh;
  }

  .guide-title {
    font-size: 1.5rem;
  }

  .guide-section h3 {
    font-size: 1.1rem;
  }

  .guide-section {
    padding: 0.75rem;
  }
}
</style>

