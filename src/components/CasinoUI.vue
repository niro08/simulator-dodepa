<template>
  <div class="casino-shell">
    <header class="casino-header">
      <h1>Симулятор Додепа 🎰</h1>
    </header>

    <section class="casino-stats">
      <div class="stat-card">
        <p class="label">Деньги</p>
        <p class="value">{{ game.view.money }} ₽</p>
      </div>
      <div class="stat-card">
        <p class="label">Энергия</p>
        <p class="value">⚡ {{ game.view.energy }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Репутация</p>
        <p class="value">❤️ {{ game.view.reputation }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Долг</p>
        <p class="value">💳 {{ game.view.debt }} ₽</p>
      </div>
    </section>

    <div class="actions-main">
      <button @click="openSlotMachine" class="btn-play">🎰 Слот-машина</button>
    </div>

    <SlotMachine :is-visible="isSlotVisible" @close="closeSlotMachine" />

    <div class="panels-grid">
      <WorkPanel />
      <BankPanel />
      <FriendPanel />
    </div>

    <div class="actions-secondary">
      <button @click="emit('exit-to-menu')" class="danger">🏠 Выйти в меню</button>
    </div>

    <LogsList />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '@/stores/game'
import WorkPanel from './WorkPanel.vue'
import BankPanel from './BankPanel.vue'
import FriendPanel from './FriendPanel.vue'
import LogsList from './LogsList.vue'
import SlotMachine from './SlotMachine.vue'

// Данные и действия — напрямую из стора, без prop-drilling (TD-06)
const game = useGameStore()

const emit = defineEmits<{
  'exit-to-menu': []
}>()

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

