<template>
  <div class="gs" :class="[`gs--tab-${shell.mobileTab.value}`, `gs--phase-${phase}`]">
    <h1 class="sr-only">{{ SITE.screenTitle(hud?.day ?? 1) }}</h1>
    <template v-if="isGameLayout">
      <a class="skip-link" href="#slot-zone" @click.prevent="focusSlot">{{ SITE.skipToSlot }}</a>
      <a class="skip-link" href="#life-zone" @click.prevent="focusLife">{{ SITE.skipToLife }}</a>
    </template>

    <div v-if="phase !== 'ended'" class="gs__top">
    <SiteHeader id="site-zone" tabindex="-1" :compact="isMobile" />

    <!-- Липкая статус-строка выживания (моб.): день, ⚡, 🔥, счёт — всегда видна (ux §4.2) -->
    <button v-if="hud && isGameLayout" type="button" class="gs__status" :aria-label="STATUS_LINE.aria" @click="shell.setTab('life')">
      <span>Д{{ hud.day }}{{ hud.endless ? '' : `/${hud.runDays}` }}</span>
      <span>⚡{{ hud.energy }}</span>
      <span :class="{ 'gs__status-tilt': hud.tilt >= B.TILT_T2 }">🔥{{ hud.tilt }}<template v-if="hud.tilt >= B.TILT_T2"> {{ LIFE.tiltTag }}</template></span>
      <span v-if="hud.bill">{{ STATUS_LINE.bill(hud.bill.total, hud.bill.daysLeft) }}</span>
    </button>
    </div>

    <div v-if="isGameLayout" class="vitrina gs__ticker" aria-hidden="false">
      <Ticker
        :items="topTicker"
        :variant="theme.isIznanka.value ? 'paper' : 'neon'"
        :label="theme.isIznanka.value ? TICKER.winnersHonestLabel : TICKER.winnersLabel"
        aria-label="Лента выигрышей"
      />
    </div>

    <main v-if="isGameLayout" class="gs__main">
      <div id="casino-zone" class="gs__casino" tabindex="-1">
        <div class="vitrina gs__vitrina">
          <Protocol v-if="theme.isIznanka.value" class="gs__protocol" />
          <BannerCarousel
            v-else
            class="gs__hero"
            :slides="slides"
            :aria-label="'Акции казино'"
            @cta="onBannerCta"
            @timer-reset="game.reportFakeTimerExpired()"
          >
            <template #honest="{ slide }">
              <p class="honest gs__banner-honest">{{ bannerHonest(slide.id) }}</p>
            </template>
          </BannerCarousel>


          <div class="gs__play">
            <SlotPanel ref="slot" />
            <section class="gs__lobby" aria-label="Лобби">
              <h2 class="gs__lobby-title">{{ SITE.lobbyTitle }}</h2>
              <ul class="gs__tiles">
                <li v-for="t in LOBBY_TILES" :key="t.key" class="gs__tile" :class="{ 'gs__tile--play': t.playable }">
                  <button v-if="t.playable" type="button" class="gs__tile-btn" @click="focusSlot">
                    <span class="gs__tile-emoji" aria-hidden="true">{{ t.emoji }}</span>
                    <span class="gs__tile-name">{{ t.name }}</span>
                    <Badge kind="hot" :animated="false" />
                  </button>
                  <div v-else class="gs__tile-btn gs__tile-btn--soon" aria-disabled="true">
                    <span class="gs__tile-emoji" aria-hidden="true">{{ t.emoji }}</span>
                    <span class="gs__tile-name">{{ t.name }}</span>
                    <Badge kind="soon" :animated="false" />
                  </div>
                  <p class="honest gs__tile-honest">{{ t.honest }}</p>
                </li>
              </ul>
            </section>
          </div>

          <Ticker
            class="gs__meanwhile"
            :items="bottomTicker"
            variant="paper"
            :label="TICKER.meanwhileLabel"
            :speed="40"
            aria-label="А тем временем — честная лента"
          />
        </div>
        <Chronicle class="gs__chronicle" />
      </div>

      <LifePanel ref="life" class="gs__life" />

      <div class="gs__izn">
        <Protocol />
        <Chronicle />
      </div>
    </main>

    <!-- role="main": экраны фаз — основной контент страницы (CD-21, landmark для скринридера) -->
    <DayReceipt v-else-if="phase === 'daySummary' && game.daySummary" role="main" :summary="game.daySummary" />
    <ForkScreen v-else-if="phase === 'fork'" role="main" />
    <MorningScreen v-else-if="phase === 'morning'" role="main" />
    <template v-else-if="phase === 'ended' && game.statement">
      <StatementSheet v-if="shell.statementOpen.value" role="main" :statement="game.statement" @again="again" @menu="toMenu" />
      <EndingScreen v-else role="main" :statement="game.statement" @statement="shell.statementOpen.value = true" />
    </template>

    <footer v-if="phase !== 'ended'" class="gs__footer vitrina">
      <p class="gs__footer-pay">{{ SITE.footerPay }} · ◉ {{ SITE.footerLicense }}</p>
      <p class="gs__footer-fine">
        {{ SITE.footerFine }} · {{ SITE.footerCopy }}
        <button type="button" class="gs__responsible" @click="shell.setLayer('iznanka')">
          <span class="vitrina-only">{{ SITE.footerResponsible }}</span>
          <span class="honest honest-inline">{{ SITE.footerResponsibleHonest }}</span>
        </button>
      </p>
      <p class="honest gs__footer-help">
        {{ DISCLAIMER.underside }}
        <a :href="HELP_LINK.url" target="_blank" rel="noopener noreferrer">{{ HELP_LINK.text }}</a>
      </p>
    </footer>

    <!-- Мобильные: липкая CTA и таб-бар — вне .vitrina (фильтр Изнанки ломает position: fixed) -->
    <Teleport to="body">
      <div v-if="isMobile && isGameLayout && phase === 'day'" ref="dock" class="gs-dock">
        <div v-if="shell.mobileTab.value === 'casino'" class="gs-dock__cta">
          <NeonButton
            v-if="needsDeposit"
            variant="cta"
            size="lg"
            block
            icon="💳"
            @click="shell.openCashier('deposit')"
          >
            {{ SLOT.depositToPlay }}
          </NeonButton>
          <NeonButton
            v-else
            variant="cta"
            size="lg"
            block
            icon="🎰"
            :disabled="shell.spinning.value || !!mobileSpinReason"
            :aria-label="`${SLOT.spin}, ${SLOT.spinCost(hud?.spinEnergyCost ?? 0)}`"
            @click="spin"
          >
            {{ shell.spinning.value ? SLOT.spinBusy : SLOT.spin }} · {{ SLOT.spinCost(hud?.spinEnergyCost ?? 0) }}
          </NeonButton>
          <p v-if="mobileSpinReason && !shell.spinning.value && !needsDeposit" class="gs-dock__reason">{{ mobileSpinReason }}</p>
        </div>
        <div v-else-if="shell.mobileTab.value === 'life'" class="gs-dock__cta">
          <button
            type="button"
            class="paper-btn paper-btn--primary gs-dock__sleep"
            :aria-disabled="!!game.actions.sleep || shell.spinning.value || undefined"
            @click="shell.requestSleep()"
          >
            {{ LIFE.sleep }}
          </button>
        </div>
        <nav class="gs-tabs" :aria-label="TABS.aria">
          <button
            v-for="t in (['casino', 'life', 'iznanka'] as const)"
            :key="t"
            type="button"
            class="gs-tabs__tab"
            :aria-current="shell.mobileTab.value === t ? 'page' : undefined"
            @click="onTab(t)"
          >
            {{ TABS[t] }}
          </button>
        </nav>
      </div>
    </Teleport>

    <CashierModal @deposited="afterDeposit" @to-life="focusLife" />
    <BonusOfferModal />
    <ExitConfirmModal />
    <SleepConfirmModal />
    <QuitConfirmModal />
    <EventCard />
    <BillsModal />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { canExecute } from '@/game'
