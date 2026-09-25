<template>
  <Modal
    :open="open"
    variant="paper"
    size="md"
    form-no="ФОРМА №0-НАСТР"
    :title="SETTINGS.title"
    @update:open="(v) => !v && shell.closeOverlay('settings')"
  >
    <section class="set__group" aria-labelledby="set-sound">
      <h3 id="set-sound" class="set__head">{{ SETTINGS.sound }}</h3>
      <div class="set__row">
        <span id="set-sound-all">{{ SETTINGS.soundAll }} <kbd>M</kbd></span>
        <button
          type="button"
          role="switch"
          class="set__switch"
          aria-labelledby="set-sound-all"
          :aria-checked="sound.enabled.value"
          data-autofocus
          @click="sound.toggle()"
        >
          {{ sound.enabled.value ? SETTINGS.on : SETTINGS.off }}
        </button>
      </div>
      <div class="set__row">
        <label for="set-volume">{{ SETTINGS.volume }}</label>
        <input
          id="set-volume"
          class="set__range"
          type="range"
          min="0"
          max="100"
          step="5"
          :value="Math.round(sound.volume.value * 100)"
          :aria-valuetext="`${Math.round(sound.volume.value * 100)}%`"
          @input="onVolume"
          @change="sound.play('click')"
        />
      </div>
      <div class="set__row">
        <span id="set-music">{{ SETTINGS.music }}</span>
        <button
          type="button"
          role="switch"
          class="set__switch"
          aria-labelledby="set-music"
          :aria-checked="sound.musicWanted.value"
          @click="sound.setMusic(!sound.musicWanted.value)"
        >
          {{ sound.musicWanted.value ? SETTINGS.on : SETTINGS.off }}
        </button>
      </div>
    </section>

    <section class="set__group" aria-labelledby="set-screen">
      <h3 id="set-screen" class="set__head">{{ SETTINGS.screen }}</h3>
      <div class="set__row">
        <span id="set-calm">{{ SETTINGS.calm }}</span>
        <button
          type="button"
          role="switch"
          class="set__switch"
          aria-labelledby="set-calm"
          aria-describedby="set-calm-hint"
          :aria-checked="theme.calm.value"
          @click="theme.toggleCalm()"
        >
          {{ theme.calm.value ? SETTINGS.on : SETTINGS.off }}
        </button>
      </div>
      <p id="set-calm-hint" class="set__hint">
        {{ SETTINGS.calmHint }}
        <template v-if="theme.prefersReducedMotion.value"> {{ SETTINGS.calmSystemOn }}</template>
        <button type="button" class="set__link" @click="theme.setCalm(null)">{{ SETTINGS.calmSystem }}</button>
      </p>
      <div class="set__row">
        <span id="set-quick">{{ SETTINGS.quickSpin }}</span>
        <button
          type="button"
          role="switch"
          class="set__switch"
          aria-labelledby="set-quick"
          :aria-checked="game.settings.skipSpinAnimation"
          @click="game.updateSettings({ skipSpinAnimation: !game.settings.skipSpinAnimation })"
        >
          {{ game.settings.skipSpinAnimation ? SETTINGS.on : SETTINGS.off }}
        </button>
      </div>
      <div class="set__row">
        <label for="set-theme">{{ SETTINGS.theme }}</label>
        <select id="set-theme" class="set__select" :value="game.cosmetics.equipped.theme" @change="onTheme">
          <option v-for="item in themes" :key="item.id" :value="item.id" :disabled="!item.owned">
            {{ item.owned ? COSMETIC_NAMES[item.id] : `🔒 ${COSMETIC_NAMES[item.id]}` }}
          </option>
        </select>
      </div>
    </section>

    <section class="set__group" aria-labelledby="set-keys">
      <h3 id="set-keys" class="set__head">{{ SETTINGS.keys }}</h3>
      <dl class="set__keys">
        <template v-for="[key, what] in HOTKEYS" :key="key">
          <dt><kbd>{{ key }}</kbd></dt>
          <dd>{{ what }}</dd>
        </template>
      </dl>
    </section>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import { useSound } from '@/composables/useSound'
import { useTheme } from '@/composables/useTheme'
import { COSMETIC_NAMES } from '@/i18n'
import { HOTKEYS, SETTINGS } from '@/i18n/ui'
import Modal from '@/components/ui/Modal.vue'

/**
 * S06 Настройки: применяются сразу. Звук и «Быстрый спин» — в сейве (store.settings),
 * тема — надетая косметика (store.equip, как в Гардеробе; закрытые — 🔒), «Меньше мигания» — useTheme.
 */
const game = useGameStore()
const shell = useShell()
const sound = useSound()
const theme = useTheme()
const open = computed(() => shell.overlays.value.includes('settings'))

const themes = computed(() => game.cosmetics.items.filter((i) => i.kind === 'theme'))

function onVolume(event: Event) {
  sound.setVolume(Number((event.target as HTMLInputElement).value) / 100)
}

function onTheme(event: Event) {
  game.equip((event.target as HTMLSelectElement).value)
}
</script>

<style scoped>
.set__group {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-3) 0;
  border-bottom: 1px dashed var(--paper-line);
}
.set__group:last-child {
  border-bottom: 0;
}
.set__head {
  font-family: var(--font-condensed);
  font-size: var(--fs-sm);
  letter-spacing: var(--ls-wide);
}
.set__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  min-height: var(--tap-min);
  font-size: var(--fs-sm);
}
.set__switch {
  min-width: 72px;
  min-height: 36px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--paper-white);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.set__switch[aria-checked='true'] {
  background: var(--ink);
  color: var(--paper-white);
}
.set__range {
  width: min(180px, 50%);
  accent-color: var(--ink);
}
.set__select {
  min-height: 36px;
  padding: 0 var(--sp-2);
  border: 2px solid var(--ink);
  border-radius: var(--r-xs);
  background: var(--paper-white);
  color: var(--ink);
}
.set__hint {
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.set__link {
  margin-left: var(--sp-1);
  padding: 0;
  border: 0;
  background: none;
  color: var(--stamp-blue);
  text-decoration: underline;
  font-size: inherit;
}
.set__keys {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--sp-1) var(--sp-3);
  margin: 0;
  font-size: var(--fs-xs);
}
.set__keys dd {
  margin: 0;
}
kbd {
  display: inline-block;
  padding: 0 var(--sp-1);
  border: 1px solid var(--ink);
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
}
</style>
