<template>
  <div class="sc">
    <!-- Панель управления витриной (вне .vitrina: фильтр Изнанки её не трогает) -->
    <div class="sc-controls" role="toolbar" aria-label="Режимы отображения">
      <strong class="sc-controls__title">UI Showcase</strong>
      <div class="sc-controls__group" role="radiogroup" aria-label="Тема">
        <button data-ui
          v-for="id in THEMES"
          :key="id"
          type="button"
          role="radio"
          class="sc-chip"
          :aria-checked="theme === id"
          @click="setTheme(id)"
        >
          {{ THEME_LABELS[id] }}
        </button>
      </div>
      <button data-ui type="button" class="sc-chip" :aria-pressed="isIznanka" @click="toggleLayer">
        {{ isIznanka ? '🕶️ Надеть обратно' : '👓 Снять очки' }}
      </button>
      <button data-ui type="button" class="sc-chip" role="switch" :aria-checked="calm" @click="toggleCalm">
        Меньше мигания: {{ calm ? 'вкл' : 'выкл' }}
      </button>
    </div>

    <div class="sc-layout">
      <main class="vitrina sc-main">
        <section class="sc-section sc-header-demo" aria-labelledby="sc-h-logo">
          <h2 id="sc-h-logo" class="sc-h">Логотип и шапка</h2>
          <div class="sc-row sc-row--between">
            <ParodyLogo />
            <div class="sc-row">
              <StatPlate :value="casino" variant="casino" icon="🎰" label="Баланс казино" locked :progress="0.35" />
              <StatPlate :value="wallet" variant="wallet" icon="👛" label="Кошелёк" />
              <NeonButton variant="cta" size="lg" pulse>Депозит</NeonButton>
              <NeonButton variant="secondary" size="md" icon="👓" aria-label="Снять очки" @click="toggleLayer" />
            </div>
          </div>
          <div class="sc-row">
            <ParodyLogo compact size="sm" />
            <NeonButton variant="ghost" @click="casino += 2500">+2 500 ₽ в казино</NeonButton>
            <NeonButton variant="ghost" @click="casino -= 1800">−1 800 ₽</NeonButton>
          </div>
        </section>

        <Ticker :items="winners" label="🔥 LIVE-ВЫИГРЫШИ" aria-label="Выигрыши игроков" />

        <section class="sc-section" aria-labelledby="sc-h-banner">
          <h2 id="sc-h-banner" class="sc-h">Баннер-карусель</h2>
          <BannerCarousel :slides="slides" :timer-seconds="7" @timer-reset="(n) => (burns = n)">
            <template #honest="{ slide }">
              <p class="honest sc-honest">{{ honestFor(slide.id) }}</p>
            </template>
          </BannerCarousel>
          <p class="sc-note">Таймер сгорал: {{ burns }} раз (демо стартует с 00:07)</p>
        </section>

        <section class="sc-section" aria-labelledby="sc-h-slot">
          <h2 id="sc-h-slot" class="sc-h">Корпус слота</h2>
          <div class="sc-row sc-row--top">
            <SlotFrame
              :lamp-mode="lampMode"
              :skin="skin"
              :shake-key="shakeKey"
              :flash-key="flashKey"
              :burst-key="burstKey"
            >
              <div class="sc-reels">
                <div
                  v-for="(col, c) in reels"
                  :key="c"
                  class="sc-reel fx-reel-window"
                  :class="{ 'fx-near-miss': nearMiss && c === 2 }"
                >
                  <span
                    v-for="(sym, r) in col"
                    :key="r"
                    class="sc-sym"
                    :class="{ 'sc-sym--line': r === 1, 'fx-pop': popKey > 0 && r === 1 }"
                  >{{ sym }}</span>
                </div>
              </div>
              <template #result>
                <span class="sc-win fx-text-gold">{{ resultText }}</span>
                <Badge kind="rtp" />
              </template>
            </SlotFrame>

            <div class="sc-stack">
              <div class="sc-row">
                <label class="sc-label">Лампы
                  <select v-model="lampMode" class="sc-select">
                    <option value="idle">idle</option>
                    <option value="spin">spin</option>
                    <option value="win">win</option>
                    <option value="off">off</option>
                  </select>
                </label>
                <label class="sc-label">Рамка
                  <select v-model="skin" class="sc-select">
                    <option value="neon">neon</option>
                    <option value="pixel">pixel</option>
                    <option value="circus">circus</option>
                    <option value="paper">paper</option>
                  </select>
                </label>
              </div>
              <NeonButton variant="cta" size="xl" pulse @click="win">Крутить</NeonButton>
              <NeonButton variant="secondary" size="sm" @click="jackpot">777 джекпот</NeonButton>
              <NeonButton variant="secondary" size="sm" @click="near">Near-miss</NeonButton>
              <NeonButton variant="danger" icon="🔥">Додеп всё</NeonButton>
              <NeonButton variant="cta" size="lg" disabled disabled-reason="Мин. ставка 50₽">Крутить</NeonButton>
            </div>
          </div>
        </section>

        <section class="sc-section" aria-labelledby="sc-h-btn">
          <h2 id="sc-h-btn" class="sc-h">Кнопки</h2>
          <div class="sc-row">
            <NeonButton variant="cta" size="lg">Депозит</NeonButton>
            <NeonButton variant="hot" skew>Забрать бонус</NeonButton>
            <NeonButton variant="secondary">Вывести</NeonButton>
            <NeonButton variant="danger" icon="🔥">Додеп всё</NeonButton>
            <NeonButton variant="ghost">нет, я не люблю выигрывать</NeonButton>
          </div>
          <div class="sc-row">
            <NeonButton variant="secondary" size="sm">½</NeonButton>
            <NeonButton variant="secondary" size="sm">×2</NeonButton>
            <NeonButton variant="secondary" size="sm">MIN</NeonButton>
            <NeonButton variant="cta" disabled disabled-reason="Нет ⚡">Смена</NeonButton>
          </div>
        </section>

        <section class="sc-section" aria-labelledby="sc-h-badge">
          <h2 id="sc-h-badge" class="sc-h">Бейджи и штампы</h2>
          <div class="sc-row">
            <Badge kind="hot" />
            <Badge kind="multiplier" />
            <Badge kind="new" />
            <Badge kind="vip" />
            <Badge kind="live" />
            <Badge kind="rtp" />
          </div>
          <div class="sc-row sc-row--top">
            <div class="sc-tile">
              <Badge kind="multiplier" corner />
              <span class="sc-tile__emoji" aria-hidden="true">🍒💎7️⃣</span>
              <span class="sc-tile__name">Золото Додепа</span>
              <span class="sc-tile__by">by Долговые Игры™</span>
              <Badge kind="hot" />
            </div>
            <div class="sc-tile sc-tile--soon">
              <Badge kind="soon" corner />
              <Badge kind="new" corner />
              <span class="sc-tile__emoji" aria-hidden="true">📕</span>
              <span class="sc-tile__name">Книга Долгов</span>
              <span class="sc-tile__by">by Долговые Игры™</span>
            </div>
            <div class="sc-stamps">
              <Stamp text="Проигрыш" :replay-key="stampKey" />
              <Stamp text="Проведено" tone="blue" size="sm" :rotate="6" :replay-key="stampKey" />
              <Stamp text="Оплачено" tone="green" size="sm" :rotate="-4" :replay-key="stampKey" />
              <Stamp text="−50₽" size="lg" :replay-key="stampKey" />
              <NeonButton variant="paper" size="sm" @click="stampKey++">Шлёпнуть ещё</NeonButton>
            </div>
          </div>
        </section>

        <section class="sc-section" aria-labelledby="sc-h-over">
          <h2 id="sc-h-over" class="sc-h">Модалки и тосты</h2>
          <div class="sc-row">
            <NeonButton variant="hot" @click="neonOpen = true">Неоновая модалка</NeonButton>
            <NeonButton variant="paper" @click="paperOpen = true">Бумажная модалка</NeonButton>
            <NeonButton variant="secondary" @click="pushToast('achievement')">Тост ачивки</NeonButton>
            <NeonButton variant="secondary" @click="pushToast('system')">Системный тост</NeonButton>
            <NeonButton variant="secondary" @click="vignette = !vignette">Тильт-виньетка</NeonButton>
          </div>
        </section>

        <section class="sc-section" aria-labelledby="sc-h-type">
          <h2 id="sc-h-type" class="sc-h">Типографика</h2>
          <p class="sc-type sc-type--jackpot fx-text-gold">777</p>
          <p class="sc-type sc-type--3xl fx-text-neon">Выигрыш! +50 ₽</p>
          <p class="sc-type sc-type--caps">Oswald 700 · кнопки и тикер</p>
          <p class="sc-type">Onest 400 — основной текст интерфейса, «ёлки» и цифры 1 234 567 ₽.</p>
          <p class="sc-type sc-type--mono">JetBrains Mono — Операция №1432. Ставка 100₽. Возврат 50₽. Итог −50₽</p>
          <p class="sc-type sc-type--fine">*Вейджер ×30 от бонуса. Баланс заблокирован до отыгрыша. Отыгрывают ~11%</p>
        </section>

        <Ticker :items="meanwhile" variant="paper" direction="right" label="А тем временем:" />
      </main>

      <aside class="life paper sc-life" aria-labelledby="sc-h-life">
        <h2 id="sc-h-life" class="sc-life__head">День 12 / 28 <span>Неделя 2</span></h2>
        <StatPlate variant="paper" icon="⚡" label="Энергия" :value="64" unit="/100" :progress="0.64" />
        <StatPlate variant="paper" icon="🧾" label="Счёт через 2 дн." :value="5500" />
        <StatPlate variant="paper" icon="💳" label="Долг" :value="7340">
          <span class="sc-red">+1%/день ↑</span>
        </StatPlate>
        <StatPlate variant="paper" icon="❤️" label="Семья" :value="8" unit="" />
        <p class="sc-hand">Мама: «Позвони, как сможешь»</p>
        <div class="sc-life__actions">
          <NeonButton variant="paper">Смена −60⚡</NeonButton>
          <NeonButton variant="paper">Семья −20⚡</NeonButton>
          <NeonButton variant="paper-danger">МФО</NeonButton>
          <NeonButton variant="paper">🌙 Спать</NeonButton>
        </div>
      </aside>
    </div>

    <Modal v-model:open="neonOpen" title="Последний шанс!">
      <p>Бонус 50 фриспинов сгорит 😱. Точно выводить?</p>
      <p class="honest sc-honest">Приём: loss aversion. Вывод — нормальное действие.</p>
      <template #footer="{ close }">
        <NeonButton variant="ghost" @click="close">нет, я не люблю выигрывать</NeonButton>
        <NeonButton variant="hot" data-autofocus @click="close">Остаться</NeonButton>
      </template>
    </Modal>
    <Modal v-model:open="paperOpen" variant="paper" title="Счёт за неделю 2" form-no="Форма №7-СЧ">
      <StatPlate variant="paper" label="Аренда" :value="4000" />
      <StatPlate variant="paper" label="Связь" :value="500" />
      <StatPlate variant="paper" label="Итого" :value="4500" />
      <template #footer="{ close }">
        <NeonButton variant="paper" @click="close">Оплатить</NeonButton>
      </template>
    </Modal>

    <div class="ui-toast-region">
      <Toast
        v-for="t in toasts"
        :key="t.id"
        :kind="t.kind"
        :name="t.name"
        :subtitle="t.subtitle"
        :reward="t.reward"
        @close="toasts = toasts.filter((x) => x.id !== t.id)"
      />
    </div>
    <div v-if="vignette" class="fx-vignette" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
