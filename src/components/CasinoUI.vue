<template>
  <div class="casino-shell">
    <header class="casino-header">
      <h1>Симулятор Додепа 🎰</h1>
    </header>

    <section v-if="hud" class="casino-stats">
      <div class="stat-card">
        <p class="label">День</p>
        <p class="value">{{ hud.endless ? `${hud.day} · неделя ${hud.week}` : `${hud.day} / ${hud.runDays}` }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Энергия</p>
        <p class="value">⚡ {{ hud.energy }}</p>
      </div>
      <div class="stat-card">
        <p class="label">Кошелёк</p>
        <p class="value">{{ money(hud.wallet) }} ₽</p>
      </div>
      <div class="stat-card">
        <p class="label">Баланс казино</p>
        <p class="value">🎰 {{ money(hud.casino) }} ₽</p>
      </div>
      <div class="stat-card">
        <p class="label">Долг</p>
        <p class="value">💳 {{ money(hud.debt) }} ₽</p>
      </div>
      <div class="stat-card">
        <p class="label">Репутация / Тильт</p>
        <p class="value">❤️ {{ hud.rep }} · 🔥 {{ hud.tilt }}</p>
      </div>
      <div v-if="hud.bill" class="stat-card">
        <p class="label">Счёт недели {{ hud.bill.week }}</p>
        <p class="value">{{ hud.bill.isToday ? 'СЕГОДНЯ' : `через ${hud.bill.daysLeft} дн.` }} · ≈{{ money(hud.bill.total) }} ₽</p>
      </div>
    </section>

    <RunPhasePanel />

    <template v-if="game.phase === 'day' && hud">
      <section v-if="hud.forkOpen" class="panel fork-block">
        <p>Счёт оплачен. Можно завязать — если долг 0.</p>
        <button :disabled="!!game.actions.quit" @click="game.execute({ type: 'run/quit' })">ЗАВЯЗАТЬ</button>
        <p v-if="game.actions.quit" class="warning-text">⚠️ {{ formatRejection('run/quit', game.actions.quit) }}</p>
      </section>

      <div class="actions-main">
        <button @click="openSlotMachine" class="btn-play">🎰 Казино</button>
        <button @click="game.execute({ type: 'day/sleep' })" :disabled="!!game.actions.sleep">🌙 Лечь спать</button>
      </div>

      <div class="panels-grid">
        <WorkPanel />
        <BankPanel />
        <FriendPanel />
      </div>
    </template>

    <SlotMachine :is-visible="isSlotVisible" @close="closeSlotMachine" />

    <div class="actions-secondary">
      <button @click="emit('exit-to-menu')" class="danger">🏠 Выйти в меню</button>
    </div>

    <LogsList />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { formatRejection, money } from '@/i18n'
import WorkPanel from './WorkPanel.vue'
import BankPanel from './BankPanel.vue'
import FriendPanel from './FriendPanel.vue'
import LogsList from './LogsList.vue'
import SlotMachine from './SlotMachine.vue'
import RunPhasePanel from './RunPhasePanel.vue'

// Данные и действия — напрямую из стора, без prop-drilling (TD-06)
const game = useGameStore()
const hud = computed(() => game.hud)

const emit = defineEmits<{
  'exit-to-menu': []
}>()

const isSlotVisible = ref(false)

// Слот открыт = игрок в казино (location); закрытие — выход из казино
function openSlotMachine() {
  if (!game.actions.enterCasino) game.execute({ type: 'casino/enter' })
  isSlotVisible.value = game.hud?.location === 'casino'
}

function closeSlotMachine() {
  if (!game.actions.leaveCasino) game.execute({ type: 'casino/leave' })
  isSlotVisible.value = false
}

// День закончился (тильт 100, концовка) — модалка слота закрывается сама
watch(
  () => game.phase,
  (phase) => {
    if (phase !== 'day') isSlotVisible.value = false
  }
)
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

.fork-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.warning-text {
  color: #f59e0b;
  font-size: 0.875rem;
  margin: 0;
  font-weight: 600;
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

