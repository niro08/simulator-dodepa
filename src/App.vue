<template>
  <CasinoUI
    :stats="casinoStore.stats"
    :logs="casinoStore.logs"
    @bet-placed="casinoStore.placeBet"
    @spin-result="casinoStore.handleSlotResult"
    @work-job="casinoStore.workJob"
    @borrow-money="casinoStore.borrowMoney"
    @take-credit="casinoStore.takeCredit"
    @help-friend="casinoStore.helpFriend"
    @repay-debt="casinoStore.repayDebt"
    @reset-game="casinoStore.resetGame"
    @update:bet="casinoStore.setBet"
  />
</template>

<script setup lang="ts">
import { useCasinoStore } from '@/stores/casino'
import CasinoUI from '@/components/CasinoUI.vue'

const casinoStore = useCasinoStore()
</script>