/**
 * Витрина UI-компонентов для ручной и визуальной проверки (открывается по ?showcase).
 * В прод-маршрут не подключена: main.ts грузит её отдельным чанком только по флагу.
 */
import { computed, ref } from 'vue'
import { THEMES, THEME_LABELS, useTheme } from '@/composables/useTheme'
import NeonButton from './NeonButton.vue'
import Badge from './Badge.vue'
import Ticker, { type TickerItem } from './Ticker.vue'
import BannerCarousel, { type BannerSlide } from './BannerCarousel.vue'
import StatPlate from './StatPlate.vue'
import Modal from './Modal.vue'
import Toast from './Toast.vue'
import SlotFrame, { type SlotFrameSkin, type SlotLampMode } from './SlotFrame.vue'
import Stamp from './Stamp.vue'
import ParodyLogo from './ParodyLogo.vue'

const { theme, calm, isIznanka, setTheme, toggleLayer, toggleCalm } = useTheme()

const casino = ref(12500)
const wallet = ref(3200)
const burns = ref(0)

const winners: TickerItem[] = [
  { id: 1, text: '🏆 АЛ***Й', amount: '+48 000₽', tail: 'в «ЗОЛОТО ДОДЕПА»' },
  { id: 2, text: '🏆 МА***А', amount: '+12 500₽', tail: 'в «ЗОЛОТО ДОДЕПА»' },
  { id: 3, text: '🏆 ДЕ***С', amount: '+7 700₽', tail: 'в «ЗОЛОТО ДОДЕПА»' },
  { id: 4, text: '🏆 ОЛ***А', amount: '+3 150₽', tail: 'в «ЗОЛОТО ДОДЕПА»' }
]
const meanwhile: TickerItem[] = [
  { id: 1, text: 'ви***р', amount: '−12 000₽' },
  { id: 2, text: 'ма***а', amount: '−зарплата' },
  { id: 3, text: 'ол***г', amount: '−3 000₽' },
  { id: 4, text: 'се***й', amount: '−8 400₽' },
  { id: 5, text: 'ан***я', amount: '−1 500₽' },
  { id: 6, text: 'ди***н', amount: '−телефон' },
  { id: 7, text: 'та***а', amount: '−5 000₽' },
  { id: 8, text: 'ко***я', amount: '−22 000₽' },
  { id: 9, text: 'ил***я', amount: '−600₽' }
]

