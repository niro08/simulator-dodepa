<template>
  <div class="menu">
    <div class="menu__rain" aria-hidden="true">
      <span
        v-for="s in rain"
        :key="s.id"
        class="menu__drop"
        :style="{ left: s.left, animationDuration: s.dur, animationDelay: s.delay, fontSize: s.size }"
      >{{ s.glyph }}</span>
    </div>

    <header class="menu__top">
      <button
        type="button"
        class="menu__player"
        :aria-label="WARDROBE.titleChipAria(playerTitle)"
        @click="shell.go('wardrobe')"
      >
        <span aria-hidden="true">🏷</span> {{ playerTitle }}
      </button>
      <button
        type="button"
        class="menu__icon-btn"
        :aria-label="COMMON.soundAria(sound.enabled.value)"
        :aria-pressed="sound.enabled.value"
        @click="sound.toggle()"
      >
        <span aria-hidden="true">{{ sound.enabled.value ? '🔊' : '🔇' }}</span>
      </button>
    </header>

    <main class="menu__main">
      <div class="menu__brand">
        <ParodyLogo size="lg" slogan="" />
        <h1 class="menu__title">{{ MENU.title }}</h1>
        <p class="menu__tagline">{{ tagline }}</p>
      </div>

      <section
        v-if="game.notices.includes('legacy_run_reset')"
        class="menu__notice paper"
        role="status"
        aria-labelledby="menu-notice-title"
      >
        <p id="menu-notice-title" class="menu__notice-title">{{ MENU.legacyResetTitle }}</p>
        <p class="menu__notice-body">{{ MENU.legacyResetBody }}</p>
        <button type="button" class="paper-btn menu__notice-ok" @click="game.dismissNotice('legacy_run_reset')">
          {{ MENU.legacyResetOk }}
        </button>
      </section>

      <nav ref="nav" class="menu__list" aria-label="Главное меню">
        <button
          v-if="game.hasSave && hud"
          type="button"
          class="menu__continue"
          @click="emit('start', false)"
        >
          <span class="menu__continue-title">{{ MENU.continue }} <kbd>Enter</kbd></span>
          <span class="menu__continue-sub">{{ MENU.continueSub(hud.day, hud.runDays, hud.wallet, hud.debt, hud.endless ? hud.week : undefined) }}</span>
        </button>
        <button
          type="button"
          class="paper-btn menu__item menu__item--wide"
          :class="{ 'paper-btn--primary': !game.hasSave }"
          @click="onNewRun"
        >
          {{ MENU.newRun }}
        </button>
        <button type="button" class="paper-btn menu__item" @click="shell.go('wardrobe')">
          {{ MENU.wardrobe }}
          <span v-if="game.cosmetics.unseen.length > 0" class="menu__new" :aria-label="`${game.cosmetics.unseen.length} ${WARDROBE.newAria}`">
            NEW {{ game.cosmetics.unseen.length }}
          </span>
        </button>
        <button type="button" class="paper-btn menu__item" @click="shell.go('achievements')">
          {{ MENU.achievements }} <span class="menu__count">{{ achievementsOpen }}/{{ ACHIEVEMENTS_TOTAL }}</span>
        </button>
        <button type="button" class="paper-btn menu__item" @click="shell.go('endings')">
          {{ MENU.endings }} <span class="menu__count">{{ endingsOpen }}/{{ ENDING_IDS.length }}</span>
        </button>
        <button type="button" class="paper-btn menu__item" @click="shell.openOverlay('settings')">{{ MENU.settings }}</button>
        <button type="button" class="paper-btn menu__item menu__item--wide" @click="shell.openOverlay('howto')">
          {{ MENU.howTo }}
        </button>
      </nav>
    </main>

    <footer class="menu__foot">
      <p class="menu__lifetime">{{ lifetimeLine }}</p>
      <p class="menu__disclaimer">
        {{ DISCLAIMER.menuFooter }}
        {{ DISCLAIMER.help }}
        <a :href="HELP_LINK.url" target="_blank" rel="noopener noreferrer">{{ HELP_LINK.text }}</a>
        <span class="menu__ver">v{{ APP_VERSION }} · RU</span>
      </p>
    </footer>

    <Modal
      :open="confirmOpen"
      variant="paper"
      size="sm"
      :title="MENU.confirmTitle"
      @update:open="confirmOpen = $event"
    >
      <p>{{ hud ? MENU.confirmBody(hud.day, hud.runDays, hud.endless ? hud.week : undefined) : '' }}</p>
      <p class="menu__confirm-keep">{{ MENU.confirmKeep }}</p>
      <template #footer="{ close }">
        <div class="menu__confirm-actions">
          <button type="button" class="paper-btn" data-autofocus @click="close">{{ MENU.confirmNo }} <kbd>Esc</kbd></button>
          <button type="button" class="paper-btn" @click="confirmNew">{{ MENU.confirmYes }}</button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { casinoNetFinal, ENDING_IDS, stat } from '@/game'
import { APP_VERSION } from '@/platform'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import { useSound } from '@/composables/useSound'
import { useTheme } from '@/composables/useTheme'
import { COSMETIC_NAMES } from '@/i18n'
import { COMMON, DISCLAIMER, duration, HELP_LINK, MENU, WARDROBE } from '@/i18n/ui'
import ParodyLogo from '@/components/ui/ParodyLogo.vue'
import Modal from '@/components/ui/Modal.vue'

const emit = defineEmits<{ start: [isNew: boolean] }>()

const game = useGameStore()
const shell = useShell()
const sound = useSound()
const theme = useTheme()

