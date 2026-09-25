<template>
  <div id="slot-zone" ref="zone" class="slot" tabindex="-1" :aria-busy="shell.spinning.value">
    <SlotFrame
      :title="SLOT.title"
      :skin="frameSkin"
      :lamp-mode="lampMode"
      :shake-key="shakeKey"
      :flash-key="flashKey"
      :burst-key="burstKey"
      :aria-label="`Слот ${SLOT.title}`"
    >
      <div class="slot__reels">
        <div
          v-for="(strip, i) in strips"
          :key="i"
          ref="reelEls"
          class="slot__reel fx-reel-window"
          :class="{ 'fx-near-miss': nearMissKey > 0 && i === 2, 'fx-reel-blur': blur }"
          aria-hidden="true"
        >
          <div class="slot__strip" :style="stripStyle(i)">
            <span v-for="(sym, j) in strip" :key="j" class="slot__sym">{{ symbolsMap[sym] }}</span>
          </div>
        </div>
      </div>

      <template #result>
        <div class="slot__result">
          <p v-if="shell.spinning.value" class="slot__banner slot__banner--busy">
            <span class="vitrina-only">{{ SLOT.spinBusy }}</span>
            <span class="honest honest-inline">{{ SLOT.spinBusyHonest }}</span>
          </p>
          <template v-else-if="last">
            <p class="slot__banner vitrina-only" :class="`slot__banner--${tone}`">{{ bannerText }}</p>
            <div class="honest slot__honest">
              <p>{{ SLOT.opLine(opNumber, last.bet, last.payout, lastNet) }}</p>
              <p v-if="honestLine" class="slot__honest-sub">{{ honestLine }}</p>
            </div>
            <Stamp
              v-if="isIznanka && lastNet !== 0"
              class="slot__stamp"
              :text="lastNet < 0 ? SLOT.stampLoss(lastNet) : SLOT.stampWin(lastNet)"
              :tone="lastNet < 0 ? 'red' : 'green'"
              size="md"
              :replay-key="opNumber"
              decorative
            />
          </template>
          <p v-else class="slot__banner slot__banner--idle">
            <span class="vitrina-only">{{ SLOT.placeholder }}</span>
            <span class="honest honest-inline">{{ idleHonest }}</span>
          </p>
          <Badge kind="rtp" :animated="false" class="slot__rtp" />
        </div>
      </template>

      <template #footer>
        <div class="slot__controls">
          <div class="slot__bet">
            <label class="slot__bet-label" for="bet-input">
              <span class="vitrina-only">{{ SLOT.bet }}</span>
              <span class="honest honest-inline">{{ SLOT.betHonest }}</span>
            </label>
            <div class="slot__bet-field">
              <input
                id="bet-input"
                class="slot__bet-input tabular"
                type="number"
                inputmode="numeric"
                :aria-label="SLOT.betAria"
                :min="B.MIN_BET"
                :step="B.BET_STEP"
                :value="betDraft"
                :aria-disabled="busy || undefined"
                :readonly="busy"
                @input="onBetInput"
                @change="commitBet"
                @keydown.enter.prevent="spin"
              />
              <span aria-hidden="true">₽</span>
            </div>
            <div class="slot__chips" role="group" aria-label="Изменить ставку">
              <button type="button" class="slot__chip" :aria-disabled="busy || undefined" aria-label="Половина ставки (−)" @click="adjust('half')">
                {{ SLOT.half }}
              </button>
              <button type="button" class="slot__chip" :aria-disabled="busy || undefined" aria-label="Удвоить ставку (=)" @click="adjust('double')">
                {{ SLOT.double }}
              </button>
              <button type="button" class="slot__chip" :aria-disabled="busy || undefined" aria-label="Минимальная ставка (0)" @click="adjust('min')">
                {{ SLOT.min }}
              </button>
            </div>
            <NeonButton
              class="slot__allin"
              variant="hot"
              size="sm"
              :disabled="busy || casino < B.MIN_BET"
              :aria-label="`${SLOT.allIn}: поставить весь баланс ${money(casino)} рублей. Спин — отдельно`"
              @click="adjust('all')"
            >
              {{ SLOT.allIn }} 🔥
            </NeonButton>
          </div>
          <p class="honest slot__honest-note">{{ SLOT.doubleHonest }} · {{ SLOT.allInHonest(casino) }}</p>
          <p v-if="effectiveNote" class="slot__note">{{ effectiveNote }}</p>

          <div class="slot__spin-row">
            <NeonButton
              v-if="needsDeposit"
              variant="cta"
              size="xl"
              block
              pulse
              icon="💳"
              @click="shell.openCashier('deposit')"
            >
              {{ SLOT.depositToPlay }}
            </NeonButton>
            <NeonButton
              v-else
              variant="cta"
              size="xl"
              block
              :pulse="!busy"
              icon="🎰"
              :disabled="busy || !!spinBlock"
              :disabled-reason="spinReason"
              :aria-label="`${SLOT.spin}, ${SLOT.spinCost(hud?.spinEnergyCost ?? 0)}. Клавиша Пробел`"
              @click="spin"
            >
              {{ busy ? SLOT.spinBusy : SLOT.spin }}
              <span class="slot__cost">· {{ SLOT.spinCost(hud?.spinEnergyCost ?? 0) }}</span>
              <kbd class="slot__kbd">{{ SLOT.hotkey }}</kbd>
            </NeonButton>
            <p v-if="needsDeposit" class="honest slot__honest-note">{{ SLOT.depositToPlayHonest }}</p>
            <p class="honest slot__honest-note">{{ SLOT.spinHonest(hud?.effectiveBet ?? 0, expectedLoss) }}</p>
            <p v-if="(hud?.spinEnergyCost ?? 1) === 0" class="honest slot__honest-note">{{ SLOT.freeSpinHonest }}</p>
          </div>

          <div v-if="hud && hud.bonus.state === 'active'" class="slot__wager">
            <p>{{ SLOT.wager(hud.bonus.wagered, hud.bonus.wagerReq) }}*</p>
            <div class="slot__wager-bar" role="progressbar" :aria-valuenow="hud.bonus.wagered" :aria-valuemin="0" :aria-valuemax="hud.bonus.wagerReq">
              <span :style="{ width: `${Math.min(100, (hud.bonus.wagered / Math.max(1, hud.bonus.wagerReq)) * 100)}%` }" />
            </div>
            <p v-if="game.underbelly?.bonus" class="honest slot__honest-note">
              {{ SLOT.wagerHonest(game.underbelly.bonus.forecast.expectedLeft) }}
            </p>
          </div>
        </div>
      </template>
    </SlotFrame>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ srText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { canExecute, type EventOf, type Rejection, type SymbolId } from '@/game'
