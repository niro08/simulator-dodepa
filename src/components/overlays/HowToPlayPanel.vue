<template>
  <Modal
    :open="open"
    variant="paper"
    size="md"
    form-no="ПАМЯТКА"
    :title="guide.title"
    @update:open="(v) => !v && shell.closeOverlay('howto')"
  >
    <ol class="howto__list">
      <li v-for="(line, i) in guide.lines" :key="i">{{ line }}</li>
    </ol>
    <p class="howto__footer">{{ guide.footer }}</p>
    <h3 class="howto__sub">{{ HOW_TO.keysTitle }}</h3>
    <dl class="howto__keys">
      <template v-for="[key, what] in HOTKEYS" :key="key">
        <dt><kbd>{{ key }}</kbd></dt>
        <dd>{{ what }}</dd>
      </template>
    </dl>
    <h3 class="howto__sub">{{ HOW_TO.helpTitle }}</h3>
    <p class="howto__help">
      {{ DISCLAIMER.menuFooter }} {{ DISCLAIMER.help }}
      <a :href="HELP_LINK.url" target="_blank" rel="noopener noreferrer">{{ HELP_LINK.text }}</a>
    </p>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { howToPlay } from '@/i18n'
import { DISCLAIMER, HELP_LINK, HOTKEYS, HOW_TO } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import Modal from '@/components/ui/Modal.vue'

/** S07 «Как играть»: 10 строк (content-pack §12.1, числа из конфига) + клавиши + ссылка на помощь (§12.4). */
const game = useGameStore()
const shell = useShell()
const guide = computed(() => howToPlay(game.config))
const open = computed(() => shell.overlays.value.includes('howto'))
</script>

<style scoped>
.howto__list {
  display: grid;
  gap: var(--sp-2);
  padding-left: var(--sp-5);
  list-style: decimal;
  font-size: var(--fs-sm);
}
.howto__footer {
  margin-top: var(--sp-3);
  font-weight: 700;
}
.howto__sub {
  margin-top: var(--sp-4);
  font-family: var(--font-condensed);
  font-size: var(--fs-md);
  text-transform: uppercase;
  letter-spacing: var(--ls-caps);
}
.howto__keys {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--sp-1) var(--sp-3);
  margin: var(--sp-2) 0 0;
  font-size: var(--fs-xs);
}
.howto__keys dd {
  margin: 0;
}
kbd {
  display: inline-block;
  padding: 0 var(--sp-1);
  border: 1px solid var(--ink);
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
}
.howto__help {
  font-size: var(--fs-sm);
}
.howto__help a {
  color: var(--stamp-blue);
  font-weight: 700;
}
</style>
