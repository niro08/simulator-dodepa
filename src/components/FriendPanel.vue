<template>
  <section class="panel friend">
    <header>
      <h2>Друзья и ломбард</h2>
      <p class="muted">Друзья не банк. Ломбард — тоже, но у него процент</p>
    </header>

    <div class="button-with-warning">
      <button @click="game.execute({ type: 'friends/borrow' })" :disabled="!!game.actions.borrow">
        🤝 Занять у друга {{ hud?.friendAmount ? `${money(hud.friendAmount)}₽` : '' }} (−{{ B.FRIEND_ENERGY }}⚡, {{ signed(B.FRIEND_REP) }}❤️)
      </button>
      <div class="warnings-container">
        <p v-if="game.actions.borrow" class="warning-text">⚠️ {{ formatRejection('friends/borrow', game.actions.borrow) }}</p>
        <p v-else class="warning-text-placeholder">&nbsp;</p>
      </div>
    </div>

    <div v-for="item in ITEM_IDS" :key="item" class="button-with-warning">
      <button
        v-if="hud?.items[item] === 'owned'"
        @click="game.execute({ type: 'pawn/pawn', item })"
        :disabled="!!game.canExecute({ type: 'pawn/pawn', item })"
      >
        🏷 Заложить {{ ITEM_NAMES[item] }} +{{ money(B.PAWN_VALUE[item]) }}₽
      </button>
      <button
        v-else-if="hud?.items[item] === 'pawned'"
        @click="game.execute({ type: 'pawn/redeem', item })"
        :disabled="!!game.canExecute({ type: 'pawn/redeem', item })"
      >
        ↩️ Выкупить {{ ITEM_NAMES[item] }} за {{ money(redeemCost(item, B)) }}₽
      </button>
      <p v-else class="muted">{{ ITEM_NAMES[item] }} — продан навсегда</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ITEM_IDS, redeemCost } from '@/game'
import { useGameStore } from '@/stores/game'
import { formatRejection, ITEM_NAMES, money, signed } from '@/i18n'

const game = useGameStore()
const B = game.config.balance
const hud = computed(() => game.hud)
</script>

<style scoped>
.panel.friend {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel.friend > p {
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.5rem;
  text-align: center;
  font-weight: 600;
}

.button-with-warning {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.button-with-warning button {
  width: 100%;
}

.warnings-container {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.warning-text {
  color: #f59e0b;
  font-size: 0.875rem;
  margin: 0;
  text-align: center;
  font-weight: 600;
  padding: 0.25rem;
  min-height: 1.5rem;
}

.warning-text-placeholder {
  min-height: 1.5rem;
  margin: 0;
  padding: 0.25rem;
}
</style>