const slides: BannerSlide[] = [
  {
    id: 'bonus',
    kicker: 'Эксклюзив для тебя',
    title: 'Бонус на первый деп*',
    hero: '200%',
    cta: 'Забрать бонус',
    fine: '*Вейджер ×30 от бонуса. Баланс заблокирован до отыгрыша. Отыгрывают ~11%',
    emoji: '🎁💰',
    tone: 'magenta',
    timer: true
  },
  {
    id: 'free',
    kicker: 'Только сегодня',
    title: 'Фриспины каждому*',
    hero: '777',
    cta: 'Хочу!',
    fine: '*Выигрыш с фриспинов тоже под вейджер. 777 — это количество, а не шанс',
    emoji: '🎰',
    tone: 'gold'
  },
  {
    id: 'cashout',
    kicker: 'Мгновенно',
    title: 'Вывод за 5 минут*',
    hero: '5 мин',
    cta: 'Вывести',
    fine: '*Рассмотрение заявки до следующего утра. Комиссия 5%. 5 минут — время заполнения формы',
    emoji: '⏳',
    tone: 'cyan'
  }
]
const HONEST: Record<string, string> = {
  bonus: 'Ожидаемый остаток после отыгрыша ≈ 0₽. Таймер обнуляется сам.',
  free: 'Фриспины — те же ставки, только за твой депозит.',
  cashout: 'Завтра утром, −5%.'
}
const honestFor = (id: string) => HONEST[id] ?? ''

