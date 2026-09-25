<template>
  <p v-if="game.readOnly" class="save-warning" role="status">{{ COMMON.saveReadOnly }}</p>

  <MainMenu v-if="shell.screen.value === 'menu'" @start="startRun" />
  <WardrobeScreen v-else-if="shell.screen.value === 'wardrobe'" />
  <AchievementsScreen v-else-if="shell.screen.value === 'achievements'" />
  <EndingsScreen v-else-if="shell.screen.value === 'endings'" />
  <GameShell v-else />

  <PauseMenu />
  <SettingsPanel />
  <HowToPlayPanel />
  <ToastLayer />

  <!-- Переход меню → ран: ≤ 600 мс, без вращения, пропускается кликом или любой клавишей (ux-flows §1) -->
  <div
    v-if="transitioning"
    class="run-transition"
    :class="{ 'run-transition--calm': theme.motionReduced.value }"
    role="presentation"
    @click="endTransition"
  >
    <span class="run-transition__emoji" aria-hidden="true">🎰</span>
    <span class="run-transition__hint">{{ COMMON.skipTransition }}</span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { usePlayTime } from '@/composables/usePlayTime'
import { useShell } from '@/composables/useShell'
import { useSound } from '@/composables/useSound'
import { useTheme, type ThemeId } from '@/composables/useTheme'
import { useToasts } from '@/composables/useToasts'
import { COMMON } from '@/i18n/ui'
import MainMenu from '@/components/menu/MainMenu.vue'
import WardrobeScreen from '@/components/meta/WardrobeScreen.vue'
import AchievementsScreen from '@/components/meta/AchievementsScreen.vue'
import EndingsScreen from '@/components/meta/EndingsScreen.vue'
import GameShell from '@/components/game/GameShell.vue'
import PauseMenu from '@/components/overlays/PauseMenu.vue'
import SettingsPanel from '@/components/overlays/SettingsPanel.vue'
import HowToPlayPanel from '@/components/overlays/HowToPlayPanel.vue'
import ToastLayer from '@/components/overlays/ToastLayer.vue'

const game = useGameStore()
const shell = useShell()
const theme = useTheme()
const sound = useSound()
const toasts = useToasts()
// Тема Витрины — надетая косметика (CD-19): единый источник — store.cosmetics.equipped.theme
watch(
  () => game.cosmetics.equipped.theme,
  (id) => theme.setTheme(id.replace(/^theme:/, '') as ThemeId),
  { immediate: true }
)
// Активное время игры для статистики и Выписки (systems-spec §3.6)
usePlayTime()

const TRANSITION_MS = 550
const transitioning = ref(false)
let transitionTimer: ReturnType<typeof setTimeout> | undefined

function endTransition() {
  if (transitionTimer) clearTimeout(transitionTimer)
  transitionTimer = undefined
  transitioning.value = false
}

/** Старт или продолжение рана. Экран меняется сразу, переход — только декор поверх. */
function startRun(isNew: boolean) {
  if (transitioning.value) return
  if (isNew || !game.hasSave) game.newGame()
  shell.statementOpen.value = false
  shell.setTab('casino')
  shell.go('game')
  sound.playStart()
  transitioning.value = true
  transitionTimer = setTimeout(endTransition, theme.motionReduced.value ? 250 : TRANSITION_MS)
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

/** Esc: закрыть верхний слой, иначе — пауза в ране / назад в меню (ux-flows §3.4). */
function onEscape(): boolean {
  if (shell.topOverlay.value) {
    shell.closeOverlay()
    return true
  }
  if (shell.exitStep.value > 0) {
    shell.exitLeave() // В S14 Esc = «уйти»: Esc всегда ведёт к выходу
    return true
  }
  if (shell.sleepConfirm.value) {
    shell.sleepConfirm.value = false
    return true
  }
  if (shell.bonusOffer.value) {
    shell.bonusOffer.value = false
    return true
  }
  if (shell.cashier.value) {
    shell.cashier.value = null
    return true
  }
  if (shell.screen.value === 'game') {
    shell.openOverlay('pause')
    return true
  }
  if (shell.screen.value !== 'menu') {
    shell.goBackFromMeta()
    return true
  }
  return false
}

function onKeydown(event: KeyboardEvent) {
  if (transitioning.value) {
    endTransition()
    if (event.key !== 'Escape') return
  }
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'Escape') {
    if (onEscape()) event.preventDefault()
    return
  }
  if (isTyping(event.target)) return
  if (event.code === 'KeyM') {
    const on = sound.toggle()
    toasts.push({ kind: 'system', name: on ? COMMON.soundOn : COMMON.soundOff, icon: on ? '🔊' : '🔇' })
    event.preventDefault()
    return
  }
  if (event.key === '?' || event.key === 'F1') {
    shell.openOverlay('howto')
    event.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  endTransition()
})
</script>

<style>
.save-warning {
  position: fixed;
  inset: 0 0 auto;
  z-index: var(--z-flash);
  padding: var(--sp-2) var(--sp-4);
  background: var(--c-gold);
  color: var(--c-cta-text);
  font-weight: 700;
  text-align: center;
}

.run-transition {
  position: fixed;
  inset: 0;
  z-index: var(--z-flash);
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--sp-4);
  background: var(--c-page);
  animation: run-fade 550ms ease-in forwards;
  cursor: pointer;
}
.run-transition__emoji {
  font-size: clamp(4rem, 18vw, 10rem);
  animation: run-pop 550ms var(--ease-out) both;
}
.run-transition__hint {
  color: var(--c-text-fine);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.run-transition--calm .run-transition__emoji {
  animation: none;
}
@keyframes run-fade {
  0%,
  55% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes run-pop {
  from {
    transform: scale(0.6);
  }
  to {
    transform: scale(1.15);
  }
}
</style>
