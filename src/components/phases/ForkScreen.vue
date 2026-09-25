<template>
  <section class="fk" aria-labelledby="fk-title" @keydown="onKey">
    <p class="fk__kicker">{{ FORK.kicker(hud?.day ?? 28) }}</p>
    <h2 id="fk-title" class="fk__title">{{ FORK.title(hud?.debt ?? 0) }}</h2>
    <p class="fk__body">{{ FORK.body }}</p>

    <div class="fk__cards">
      <article class="fk__card fk__card--quit paper">
        <h3 class="fk__card-title">{{ FORK.quit }}</h3>
        <p>{{ FORK.quitSub }}</p>
        <p v-if="grade" class="fk__grade">{{ ENDING_SCREEN.grade(grade) }}</p>
        <button
          ref="quitBtn"
          type="button"
          class="paper-btn paper-btn--primary fk__btn"
          :aria-disabled="!!quitReason || undefined"
          :aria-describedby="quitReason ? 'fk-quit-reason' : undefined"
          @click="!quitReason && shell.requestQuit()"
        >
          ✓ {{ FORK.quit }} <kbd>1</kbd>
        </button>
        <p v-if="quitReason" id="fk-quit-reason" class="paper-reason">⚠ {{ quitReason }}</p>
      </article>

      <article class="fk__card fk__card--more vitrina">
        <h3 class="fk__card-title fk__neon">{{ FORK.more }}</h3>
        <p>{{ FORK.moreSub(B.ENDLESS_BILL_GROWTH) }}</p>
        <NeonButton
          class="fk__btn"
          variant="hot"
          size="lg"
          :pulse="!game.actions.extend"
          :disabled="!!game.actions.extend"
          :disabled-reason="game.actions.extend ? formatRejection('run/extend', game.actions.extend) : undefined"
          @click="game.execute({ type: 'run/extend' })"
        >
          {{ FORK.more }} <kbd>2</kbd>
        </NeonButton>
      </article>
    </div>

    <p class="fk__foot">{{ FORK.footnote }}</p>
    <button v-if="hud && !hud.forcedEnd" type="button" class="fk__back" @click="game.execute({ type: 'day/resume' })">{{ FORK.back }}</button>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { quitGrade } from '@/game'
import { formatRejection } from '@/i18n'
import { ENDING_SCREEN, FORK } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import NeonButton from '@/components/ui/NeonButton.vue'

/**
 * S46 «ЗАВЯЗАТЬ / ЕЩЁ НЕДЕЛЮ»: равный размер целей, «Завязать» первым и в фокусе.
 * Без таймера и авто-выбора: ←/→ и 1/2 только двигают фокус, подтверждение — Enter.
 */
const game = useGameStore()
/** «ЗАВЯЗАТЬ» — через shell.requestQuit: при деньгах на сайте сначала предупреждение E24 (QA-01). */
const shell = useShell()
const B = game.config.balance
const hud = computed(() => game.hud)
const quitReason = computed(() => {
  const r = game.actions.quit
  if (!r) return null
  return r.reason === 'has_debt' ? FORK.locked(r.min ?? hud.value?.debt ?? 0) : formatRejection('run/quit', r)
})
const grade = computed(() => (game.run && !quitReason.value ? quitGrade(game.run, B) : null))

const quitBtn = ref<HTMLElement | null>(null)
function onKey(event: KeyboardEvent) {
  const root = event.currentTarget as HTMLElement
  const btns = Array.from(root.querySelectorAll<HTMLElement>('.fk__btn, .fk__btn button')).filter((b) => b.tagName === 'BUTTON')
  const pick = event.key === 'ArrowLeft' || event.key === '1' ? 0 : event.key === 'ArrowRight' || event.key === '2' ? 1 : -1
  if (pick < 0) return
  btns[pick]?.focus()
  event.preventDefault()
}
onMounted(async () => {
  await nextTick()
  quitBtn.value?.focus({ preventScroll: true })
})
</script>

<style scoped>
.fk {
  width: min(960px, 100%);
  margin: 0 auto;
  display: grid;
  gap: var(--sp-4);
  padding: var(--sp-6) var(--sp-4) var(--sp-7);
  text-align: center;
}
.fk__kicker {
  font-family: var(--font-mono);
  color: var(--c-text-muted);
  letter-spacing: var(--ls-wide);
}
.fk__title {
  font-family: var(--font-display);
  font-size: var(--fs-2xl);
}
.fk__body {
  max-width: 60ch;
  margin: 0 auto;
  color: var(--c-text-muted);
}
.fk__cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-5);
  text-align: left;
}
.fk__card {
  display: grid;
  align-content: start;
  gap: var(--sp-2);
  padding: var(--sp-5);
  min-height: 240px;
}
.fk__card--more {
  border: 3px solid var(--c-accent-1);
  border-radius: var(--r-md);
  background: var(--c-panel);
  box-shadow: var(--glow-1);
}
.fk__card-title {
  font-family: var(--font-display);
  font-size: var(--fs-xl);
}
.fk__neon {
  color: var(--c-gold);
  text-shadow: var(--tshadow-gold);
}
.fk__grade {
  font-weight: 700;
}
.fk__btn {
  margin-top: auto;
  min-height: 56px;
}
.fk__foot {
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
}
.fk__back {
  justify-self: center;
  min-height: var(--tap-min);
  padding: 0 var(--sp-4);
  border: 1px solid var(--c-line);
  border-radius: var(--r-pill);
  background: transparent;
}
kbd {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  font-weight: 400;
  opacity: 0.8;
}
@media (max-width: 700px) {
  .fk__cards {
    grid-template-columns: 1fr;
  }
}
</style>
