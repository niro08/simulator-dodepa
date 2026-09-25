<template>
  <header class="site vitrina" role="banner">
    <div class="site__row">
      <ParodyLogo class="site__logo" :compact="compact" size="sm" slogan="" />
      <p class="site__address">
        <span aria-hidden="true">🔒</span>
        <span class="vitrina-only">{{ SITE.address }}</span>
        <span class="honest honest-inline">{{ SITE.addressHonest }}</span>
      </p>
      <nav class="site__nav vitrina-only" aria-hidden="true">
        <span v-for="n in SITE.nav" :key="n">{{ n }}</span>
      </nav>

      <div v-if="hud" class="site__money">
        <div class="site__pill">
          <StatPlate
            variant="casino"
            icon="🎰"
            :label="SITE.casino"
            :value="hud.casino"
            :locked="hud.bonus.state === 'active'"
            :progress="hud.bonus.state === 'active' ? hud.bonus.wagered / Math.max(1, hud.bonus.wagerReq) : undefined"
            compact
          />
          <span class="honest site__pill-honest">{{ SITE.casinoHonest }}</span>
        </div>
        <div class="site__pill">
          <StatPlate variant="wallet" icon="👛" :label="SITE.wallet" :value="hud.wallet" compact />
          <span v-if="pendingNet > 0" class="site__pending">{{ SITE.withdrawPending(pendingNet) }}</span>
        </div>
        <NeonButton
          class="site__deposit"
          variant="cta"
          :size="compact ? 'sm' : 'md'"
          :pulse="!calmHeader"
          :disabled="game.phase !== 'day'"
          :aria-label="`${SITE.deposit} (D)`"
          @click="shell.openCashier('deposit')"
        >
          <span class="vitrina-only">{{ SITE.deposit }}</span>
          <span class="honest honest-inline">Депозит</span>
        </NeonButton>
      </div>

      <div class="site__sys">
        <button
          type="button"
          class="site__icon site__glasses"
          :class="{ 'site__glasses--on': theme.isIznanka.value }"
          :aria-pressed="theme.isIznanka.value"
          :aria-label="COMMON.glassesAria(theme.isIznanka.value)"
          @click="shell.toggleLayer()"
        >
          <span aria-hidden="true">{{ theme.isIznanka.value ? '🕶️' : '👓' }}</span>
          <span class="site__glasses-text">{{ theme.isIznanka.value ? 'Надеть обратно' : 'Снять очки' }}</span>
          <kbd class="site__kbd">I</kbd>
        </button>
        <button
          type="button"
          class="site__icon"
          :aria-pressed="sound.enabled.value"
          :aria-label="COMMON.soundAria(sound.enabled.value)"
          @click="sound.toggle()"
        >
          <span aria-hidden="true">{{ sound.enabled.value ? '🔊' : '🔇' }}</span>
        </button>
        <button type="button" class="site__icon" :aria-label="COMMON.pauseAria" @click="shell.openOverlay('pause')">
          <span aria-hidden="true">⏸</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import { useSound } from '@/composables/useSound'
import { useTheme } from '@/composables/useTheme'
import { COMMON, SITE } from '@/i18n/ui'
import ParodyLogo from '@/components/ui/ParodyLogo.vue'
import StatPlate from '@/components/ui/StatPlate.vue'
import NeonButton from '@/components/ui/NeonButton.vue'

/**
 * Шапка-«сайт» (art-bible §3.1, ux-flows §4.2): лого, фейковый адрес, пилюли баланса казино и кошелька,
 * пульсирующая ДЕПОЗИТ; 👓, 🔊, ⏸ — всегда на месте и не меняются от тильта.
 */
defineProps<{ compact?: boolean }>()

const game = useGameStore()
const shell = useShell()
const sound = useSound()
const theme = useTheme()
const hud = computed(() => game.hud)
const pendingNet = computed(() => hud.value?.withdrawals.reduce((s, w) => s + w.net, 0) ?? 0)
// На экранах чека/развилки ДЕПОЗИТ не пульсирует: там решается жизнь
const calmHeader = computed(() => game.phase !== 'day')
</script>

<style scoped>
.site {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  background: linear-gradient(180deg, #170b33, #0b0620);
  border-bottom: 2px solid var(--c-line-neon);
  box-shadow: 0 4px 24px rgba(255, 43, 214, 0.18);
}
.site__row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--sp-2) var(--sp-4);
}
.site__logo {
  flex: none;
}
.site__address {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 2px var(--sp-2);
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.06);
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  white-space: nowrap;
}
.site__nav {
  display: flex;
  gap: var(--sp-3);
  font-family: var(--font-condensed);
  font-size: var(--fs-sm);
  letter-spacing: var(--ls-caps);
  color: var(--c-text-muted);
  white-space: nowrap;
}
.site__money {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-left: auto;
}
.site__pill {
  display: grid;
  justify-items: end;
}
.site__pill-honest,
.site__pending {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  color: var(--c-text-muted);
  white-space: nowrap;
}
.site__sys {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.site__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-1);
  min-width: var(--tap-min);
  min-height: var(--tap-min);
  padding: 0 var(--sp-2);
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: transparent;
  font-size: var(--fs-lg);
}
.site__glasses {
  border: 2px solid var(--c-accent-2);
  color: var(--c-accent-2);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.site__glasses--on {
  border-color: var(--ink);
  background: var(--paper);
  color: var(--ink);
}
.site__glasses-text {
  white-space: nowrap;
}
.site__kbd {
  padding: 0 4px;
  border: 1px solid currentColor;
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  opacity: 0.7;
}

@media (max-width: 1279px) {
  .site__nav {
    display: none;
  }
}
@media (max-width: 1023px) {
  .site__row {
    flex-wrap: wrap;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
  }
  .site__address {
    display: none;
  }
  .site__sys {
    margin-left: auto;
  }
  .site__money {
    order: 3;
    flex-basis: 100%;
    justify-content: space-between;
    margin-left: 0;
  }
  .site__glasses-text,
  .site__kbd {
    display: none;
  }
}
@media (max-width: 420px) {
  .site__icon {
    min-width: 40px;
    padding: 0 var(--sp-1);
  }
  .site__money {
    gap: var(--sp-1);
  }
  .site__pill-honest {
    display: none !important;
  }
}
</style>