/* Слот */
const lampMode = ref<SlotLampMode>('idle')
const skin = ref<SlotFrameSkin>('neon')
const shakeKey = ref(0)
const flashKey = ref(0)
const burstKey = ref(0)
const popKey = ref(0)
const nearMiss = ref(false)
const reels = ref<string[][]>([
  ['🍋', '🍒', '💎'],
  ['⭐', '🍒', '🤡'],
  ['🍉', '🍒', '7️⃣']
])
const outcome = ref<'win' | 'jackpot' | 'near' | 'idle'>('idle')
const resultText = computed(() =>
  outcome.value === 'jackpot'
    ? 'ДЖЕКПОТ! +10 000₽'
    : outcome.value === 'near'
      ? 'ТАК БЛИЗКО! 😱'
      : 'ВЫИГРЫШ! +50₽'
)

let lampTimer: ReturnType<typeof setTimeout> | undefined
function celebrate() {
  lampMode.value = 'win'
  if (lampTimer) clearTimeout(lampTimer)
  lampTimer = setTimeout(() => (lampMode.value = 'idle'), 1400)
}
function win() {
  outcome.value = 'win'
  nearMiss.value = false
  reels.value = [['🍋', '🍒', '💎'], ['⭐', '🍒', '🤡'], ['🍉', '🍒', '7️⃣']]
  burstKey.value++
  popKey.value++
  celebrate()
}
function jackpot() {
  outcome.value = 'jackpot'
  nearMiss.value = false
  reels.value = [['🍋', '7️⃣', '💎'], ['⭐', '7️⃣', '🤡'], ['🍉', '7️⃣', '🍒']]
  shakeKey.value++
  flashKey.value++
  burstKey.value++
  celebrate()
}
function near() {
  outcome.value = 'near'
  reels.value = [['🍋', '7️⃣', '💎'], ['⭐', '7️⃣', '🤡'], ['7️⃣', '🍉', '🍒']]
  nearMiss.value = false
  requestAnimationFrame(() => (nearMiss.value = true))
}