import { formatRejection } from '@/i18n'
import {
  BANNERS,
  DISCLAIMER,
  HELP_LINK,
  LIFE,
  LOBBY_TILES,
  SITE,
  SLOT,
  STATUS_LINE,
  TABS,
  TICKER,
  TICKER_SHOWCASE,
  tickerHonest
} from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell, type MobileTab } from '@/composables/useShell'
import { useTheme } from '@/composables/useTheme'
import BannerCarousel, { type BannerSlide } from '@/components/ui/BannerCarousel.vue'
import Ticker from '@/components/ui/Ticker.vue'
import Badge from '@/components/ui/Badge.vue'
import NeonButton from '@/components/ui/NeonButton.vue'
import SiteHeader from './SiteHeader.vue'
import SlotPanel from './SlotPanel.vue'
import LifePanel from './LifePanel.vue'
import Chronicle from './Chronicle.vue'
import Protocol from './Protocol.vue'
import CashierModal from './CashierModal.vue'
import BonusOfferModal from './BonusOfferModal.vue'
import ExitConfirmModal from './ExitConfirmModal.vue'
import SleepConfirmModal from './SleepConfirmModal.vue'
import QuitConfirmModal from './QuitConfirmModal.vue'
import EventCard from '@/components/phases/EventCard.vue'
import BillsModal from '@/components/phases/BillsModal.vue'
import DayReceipt from '@/components/phases/DayReceipt.vue'
import ForkScreen from '@/components/phases/ForkScreen.vue'
import MorningScreen from '@/components/phases/MorningScreen.vue'
import EndingScreen from '@/components/phases/EndingScreen.vue'
import StatementSheet from '@/components/phases/StatementSheet.vue'