const hud = computed(() => (game.hasSave ? game.hud : null))
const tagline = MENU.taglines[Math.floor(Date.now() / 86_400_000) % MENU.taglines.length]
const ACHIEVEMENTS_TOTAL = computed(() => game.achievements.length)
const achievementsOpen = computed(() => game.achievements.filter((a) => a.unlocked).length)
const endingsOpen = computed(() => game.endingsCollection.filter((e) => e.unlocked).length)
const playerTitle = computed(() => COSMETIC_NAMES[game.cosmetics.equipped.title] ?? '')

const lifetimeLine = computed(() => {
  const s = game.profile.stats
  const lost = Math.max(0, -casinoNetFinal(s))
  return MENU.lifetime(lost, stat(s, 'spins'), duration(stat(s, 'playSec')))
})

// Падающие символы (фон). В «Меньше мигания» — не показываем вовсе.
const GLYPHS = ['🍒', '7️⃣', '💎', '🍋', '⭐', '🤡', '💸', '🎰']
const rain = computed(() => {
  if (theme.motionReduced.value) return []
  return Array.from({ length: 14 }, (_, i) => ({
    id: i,
    glyph: GLYPHS[i % GLYPHS.length],
    left: `${(i * 73) % 100}%`,
    dur: `${9 + ((i * 37) % 8)}s`,
    delay: `${-((i * 53) % 9)}s`,
    size: `${1.1 + ((i * 29) % 10) / 10}rem`
  }))
})

const confirmOpen = ref(false)
const nav = ref<HTMLElement | null>(null)

function onNewRun() {
  if (game.hasSave) confirmOpen.value = true
  else emit('start', true)
}

function confirmNew() {
  confirmOpen.value = false
  emit('start', true)
}

onMounted(async () => {
  await nextTick()
  nav.value?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true })
})
</script>

<style scoped>
.menu {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: var(--sp-4);
  overflow: hidden;
}

.menu__rain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.menu__drop {
  position: absolute;
  top: -3rem;
  opacity: 0.35;
  animation: menu-fall linear infinite;
}
@keyframes menu-fall {
  to {
    transform: translateY(110vh);
  }
}

.menu__top {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
}
.menu__player {
  min-height: var(--tap-min);
  padding: 0 var(--sp-3);
  border: 1px solid var(--c-gold);
  border-radius: var(--r-pill);
  background: var(--c-panel);
  color: var(--c-gold);
  font-family: var(--font-condensed);
  font-size: var(--fs-sm);
  font-weight: 700;
  letter-spacing: 0.04em;
}
.menu__new {
  padding: 0 6px;
  border-radius: var(--r-pill);
  background: #ffff00;
  color: #0b0620;
  box-shadow: 0 0 0 1px #ff2bd6;
  font-family: var(--font-condensed);
  font-size: var(--fs-fine);
}
.menu__icon-btn {
  min-width: var(--tap-min);
  min-height: var(--tap-min);
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: var(--c-panel);
  font-size: var(--fs-lg);
}

.menu__main {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-6);
  padding: var(--sp-5) 0;
}

.menu__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-2);
  text-align: center;
}
.menu__title {
  font-family: var(--font-display);
  font-size: var(--fs-3xl);
  text-transform: var(--tt-display);
  letter-spacing: var(--ls-caps);
  text-shadow: var(--tshadow-neon);
}
.menu__tagline {
  color: var(--c-text-muted);
  font-size: var(--fs-md);
}

.menu__notice {
  width: min(460px, 100%);
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-4);
  text-align: left;
}
.menu__notice-title {
  font-weight: 700;
}
.menu__notice-body {
  font-size: var(--fs-sm);
  line-height: 1.45;
}
.menu__notice-ok {
  justify-self: end;
}
.menu__list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
  width: min(460px, 100%);
}
.menu__item {
  justify-content: space-between;
}
.menu__item--wide {
  grid-column: 1 / -1;
  justify-content: center;
}
.menu__count {
  font-weight: 400;
  color: var(--ink-muted);
}
.paper-btn--primary .menu__count {
  color: inherit;
}

.menu__continue {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-1);
  padding: var(--sp-3) var(--sp-4);
  border: 2px solid var(--ink);
  border-radius: var(--r-xs);
  background: var(--ink);
  color: var(--paper-white);
  font-family: var(--font-mono);
  text-align: left;
  box-shadow: 3px 3px 0 var(--c-accent-2);
}
.menu__continue:hover {
  background: #333;
}
.menu__continue-title {
  font-weight: 700;
  font-size: var(--fs-md);
}
.menu__continue-sub {
  font-size: var(--fs-xs);
  color: var(--paper-dark-muted);
}

kbd {
  padding: 0 var(--sp-1);
  border: 1px solid currentColor;
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  font-weight: 400;
  opacity: 0.8;
}

.menu__foot {
  position: relative;
  display: grid;
  gap: var(--sp-2);
  padding-top: var(--sp-3);
  border-top: 1px solid var(--c-line);
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.menu__disclaimer a {
  color: var(--c-accent-2);
}
.menu__ver {
  float: right;
  margin-left: var(--sp-3);
  color: var(--c-text-fine);
}

.menu__confirm-keep {
  margin-top: var(--sp-2);
  color: var(--ink-muted);
}
.menu__confirm-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--sp-3);
}

@media (max-width: 480px) {
  .menu__list {
    grid-template-columns: 1fr;
  }
  .menu__item {
    grid-column: 1 / -1;
  }
}
</style>