const stampKey = ref(0)

/* Оверлеи */
const neonOpen = ref(false)
const paperOpen = ref(false)
const vignette = ref(false)
interface DemoToast {
  id: number
  kind: 'achievement' | 'system'
  name: string
  subtitle?: string
  reward?: string
}
const toasts = ref<DemoToast[]>([])
let toastId = 0
function pushToast(kind: DemoToast['kind']) {
  toastId++
  const item: DemoToast =
    kind === 'achievement'
      ? {
          id: toastId,
          kind,
          name: 'Проигрыш с фанфарами',
          subtitle: 'Это было не «почти». Исход решён до вращения',
          reward: '🎨 Открыт скин: Клоунский'
        }
      : { id: toastId, kind, name: '+5 000₽ на баланс казино' }
  toasts.value = [...toasts.value, item].slice(-3)
}
</script>

<style scoped>
.sc {
  min-height: 100vh;
  background: var(--c-page-fx), var(--c-page);
  color: var(--c-text);
  font-family: var(--font-body);
  font-size: var(--fs-md);
  line-height: var(--lh-body);
}
.sc-controls {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  background: var(--paper-dark);
  color: var(--paper-dark-text);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.sc-controls__title { margin-right: var(--sp-2); }
.sc-controls__group { display: flex; flex-wrap: wrap; gap: var(--sp-1); }
.sc-chip {
  min-height: 32px;
  padding: 0 var(--sp-3);
  border: 1px solid var(--paper-dark-muted);
  border-radius: var(--r-pill);
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.sc-chip[aria-checked='true'],
.sc-chip[aria-pressed='true'] { background: var(--paper-dark-text); color: var(--paper-dark); }
.sc-chip:focus-visible { outline: 2px dashed var(--paper-dark-text); outline-offset: 2px; }

.sc-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--sp-5);
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--sp-5);
  align-items: start;
}
@media (max-width: 1023px) {
  .sc-layout { grid-template-columns: minmax(0, 1fr); padding: var(--sp-3); gap: var(--sp-4); }
}
.sc-main { display: flex; flex-direction: column; gap: var(--sp-5); min-width: 0; }

.sc-section {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-5);
  border-radius: var(--r-lg);
  background: var(--c-panel);
  box-shadow: inset 0 0 0 1px var(--c-line);
}
@media (max-width: 599px) {
  .sc-section { padding: var(--sp-4) var(--sp-3); }
}
.sc-h {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: var(--fs-xl);
  text-transform: var(--tt-display);
}
.sc-row { display: flex; flex-wrap: wrap; gap: var(--sp-3); align-items: center; }
.sc-row--between { justify-content: space-between; }
.sc-row--top { align-items: flex-start; }
.sc-row--top > .ui-slot { flex: 1 1 340px; }
.sc-stack { display: flex; flex-direction: column; gap: var(--sp-3); align-items: flex-start; }
.sc-note { margin: 0; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--c-text-muted); }
.sc-honest {
  margin: var(--sp-2) 0 0;
  padding: var(--sp-2) var(--sp-3);
  max-width: 280px;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  box-shadow: 0 0 0 1px var(--ink);
  transform: rotate(-1.5deg);
}
.ui-carousel .sc-honest { position: absolute; right: var(--sp-5); top: 64px; z-index: 4; }