/**
 * S10 Игровой экран: Витрина (шапка-сайт, тикеры, хиро, лобби, слот) + Жизнь (бумага) + Хроника.
 * Фазы дня: event/bills — модалки поверх, daySummary/fork/morning/ended — экраны на месте сетки.
 * Горячие клавиши экрана — здесь (Esc/M/? — в App).
 */
const game = useGameStore()
const shell = useShell()
const theme = useTheme()
const B = game.config.balance

const hud = computed(() => game.hud)
const phase = computed(() => game.phase ?? 'day')
const isGameLayout = computed(() => phase.value === 'day' || phase.value === 'event' || phase.value === 'bills')

// ─── Брейкпоинт мобильной раскладки (ux §4.1: < 1024 — вкладки) ───
const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)') : null
const isMobile = ref(mq?.matches ?? false)
const onMq = (e: MediaQueryListEvent) => (isMobile.value = e.matches)
mq?.addEventListener('change', onMq)

// ─── Тикеры: 1 «победа» на 9 строк «а тем временем» (CV §7.4); в Изнанке — честные пары ───
const WINS_SHOWN = 4
/** Честные пары тикера: числа (доля отыгрыша бонуса) — из config.stats, как в Протоколе (QA-07). */
const TICKER_HONEST = tickerHonest(game.config.stats)
const tickerOffset = computed(() => ((hud.value?.day ?? 1) * 5) % TICKER_SHOWCASE.length)
const topTicker = computed(() => {
  const idx = Array.from({ length: WINS_SHOWN }, (_, i) => (tickerOffset.value + i) % TICKER_SHOWCASE.length)
  if (theme.isIznanka.value) {
    return [TICKER.honestMeta(TICKER_SHOWCASE.length), ...idx.map((i) => TICKER_HONEST[i] ?? '')]
  }
  return idx.map((i) => ({ id: i, text: TICKER_SHOWCASE[i] ?? '', tone: 'win' as const }))
})
const bottomTicker = computed(() =>
  Array.from({ length: WINS_SHOWN * 9 }, (_, i) => {
    const k = (tickerOffset.value + i) % TICKER_HONEST.length
    return { id: `m${i}`, text: TICKER_HONEST[k] ?? '', tone: 'lose' as const }
  })
)

// ─── Хиро: 3 баннера со сносками; при 🔥 ≥ 40 первым — «ОТЫГРАЙСЯ!» ───
const slides = computed<BannerSlide[]>(() => {
  const first =
    (hud.value?.tilt ?? 0) >= B.TILT_T1 ? 'win_back' : hud.value?.bonus.state === 'available' ? 'bonus_200' : 'instant_withdraw'
  const keys = [first, first === 'instant_withdraw' ? 'mirror' : 'instant_withdraw', 'happy_hour']
  return keys.map((k) => {
    const b = BANNERS[k]!
    return { id: b.key, kicker: b.kicker, title: b.title, hero: b.hero, cta: b.cta, fine: b.fine, emoji: b.emoji, tone: b.tone, timer: b.timer }
  })
})
const bannerHonest = (id: string) => BANNERS[id]?.honest ?? ''

function onBannerCta(id: string) {
  if (id === 'bonus_200') shell.claimBonus()
  else if (id === 'instant_withdraw') shell.openCashier('deposit')
  else focusSlot()
}