import { eventTone, formatEventHonest, formatRejection, formatSpinBanner, money } from '@/i18n'
import { PROTOCOL, SLOT } from '@/i18n/ui'
import { skinDef, skinSymbols } from '@/skins'
import type { SlotFrameSkin } from '@/components/ui/SlotFrame.vue'
import { useGameStore, type BetAdjust } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import { useTheme } from '@/composables/useTheme'
import SlotFrame from '@/components/ui/SlotFrame.vue'
import NeonButton from '@/components/ui/NeonButton.vue'
import Badge from '@/components/ui/Badge.vue'
import Stamp from '@/components/ui/Stamp.vue'

/**
 * S11 Слот «Золото Додепа», встроен в лобби (без модалки). Исход решает ядро (ADR-001):
 * store.spin() считает и сохраняет, барабаны только догоняют, revealPending() — после остановки.
 * Длительность: 1.2 с, быстрый 0.4 с, «Меньше мигания» — без ленты (подмена символов).
 */
const game = useGameStore()
const shell = useShell()
const theme = useTheme()
const B = game.config.balance
const { symbols, timing } = game.config.slot

const hud = computed(() => game.hud)
// Экипированный скин (CD-19): только картинки и рамка — на исход не влияет
const equippedSkin = computed(() => game.cosmetics.equipped.skin ?? 'skin:fruit')
const symbolsMap = computed(() => skinSymbols(equippedSkin.value))
const FRAME_SKINS: readonly SlotFrameSkin[] = ['neon', 'pixel', 'circus', 'paper']
const frameSkin = computed<SlotFrameSkin>(() => {
  const f = skinDef(equippedSkin.value).frameClass.replace('frame-', '') as SlotFrameSkin
  return FRAME_SKINS.includes(f) ? f : 'neon'
})
const casino = computed(() => hud.value?.casino ?? 0)
const busy = computed(() => shell.spinning.value)
const isIznanka = computed(() => theme.isIznanka.value)

