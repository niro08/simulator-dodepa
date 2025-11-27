<template>
  <div class="casino-shell">
    <header class="casino-header">
      <h1>Симулятор Додепа 🎰</h1>
    </header>

    <section class="casino-stats">
      <div class="stat-card">
        <p class="label">Деньги</p>
        <p class="value">{{ stats.money }} ₽</p>
      </div>
      <div class="stat-card">
        <p class="label">Энергия</p>
        <p class="value">⚡ {{ stats.energy }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Репутация</p>
        <p class="value">❤️ {{ stats.reputation }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Долг</p>
        <p class="value">💳 {{ stats.debt }} ₽</p>
      </div>
    </section>

    <div class="actions-main">
      <button @click="openSlotMachine" class="btn-play">🎰 Слот-машина</button>
    </div>

    <SlotMachine
      :is-visible="isSlotVisible"
      :bet="stats.bet"
      :money="stats.money"
      :energy="stats.energy"
      @close="closeSlotMachine"
      @bet-placed="$emit('bet-placed')"
      @spin-result="$emit('spin-result', $event)"
      @update:bet="$emit('update:bet', $event)"
    />

    <div class="panels-grid">
      <WorkPanel
        :energy="stats.energy"
        @work-job="$emit('work-job')"
      />
      <BankPanel
        :money="stats.money"
        :debt="stats.debt"
        @take-credit="$emit('take-credit')"
        @repay-debt="$emit('repay-debt', $event)"
      />
      <FriendPanel
        :energy="stats.energy"
        :reputation="stats.reputation"
        @borrow-money="$emit('borrow-money')"
        @help-friend="$emit('help-friend')"
      />
    </div>

    <div class="actions-secondary">
      <button @click="$emit('reset-game')" class="danger">🔄 Сбросить прогресс</button>
    </div>

    <LogsList :logs="logs" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import WorkPanel from './WorkPanel.vue'
import BankPanel from './BankPanel.vue'
import FriendPanel from './FriendPanel.vue'
import LogsList from './LogsList.vue'
import SlotMachine from './SlotMachine.vue'

export interface Stats {
  money: number
  energy: number
  reputation: number
  debt: number
  bet: number
}

defineProps<{ stats: Stats; logs: string[] }>()
const emit = defineEmits([
  'work-job',
  'borrow-money',
  'take-credit',
  'help-friend',
  'repay-debt',
  'reset-game',
  'update:bet',
  'bet-placed',
  'spin-result'
])

const isSlotVisible = ref(false)

function openSlotMachine() {
  isSlotVisible.value = true
}

function closeSlotMachine() {
  isSlotVisible.value = false
}
</script>

<style scoped>
.casino-shell {
  min-height: 100vh;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.actions-main {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.actions-main .btn-play {
  background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
  font-size: 1.1rem;
}

.actions-secondary {
  display: flex;
  justify-content: center;
}

.actions-secondary button {
  min-width: 200px;
}

@media (max-width: 768px) {
  .casino-shell {
    padding: 1rem;
  }
}
</style>