// ─── Слот, фокус, регионы ───
const slot = ref<InstanceType<typeof SlotPanel> | null>(null)
const life = ref<InstanceType<typeof LifePanel> | null>(null)

function focusSlot() {
  if (isMobile.value) shell.setTab('casino')
  nextTick(() => {
    document.getElementById('slot-zone')?.scrollIntoView({ block: 'center', behavior: theme.motionReduced.value ? 'auto' : 'smooth' })
    slot.value?.focusSpin()
  })
}
function focusLife() {
  if (isMobile.value) shell.setTab('life')
  nextTick(() => life.value?.focusHeading())
}
function spin() {
  void slot.value?.spin()
}
function afterDeposit() {
  // Касса сама тащит к спину — удобство, которое пародирует казино (ux S12)
  focusSlot()
}
function onTab(t: MobileTab) {
  shell.setTab(t)
  window.scrollTo({ top: 0 })
}

const needsDeposit = computed(() => (hud.value?.casino ?? 0) < B.MIN_BET)
const mobileSpinReason = computed(() => {
  const run = game.run
  if (!run) return ''
  const r = canExecute({ ...run, location: 'casino' }, { type: 'slot/spin' }, game.config)
  return r ? formatRejection('slot/spin', r) : ''
})

function again() {
  shell.statementOpen.value = false
  game.newGame()
  shell.setTab('casino')
}
function toMenu() {
  shell.statementOpen.value = false
  shell.go('menu')
}

// Утро начинается с жизни, а не с казино: фокус на «День N» (ux S10)
watch(phase, async (now, before) => {
  if (now !== 'day' || before === 'day' || before === 'bills') return
  if (isMobile.value) shell.setTab('life')
  await nextTick()
  life.value?.focusHeading()
})
// Конец рана: слой возвращается к Витрине — Выписка сама по себе Изнанка
watch(phase, (now, before) => {
  if (now !== before && now !== 'day' && now !== 'event' && now !== 'bills') window.scrollTo({ top: 0 })
  if (now === 'ended') shell.setLayer('vitrina')
  if (now !== 'ended') shell.statementOpen.value = false
})

// ─── Горячие клавиши экрана (ux-flows §5, KeyboardEvent.code — работают в русской раскладке) ───
const REGIONS = ['site-zone', 'casino-zone', 'life-zone', 'chronicle-zone']

function isTyping(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))
}
function modalOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]')
}

function onKeydown(event: KeyboardEvent) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  if (shell.screen.value !== 'game') return
  const typing = isTyping(event.target)
  // I — Витрина ↔ Изнанка: работает и в кассе, и в чеке; не во время ввода текста
  if ((event.code === 'KeyI' || event.code === 'KeyG') && !typing && phase.value !== 'ended') {
    if (shell.overlays.value.length === 0) {
      shell.toggleLayer()
      event.preventDefault()
    }
    return
  }
  if (event.code === 'F6') {
    const active = document.activeElement
    const cur = REGIONS.findIndex((id) => document.getElementById(id)?.contains(active))
    const next = REGIONS[(cur + (event.shiftKey ? REGIONS.length - 1 : 1)) % REGIONS.length]
    document.getElementById(next ?? 'casino-zone')?.focus()
    event.preventDefault()
    return
  }
  if (typing || modalOpen() || shell.anyDialogOpen.value) return
  if (phase.value === 'daySummary' && event.key === 'Enter' && document.activeElement === document.body) {
    game.execute({ type: 'day/wake' })
    return
  }
  if (phase.value !== 'day' || shell.spinning.value) return

  switch (event.code) {
    case 'Space': {
      const active = document.activeElement
      const inSlot = !!active && !!document.getElementById('slot-zone')?.contains(active)
      if (active === document.body || active === null || inSlot) {
        event.preventDefault()
        spin()
      }
      break
    }
    case 'Minus':
    case 'NumpadSubtract':
      slot.value?.adjust('half')
      event.preventDefault()
      break
    case 'Equal':
    case 'NumpadAdd':
      slot.value?.adjust('double')
      event.preventDefault()
      break
    case 'Digit0':
    case 'Numpad0':
      slot.value?.adjust('min')
      event.preventDefault()
      break
    case 'KeyD':
      shell.openCashier('deposit')
      event.preventDefault()
      break
    case 'KeyN':
      shell.requestSleep()
      event.preventDefault()
      break
    case 'KeyL':
      focusLife()
      event.preventDefault()
      break
    case 'KeyC':
      focusSlot()
      event.preventDefault()
      break
    default:
      break
  }
}