.sc-label { display: flex; gap: var(--sp-2); align-items: center; font-size: var(--fs-sm); color: var(--c-text-muted); }
.sc-select {
  min-height: 36px;
  padding: 0 var(--sp-2);
  border-radius: var(--r-sm);
  border: 1px solid var(--c-line);
  background: var(--c-panel-2);
  color: var(--c-text);
  font: inherit;
}

/* Демо-барабаны */
.sc-reels { display: grid; grid-template-columns: repeat(3, 1fr); border-radius: var(--r-sm); overflow: hidden; background: var(--c-page); }
.sc-reel + .sc-reel { border-left: 2px solid var(--c-gold); }
.sc-reel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 240px;
}
.sc-sym {
  display: grid;
  place-items: center;
  height: 80px;
  font-family: var(--font-emoji);
  font-size: 56px;
  line-height: 1;
  opacity: .55;
}
.sc-sym--line { opacity: 1; }
@media (max-width: 599px) {
  .sc-reel { height: 180px; }
  .sc-sym { height: 60px; font-size: 42px; }
  .sc-win { font-size: var(--fs-xl); }
}
.sc-win {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: var(--fs-2xl);
  line-height: var(--lh-tight);
  text-transform: var(--tt-display);
}

/* Плитки лобби */
.sc-tile {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--sp-1);
  width: 200px;
  height: 250px;
  padding: var(--sp-4);
  border-radius: var(--r-md);
  background: radial-gradient(circle at 50% 30%, var(--c-panel-2), var(--c-panel));
  box-shadow: inset 0 0 0 1px var(--c-line), var(--shadow-lift);
}
.sc-tile--soon { filter: saturate(.3); }
.sc-tile__emoji { font-family: var(--font-emoji); font-size: 48px; margin: auto 0 var(--sp-2); }
.sc-tile__name { font-family: var(--font-display); font-weight: 800; font-size: var(--fs-lg); line-height: 1.1; }
.sc-tile__by { font-family: var(--font-mono); font-size: var(--fs-fine); color: var(--c-text-fine); }
.sc-stamps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-5);
  align-items: center;
  padding: var(--sp-5);
  background: var(--paper);
  border-radius: var(--r-paper);
  box-shadow: var(--shadow-paper);
  max-width: 420px;
}

/* Типографика */
.sc-type { margin: 0; }
.sc-type--jackpot { font-family: var(--font-display); font-weight: 900; font-size: var(--fs-jackpot); line-height: var(--lh-tight); }
.sc-type--3xl { font-family: var(--font-display); font-weight: 900; font-size: var(--fs-3xl); line-height: var(--lh-tight); text-transform: var(--tt-display); }
.sc-type--caps { font-family: var(--font-condensed); font-weight: 700; font-size: var(--fs-lg); text-transform: var(--tt-caps); letter-spacing: var(--ls-caps); }
.sc-type--mono { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--c-text-muted); }
.sc-type--fine { font-family: var(--font-mono); font-size: var(--fs-fine); color: var(--c-text-fine); }

/* «Жизнь» — бумага всегда */
.sc-life {
  position: sticky;
  top: 64px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  padding: var(--sp-4) var(--sp-4) var(--sp-5) calc(var(--sp-6) + var(--sp-2));
  background: linear-gradient(90deg, transparent 31px, var(--stamp-red) 31px 32px, transparent 32px), var(--paper-rule), var(--paper);
  transform: rotate(-.3deg);
}
@media (max-width: 1023px) {
  .sc-life { position: static; transform: none; }
}
.sc-life__head {
  display: flex;
  justify-content: space-between;
  margin: 0 0 var(--sp-2);
  padding: var(--sp-1) var(--sp-2);
  background: var(--paper-2);
  font-size: var(--fs-sm);
  text-transform: uppercase;
}
.sc-life__head span { color: var(--ink-muted); }
.sc-life__actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); margin-top: var(--sp-3); }
.sc-hand { margin: var(--sp-2) 0; font-family: var(--font-hand); font-weight: 600; font-size: var(--fs-xl); color: var(--stamp-blue); }
.sc-red { color: var(--stamp-red); font-weight: 700; }
</style>