// ─── Ставка: черновик ввода, в стор — на change/blur (TD-09) ───
const betDraft = ref<number>(hud.value?.bet ?? B.START_BET)
watch(
  () => hud.value?.bet,
  (v) => (betDraft.value = v ?? B.START_BET)
)
function onBetInput(event: Event) {
  betDraft.value = Number((event.target as HTMLInputElement).value)
}
function commitBet() {
  if (busy.value) return
  if (betDraft.value !== hud.value?.bet) game.setBet(betDraft.value)
  betDraft.value = hud.value?.bet ?? B.START_BET
}
function adjust(kind: BetAdjust) {
  if (busy.value || game.phase !== 'day') return
  game.adjustBet(kind)
  if (kind === 'all') document.getElementById('bet-input')?.focus()
}

/** Доступность спина «как если бы уже в казино»: вход делает сам слот. */
const spinBlock = computed<Rejection | null>(() => {
  const run = game.run
  if (!run) return { reason: 'wrong_phase' }
  const bet = Number.isFinite(betDraft.value) ? Math.floor(betDraft.value) : 0
  return canExecute({ ...run, location: 'casino', bet }, { type: 'slot/spin' }, game.config)
})
const needsDeposit = computed(() => game.phase === 'day' && casino.value < B.MIN_BET && !busy.value)
const spinReason = computed(() => (spinBlock.value ? formatRejection('slot/spin', spinBlock.value) : undefined))
const expectedLoss = computed(() => game.underbelly?.slot.expectedLossPerSpin ?? 0)
const effectiveNote = computed(() => {
  const h = hud.value
  if (!h || h.effectiveBet === h.bet || h.effectiveBet <= 0) return ''
  return `В спин уйдёт ${money(h.effectiveBet)}₽ (лимит ${money(h.betCap)}₽)`
})

// ─── Барабаны: 3 видимых ряда, линия — средний ───
const FILLER = 18
const symAt = (i: number) => symbols[((i % symbols.length) + symbols.length) % symbols.length] ?? 'cherry'
function column(target: SymbolId, reel: number): SymbolId[] {
  const idx = symbols.indexOf(target)
  return [symAt(idx + 3 + reel), target, symAt(idx + 5 + reel * 2)]
}
const current = ref<SymbolId[]>(['lemon', 'cherry', 'melon'])
const strips = ref<SymbolId[][]>(current.value.map((s, i) => column(s, i)))
const offsets = ref([0, 0, 0])
const durations = ref([0, 0, 0])
const blur = ref(false)
const reelEls = ref<HTMLElement[]>([])

