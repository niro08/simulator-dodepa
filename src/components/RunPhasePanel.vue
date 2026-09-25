<template>
  <!-- Минимальные экраны фаз рана (GDD §3.12). Полноценный UI — CD-16/CD-17 -->
  <section v-if="game.phase && game.phase !== 'day'" class="panel phase-panel">
    <template v-if="game.phase === 'event' && game.pendingEvent">
      <header>
        <h2>{{ eventText?.speaker ?? 'Ночью' }}</h2>
        <p class="muted">{{ eventText?.text }}</p>
      </header>
      <div class="phase-buttons">
        <button
          v-for="option in game.pendingEvent.options"
          :key="option.index"
          :disabled="!option.affordable"
          @click="game.execute({ type: 'event/choose', option: option.index })"
        >
          {{ eventText?.options[option.index] ?? `Вариант ${option.index + 1}` }}
          <span v-if="option.cost"> · −{{ money(option.cost) }}₽</span>
        </button>
      </div>
    </template>

    <template v-else-if="game.phase === 'bills' && hud?.bill">
      <header>
        <h2>🧾 Счёт недели {{ hud.bill.week }}</h2>
        <p class="muted">Итого {{ money(hud.bill.total) }}₽ · в кошельке {{ money(hud.wallet) }}₽. Баланс казино здесь не принимается.</p>
      </header>
      <div class="phase-buttons">
        <button :disabled="!!game.actions.payBill" @click="game.execute({ type: 'bills/pay' })">
          Оплатить {{ money(hud.bill.total) }}₽
        </button>
        <button :disabled="!!game.actions.deferBill" @click="game.execute({ type: 'bills/defer' })">⏳ Отсрочка (+50%)</button>
        <button class="danger" @click="game.execute({ type: 'bills/refuse' })">Не платить</button>
        <button v-if="!hud.forcedEnd" class="secondary" @click="game.execute({ type: 'day/resume' })">← Назад</button>
      </div>
      <p v-if="game.actions.payBill" class="warning-text">⚠️ {{ formatRejection('bills/pay', game.actions.payBill) }}</p>
    </template>

    <template v-else-if="game.phase === 'fork' && hud">
      <header>
        <h2>День {{ hud.day }}. Долг: {{ money(hud.debt) }}₽.</h2>
        <p class="muted">Счета оплачены. Приложение всё ещё на телефоне. Палец — над ним.</p>
      </header>
      <div class="phase-buttons">
        <button :disabled="!!game.actions.quit" @click="game.execute({ type: 'run/quit' })">ЗАВЯЗАТЬ</button>
        <button :disabled="!!game.actions.extend" @click="game.execute({ type: 'run/extend' })">ЕЩЁ НЕДЕЛЮ</button>
        <button v-if="!hud.forcedEnd" class="secondary" @click="game.execute({ type: 'day/resume' })">← Назад</button>
      </div>
      <p v-if="game.actions.quit" class="warning-text">⚠️ {{ formatRejection('run/quit', game.actions.quit) }}</p>
    </template>

    <template v-else-if="game.phase === 'daySummary' && game.daySummary">
      <header>
        <h2>Итог дня {{ game.daySummary.day }}</h2>
      </header>
      <ul class="summary">
        <li>Заработано: {{ money(game.daySummary.earned) }}₽</li>
        <li v-if="game.daySummary.casinoWagered">
          Казино: поставлено {{ money(game.daySummary.casinoWagered) }}₽, выплачено {{ money(game.daySummary.casinoPaidOut) }}₽
        </li>
        <li v-if="game.daySummary.casinoNight">Ночь в казино: −{{ money(game.daySummary.casinoNightLoss) }}₽</li>
        <li>Жизнь: −{{ money(game.daySummary.livingCost) }}₽</li>
        <li v-if="game.daySummary.interest">Проценты за ночь: +{{ money(game.daySummary.interest) }}₽ к долгу</li>
        <li>Долг: {{ money(game.daySummary.debt) }}₽ · ❤️ {{ signed(game.daySummary.repDelta) }} · 🔥 {{ signed(game.daySummary.tiltDelta) }}</li>
      </ul>
      <div class="phase-buttons">
        <button @click="game.execute({ type: 'day/wake' })">Дальше →</button>
      </div>
    </template>

    <template v-else-if="game.phase === 'ended' && game.statement">
      <header>
        <h2>{{ game.statement.endingId ? endingTitle(game.statement.endingId, game.statement.grade) : 'Конец' }}</h2>
        <p class="muted">Дней: {{ game.statement.days }} · Итог казино: {{ money(game.statement.casinoNetFinal) }}₽ · Спинов: {{ game.statement.spins }}</p>
      </header>
      <div class="phase-buttons">
        <button @click="game.newGame()">Ещё ран?</button>
      </div>
    </template>

    <template v-else-if="game.phase === 'morning'">
      <div class="phase-buttons">
        <button @click="game.execute({ type: 'day/wake' })">Утро дня {{ hud?.day }} →</button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { endingTitle, formatRejection, money, signed, SLEEP_EVENT_TEXTS } from '@/i18n'

const game = useGameStore()
const hud = computed(() => game.hud)
const eventText = computed(() => (game.pendingEvent ? SLEEP_EVENT_TEXTS[game.pendingEvent.eventId] : undefined))
</script>

<style scoped>
.phase-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.phase-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.summary {
  margin: 0;
  padding-left: 1.25rem;
}

.warning-text {
  color: #f59e0b;
  font-size: 0.875rem;
  margin: 0;
  font-weight: 600;
}
</style>
