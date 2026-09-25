<template>
  <Modal
    :open="open"
    variant="paper"
    size="sm"
    :title="hud ? PAUSE.title(hud.day) : 'ПАУЗА'"
    @update:open="(v) => !v && shell.closeOverlay('pause')"
  >
    <p class="pause__saved">{{ game.readOnly ? '—' : COMMON.saved }}</p>
    <div class="pause__list">
      <button type="button" class="paper-btn paper-btn--primary" data-autofocus @click="shell.closeOverlay('pause')">
        {{ PAUSE.resume }} <kbd>Esc</kbd>
      </button>
      <button type="button" class="paper-btn" @click="shell.openOverlay('settings')">{{ PAUSE.settings }}</button>
      <button type="button" class="paper-btn" @click="shell.openOverlay('howto')">{{ PAUSE.howTo }}</button>
      <button type="button" class="paper-btn" @click="toMenu">{{ PAUSE.toMenu }}</button>
    </div>
    <p class="pause__time">{{ PAUSE.playTime(duration(playSec)) }}</p>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { stat } from '@/game'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import { COMMON, duration, PAUSE } from '@/i18n/ui'
import Modal from '@/components/ui/Modal.vue'

/** S08 Пауза: выход в меню без подтверждения — сейв автоматический (B-01). */
const game = useGameStore()
const shell = useShell()
const hud = computed(() => game.hud)
const open = computed(() => shell.screen.value === 'game' && shell.overlays.value.includes('pause'))
const playSec = computed(() => (game.run ? stat(game.run.stats, 'playSec') : 0))

function toMenu() {
  game.revealPending()
  shell.go('menu')
}
</script>

<style scoped>
.pause__saved {
  color: var(--stamp-green);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.pause__list {
  display: grid;
  gap: var(--sp-2);
  margin: var(--sp-3) 0;
}
.pause__time {
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  opacity: 0.75;
}
</style>