function stripStyle(i: number) {
  const ms = durations.value[i] ?? 0
  return {
    transform: `translateY(${offsets.value[i] ?? 0}px)`,
    transition: ms ? `transform ${ms}ms var(--ease-reel)` : 'none'
  }
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

function symbolHeight(): number {
  return reelEls.value[0]?.querySelector('.slot__sym')?.getBoundingClientRect().height || 72
}

async function animate(target: readonly SymbolId[]) {
  const finals = target.map((s, i) => column(s, i))
  if (theme.motionReduced.value) {
    await delay(150)
    strips.value = finals
    current.value = [...target]
    return
  }
  const fast = game.settings.skipSpinAnimation
  const times = target.map((_, i) =>
    fast ? timing.fastSpinMs - (2 - i) * 60 : timing.reelBaseMs + i * timing.reelStaggerMs - timing.reelStaggerMs * 2
  )
  strips.value = target.map((to, i) => {
    const filler = Array.from({ length: FILLER }, (_, k) => symAt(k * 3 + i * 5 + (to.length % 7)))
    return [...(strips.value[i] ?? []), ...filler, ...(finals[i] ?? [])]
  })
  durations.value = [0, 0, 0]
  offsets.value = [0, 0, 0]
  await nextTick()
  await frame()
  const h = symbolHeight()
  durations.value = times
  offsets.value = strips.value.map((s) => -(s.length - 3) * h)
  blur.value = !fast
  await delay(Math.max(...times) * 0.8)
  blur.value = false
  await delay(Math.max(...times) * 0.2)
  durations.value = [0, 0, 0]
  offsets.value = [0, 0, 0]
  strips.value = finals
  current.value = [...target]
}

// ─── Результат и эффекты ───
const last = ref<EventOf<'spin'> | null>(null)
const opNumber = ref(0)
const burstKey = ref(0)
const shakeKey = ref(0)
const flashKey = ref(0)
const nearMissKey = ref(0)
const winLamps = ref(false)
const srText = ref('')
let lampTimer: ReturnType<typeof setTimeout> | undefined

const idleHonest = computed(() => {
  const c = game.underbelly?.casino
  if (!c || c.spins === 0) return PROTOCOL.empty
  return `${PROTOCOL.spins}: ${c.spins}. ${PROTOCOL.net}: ${c.casinoNetLive > 0 ? '+' : ''}${money(c.casinoNetLive)}₽.`
})
const lampMode = computed(() => (busy.value ? 'spin' : winLamps.value ? 'win' : 'idle'))
const lastNet = computed(() => (last.value ? last.value.payout - last.value.bet : 0))
const tone = computed(() => (last.value ? eventTone(last.value) : 'info'))
const bannerText = computed(() => (last.value ? formatSpinBanner(last.value) : ''))
const honestLine = computed(() => {
  const l = last.value
  if (!l) return ''
  if (l.nearMiss) return PROTOCOL.nearMissNote.charAt(0).toUpperCase() + PROTOCOL.nearMissNote.slice(1) + '.'
  return l.ldw ? formatEventHonest(l) ?? '' : ''
})

async function spin() {
  if (busy.value || game.phase !== 'day') return
  commitBet()
  if (needsDeposit.value) {
    shell.openCashier('deposit')
    return
  }
  if (spinBlock.value) {
    srText.value = formatRejection('slot/spin', spinBlock.value)
    return
  }
  if (!shell.ensureCasino()) return
  const outcome = game.spin()
  if (!outcome) return
  if (!outcome.spin) {
    srText.value = formatRejection('slot/spin', outcome.rejection)
    return
  }
  const result = outcome.spin
  shell.spinning.value = true
  nearMissKey.value = 0
  srText.value = SLOT.spinBusy
  try {
    await animate(result.reels)
    if (!theme.motionReduced.value) await delay(timing.revealDelayMs)
  } finally {
    shell.spinning.value = false
  }
  last.value = result
  opNumber.value = game.underbelly?.casino.spins ?? opNumber.value + 1
  if (result.payout > 0) {
    burstKey.value++
    winLamps.value = true
    if (lampTimer) clearTimeout(lampTimer)
    lampTimer = setTimeout(() => (winLamps.value = false), 1600)
  }
  if (result.outcomeId === 'jackpot') {
    shakeKey.value++
    flashKey.value++
  }
  if (result.nearMiss) nearMissKey.value++
  srText.value = SLOT.srResult(formatSpinBanner(result), result.bet, result.payout - result.bet)
  game.revealPending()
}

const zone = ref<HTMLElement | null>(null)

function focusSpin() {
  const el = zone.value?.querySelector<HTMLElement>('.slot__spin-row button')
  el?.focus()
}

// Если слот исчез посреди спина — результат всё равно показываем
onBeforeUnmount(() => {
  if (lampTimer) clearTimeout(lampTimer)
  shell.spinning.value = false
  game.revealPending()
})

defineExpose({ spin, focusSpin, adjust })
</script>

<style scoped>
.slot {
  --reel-sym: 64px;
  display: flex;
  justify-content: center;
  outline: none;
}
.slot :deep(.ui-slot) {
  max-width: 620px;
}

.slot__reels {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-radius: var(--r-sm);
  overflow: hidden;
  background: var(--c-page);
}
.slot__reel {
  position: relative;
  height: calc(var(--reel-sym) * 3);
  overflow: hidden;
}
.slot__reel + .slot__reel {
  border-left: 2px solid var(--c-gold);
}
.slot__strip {
  display: flex;
  flex-direction: column;
  will-change: transform;
}
.slot__sym {
  display: grid;
  place-items: center;
  height: var(--reel-sym);
  font-family: var(--font-emoji);
  font-size: calc(var(--reel-sym) * 0.66);
  line-height: 1;
}

.slot__result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  width: 100%;
  min-height: 56px;
  position: relative;
}
.slot__banner {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--fs-xl);
  line-height: var(--lh-tight);
  text-transform: var(--tt-display);
}
.slot__banner--win,
.slot__banner--jackpot {
  color: var(--c-gold);
  text-shadow: var(--tshadow-gold);
}
.slot__banner--lose,
.slot__banner--idle,
.slot__banner--busy {
  color: var(--c-text-muted);
  font-size: var(--fs-md);
}
[data-layer='iznanka'] .slot__banner {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  text-transform: none;
  color: var(--c-text);
}
.slot__honest {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  color: var(--c-text);
}
.slot__honest-sub {
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
}
.slot__stamp {
  position: absolute;
  right: 72px;
  top: -8px;
}
.slot__rtp {
  flex: none;
}