// ─── Высота мобильного дока → --dock-h: тосты встают над доком, а не на барабаны (QA-10) ───
const dock = ref<HTMLElement | null>(null)
const dockObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncDockHeight()) : null
function syncDockHeight() {
  const h = dock.value ? Math.ceil(dock.value.getBoundingClientRect().height) : 0
  document.documentElement.style.setProperty('--dock-h', `${h}px`)
  document.documentElement.classList.toggle('has-dock', h > 0)
}
watch(dock, (el, old) => {
  if (old) dockObserver?.unobserve(old)
  if (el) dockObserver?.observe(el)
  syncDockHeight()
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.documentElement.classList.add('in-run')
  // Вход в ран из меню / «Продолжить»: кнопка меню исчезла, фокус не должен остаться на body (CD-21)
  void nextTick(() => {
    const active = document.activeElement
    if (phase.value !== 'day' || (active && active !== document.body)) return
    if (isMobile.value) document.getElementById('casino-zone')?.focus({ preventScroll: true })
    else life.value?.focusHeading()
  })
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  mq?.removeEventListener('change', onMq)
  document.documentElement.classList.remove('in-run', 'has-dock')
  document.documentElement.style.removeProperty('--dock-h')
  dockObserver?.disconnect()
})
</script>

<style scoped>
.gs {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.gs__top {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
}
.gs__ticker {
  border-bottom: 1px solid var(--c-line);
}
.gs__status {
  display: none;
}

.gs__main {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--sp-4);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--sp-5);
  align-items: start;
  flex: 1;
}
.gs__casino {
  display: grid;
  gap: var(--sp-4);
  min-width: 0;
  outline: none;
}
.gs__vitrina {
  display: grid;
  gap: var(--sp-4);
  min-width: 0;
}
.gs__life {
  position: sticky;
  top: 88px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.gs__izn {
  display: none;
}
.gs__hero {
  min-width: 0;
}
.gs__banner-honest {
  position: absolute;
  left: var(--sp-5);
  right: var(--sp-5);
  bottom: var(--sp-4);
  z-index: 4;
  padding: var(--sp-2);
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
}

.gs__play {
  display: grid;
  gap: var(--sp-4);
  min-width: 0;
}
@media (min-width: 1200px) {
  .gs__play {
    grid-template-columns: minmax(0, 1fr) 168px;
    align-items: start;
  }
  .gs__play .gs__tiles {
    grid-template-columns: 1fr;
  }
  .gs__play .gs__tile-btn {
    min-height: 72px;
    padding: var(--sp-2);
  }
}
@media (min-width: 1024px) {
  .gs__hero :deep(.ui-carousel__viewport) {
    height: 216px;
  }
}
.gs__lobby {
  display: grid;
  align-content: start;
  gap: var(--sp-2);
}
.gs__lobby-title {
  font-family: var(--font-condensed);
  font-size: var(--fs-sm);
  letter-spacing: var(--ls-wide);
  color: var(--c-text-muted);
}
.gs__tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sp-3);
}
.gs__tile {
  display: grid;
  gap: var(--sp-1);
}
.gs__tile-btn {
  position: relative;
  display: grid;
  justify-items: center;
  gap: var(--sp-1);
  width: 100%;
  min-height: 88px;
  padding: var(--sp-3) var(--sp-2);
  border: 2px solid var(--c-line);
  border-radius: var(--r-md);
  background: linear-gradient(160deg, var(--c-panel-2), var(--c-panel));
  color: var(--c-text);
  text-align: center;
}
.gs__tile--play .gs__tile-btn {
  border-color: var(--c-gold);
  box-shadow: var(--glow-gold);
}
.gs__tile-btn--soon {
  opacity: 0.7;
  filter: saturate(0.6);
  cursor: not-allowed;
}
.gs__tile-emoji {
  font-size: 30px;
  font-family: var(--font-emoji);
}
.gs__tile-name {
  font-family: var(--font-display);
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: var(--tt-display);
  line-height: var(--lh-snug);
}
.gs__tile-honest {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  color: var(--c-text-muted);
}