.slot__controls {
  display: grid;
  gap: var(--sp-3);
  width: 100%;
}
.slot__bet {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}
.slot__bet-label {
  font-family: var(--font-condensed);
  font-size: var(--fs-sm);
  text-transform: uppercase;
  letter-spacing: var(--ls-caps);
  color: var(--c-text-muted);
}
.slot__bet-field {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  padding: 0 var(--sp-2);
  border: 2px solid var(--c-accent-2);
  border-radius: var(--r-sm);
  background: var(--c-page);
  font-family: var(--font-display);
}
.slot__bet-input {
  width: 6ch;
  min-height: 40px;
  border: 0;
  background: transparent;
  font-family: var(--font-display);
  font-size: var(--fs-md);
  text-align: right;
  -moz-appearance: textfield;
  appearance: textfield;
}
.slot__bet-input::-webkit-inner-spin-button,
.slot__bet-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.slot__bet-input:focus {
  outline: none;
}
.slot__bet-field:focus-within {
  box-shadow: var(--glow-2);
}
.slot__chips {
  display: inline-flex;
  gap: var(--sp-1);
}
.slot__chip {
  min-width: 44px;
  min-height: 40px;
  padding: 0 var(--sp-2);
  border: 2px solid var(--c-accent-2);
  border-radius: var(--r-sm);
  background: transparent;
  color: var(--c-accent-2);
  font-family: var(--font-display);
  font-weight: 700;
}
.slot__chip:hover:not([aria-disabled='true']) {
  background: rgba(0, 229, 255, 0.12);
}
.slot__chip[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}
/* ДОДЕП ВСЁ отодвинута от КРУТИТЬ и от ставки (≥ 24 px, ux S11) */
.slot__allin {
  margin-left: auto;
}

.slot__note {
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
}
.slot__honest-note {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}
.slot__spin-row {
  display: grid;
  gap: var(--sp-2);
}
.slot__cost {
  font-size: var(--fs-md);
  opacity: 0.85;
}
.slot__kbd {
  margin-left: var(--sp-2);
  padding: 0 var(--sp-1);
  border: 1px solid currentColor;
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  font-weight: 400;
  opacity: 0.7;
}

.slot__wager {
  display: grid;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--c-text-muted);
}
.slot__wager-bar {
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--c-panel-2);
  overflow: hidden;
}
.slot__wager-bar span {
  display: block;
  height: 100%;
  background: var(--c-accent-1);
}

@media (max-width: 1023px) {
  /* На мобильном КРУТИТЬ — липкая CTA над таб-баром (ux S10 моб.) */
  .slot__spin-row :deep(.ui-btn),
  .slot__spin-row :deep(.ui-btn-wrap) {
    display: none;
  }
  .slot__spin-row {
    margin-top: 0;
  }
  .slot__kbd {
    display: none;
  }
}
@media (max-width: 599px) {
  .slot {
    --reel-sym: 58px;
  }
  .slot__allin {
    margin-left: 0;
    flex-basis: 100%;
  }
  .slot__allin :deep(.ui-btn) {
    width: 100%;
  }
  .slot__stamp {
    right: 56px;
  }
}
</style>