.gs__footer {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--sp-4);
  display: grid;
  gap: var(--sp-1);
  border-top: 1px solid var(--c-line);
  color: var(--c-text-fine);
  font-size: var(--fs-fine);
}
.gs__footer-pay {
  color: var(--c-text-muted);
  font-size: var(--fs-xs);
}
.gs__responsible {
  position: relative;
  margin-left: var(--sp-2);
  padding: 0;
  border: 0;
  background: none;
  color: var(--c-text-fine);
  font-size: var(--fs-fine);
  text-decoration: underline;
}
/* В Изнанке фон страницы #232323: --c-text-fine неона даёт там 4.42 → берём muted (CD-21) */
[data-layer='iznanka'] .gs__footer-fine,
[data-layer='iznanka'] .gs__responsible {
  color: var(--c-text-muted);
}
/* Ссылка-кнопка в мелком тексте: зона нажатия 44px без изменения строки (CD-21) */
.gs__responsible::before {
  content: '';
  position: absolute;
  inset: -14px -4px;
}
.gs__footer-help {
  font-size: var(--fs-sm);
  color: var(--c-text);
}
.gs__footer-help a {
  color: var(--c-accent-2);
}

/* ---------- Мобильная раскладка: вкладки Казино / Жизнь / Изнанка ---------- */
@media (max-width: 1023px) {
  .gs__status {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--sp-2);
    width: 100%;
    min-height: var(--tap-min);
    align-items: center;
    padding: var(--sp-1) var(--sp-3);
    border: 0;
    border-bottom: 1px solid var(--ink);
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: 700;
  }
  .gs__status-tilt {
    color: var(--stamp-red);
  }
  .gs__main {
    grid-template-columns: minmax(0, 1fr);
    max-width: 640px;
    padding: var(--sp-3) var(--sp-3) 150px;
  }
  .gs__life {
    position: static;
    max-height: none;
    overflow: visible;
  }
  .gs--tab-casino .gs__life,
  .gs--tab-casino .gs__izn,
  .gs--tab-life .gs__casino,
  .gs--tab-life .gs__izn,
  .gs--tab-iznanka .gs__casino,
  .gs--tab-iznanka .gs__life {
    display: none;
  }
  .gs--tab-iznanka .gs__izn {
    display: grid;
    gap: var(--sp-3);
  }
  .gs--tab-life .gs__ticker {
    display: none;
  }
  .gs__tiles {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-bottom: var(--sp-1);
  }
  .gs__tile {
    flex: 0 0 140px;
    scroll-snap-align: start;
  }
  .gs__footer {
    padding-bottom: 150px;
  }
}
@media (max-width: 1023px) {
  :global(html.in-run .ui-toast-region) {
    top: 112px;
  }
  /* QA-10: с доком тост живёт внизу, над CTA и вкладками — барабаны и итог спина вверху остаются видны */
  :global(html.in-run.has-dock .ui-toast-region) {
    top: auto;
    bottom: calc(var(--dock-h, 0px) + var(--sp-2));
  }
}
</style>

<style>
/* Док мобильных CTA и вкладок (телепорт в body) */
.gs-dock {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-dock);
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3) calc(var(--sp-2) + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(180deg, rgba(11, 6, 32, 0), rgba(11, 6, 32, 0.96) 30%);
}
[data-layer='iznanka'] .gs-dock {
  background: linear-gradient(180deg, rgba(35, 35, 35, 0), rgba(35, 35, 35, 0.96) 30%);
}
.gs-dock__cta {
  display: grid;
  gap: var(--sp-1);
}
.gs-dock__reason {
  color: var(--c-gold);
  font-size: var(--fs-xs);
  text-align: center;
}
.gs-dock__sleep {
  width: 100%;
  min-height: 52px;
}
.gs-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  overflow: hidden;
  background: var(--c-panel);
}
.gs-tabs__tab {
  min-height: 48px;
  border: 0;
  border-right: 1px solid var(--c-line);
  background: transparent;
  color: var(--c-text-muted);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.gs-tabs__tab:last-child {
  border-right: 0;
}
.gs-tabs__tab[aria-current='page'] {
  background: var(--c-panel-2);
  color: var(--c-text);
  box-shadow: inset 0 -3px 0 var(--c-accent-2);
}
[data-layer='iznanka'] .gs-tabs {
  background: var(--paper);
  border-color: var(--ink);
}
[data-layer='iznanka'] .gs-tabs__tab {
  color: var(--ink);
  border-color: var(--ink);
}
[data-layer='iznanka'] .gs-tabs__tab[aria-current='page'] {
  background: var(--ink);
  color: var(--paper-white);
  box-shadow: none;
}
</style>
