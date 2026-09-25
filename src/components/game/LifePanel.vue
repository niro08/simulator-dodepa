<template>
  <aside id="life-zone" class="life paper" aria-labelledby="life-title">
    <div class="life__clip" aria-hidden="true">📎</div>
    <header class="life__head">
      <p class="life__kicker">{{ LIFE.title }}</p>
      <h2 id="life-title" ref="heading" class="life__day" tabindex="-1">
        {{ hud ? LIFE.day(hud.day, hud.runDays, hud.week, hud.endless) : '' }}
      </h2>
    </header>

    <template v-if="hud">
      <div class="life__meter">
        <span class="life__meter-label">⚡ {{ LIFE.energy }}</span>
        <div class="life__bar" role="meter" :aria-valuenow="hud.energy" aria-valuemin="0" :aria-valuemax="hud.energyMax" :aria-label="LIFE.energy">
          <span :style="{ width: `${(hud.energy / hud.energyMax) * 100}%` }" />
        </div>
        <span class="life__meter-val tabular">{{ hud.energy }}/{{ hud.energyMax }}</span>
      </div>

      <section v-if="hud.bill" class="life__bill" :class="{ 'life__bill--today': hud.bill.isToday }" aria-label="Счёт недели">
        <p class="life__bill-title">
          {{ LIFE.bill(hud.bill.daysLeft, hud.bill.week) }}
          <Stamp v-if="hud.bill.status === 'deferred'" :text="BILLS.overdue" size="sm" :rotate="-6" :animate="false" />
        </p>
        <p class="life__bill-sum tabular">{{ LIFE.billLines(hud.bill.fixed, hud.bill.total) }}</p>
        <p class="life__bill-wallet" :class="walletShort > 0 ? 'minus' : 'plus'">
          {{ walletShort > 0 ? LIFE.billShort(hud.wallet, walletShort) : LIFE.billEnough(hud.wallet) }}
        </p>
        <template v-if="hud.bill.isToday && hud.bill.status !== 'paid' && game.phase === 'day'">
          <button
            type="button"
            class="paper-btn paper-btn--primary life__pay"
            :aria-disabled="!!payReason || busy || undefined"
            :aria-describedby="payReason ? 'pay-reason' : undefined"
            @click="act('pay', { type: 'bills/pay' })"
          >
            {{ LIFE.billPay(hud.bill.total) }}
          </button>
          <p v-if="payReason" id="pay-reason" class="paper-reason">⚠ {{ payReason }}</p>
          <p class="life__small">{{ LIFE.billWalletOnly }}</p>
        </template>
        <p v-if="flashes.pay" class="life__flash" role="status">{{ flashes.pay }}</p>
      </section>
      <p v-else class="life__small">{{ LIFE.noBills }}</p>

      <section v-if="hud.forkOpen && game.phase === 'day'" class="life__fork">
        <p class="life__small">{{ LIFE.quitHint }}</p>
        <button
          type="button"
          class="paper-btn paper-btn--primary"
          :aria-disabled="!!quitReason || undefined"
          @click="!quitReason && game.execute({ type: 'run/quit' })"
        >
          {{ LIFE.quit }}
        </button>
        <p v-if="quitReason" class="paper-reason">⚠ {{ quitReason }}</p>
      </section>

      <dl class="life__stats">
        <div class="dots">
          <dt>👛 {{ LIFE.wallet }}</dt>
          <dd :class="{ minus: hud.wallet < 0 }">{{ money(hud.wallet) }}₽</dd>
        </div>
        <div class="dots">
          <dt>{{ hud.debt > 0 ? '💳 Долг' : LIFE.noDebt }}</dt>
          <dd v-if="hud.debt > 0">{{ money(hud.debt) }}₽ <span class="life__small">+{{ money(hud.interestTonight) }}₽/ночь</span></dd>
          <dd v-else />
        </div>
        <div class="dots">
          <dt>❤️ {{ LIFE.rep }}</dt>
          <dd>{{ hud.rep }}</dd>
        </div>
      </dl>

      <div class="life__meter life__meter--tilt" :class="`life__meter--${hud.tiltStage}`">
        <span class="life__meter-label">🔥 {{ LIFE.tilt }}</span>
        <div class="life__bar" role="meter" :aria-valuenow="hud.tilt" aria-valuemin="0" aria-valuemax="100" :aria-label="LIFE.tilt">
          <span :style="{ width: `${Math.min(100, hud.tilt)}%` }" />
          <i :style="{ left: `${B.TILT_T1}%` }" aria-hidden="true" />
          <i :style="{ left: `${B.TILT_T2}%` }" aria-hidden="true" />
        </div>
        <span class="life__meter-val tabular">{{ hud.tilt }}</span>
      </div>
      <p class="life__tilt-label">
        <strong v-if="hud.tilt >= B.TILT_T2" class="life__tilt-tag">{{ LIFE.tiltTag }}</strong>
        {{ TILT_STAGE_LABELS[hud.tiltStage].v }} — <span class="life__small">{{ TILT_STAGE_LABELS[hud.tiltStage].i }}</span>
      </p>

      <div class="life__items" :aria-label="LIFE.items">
        <span class="life__items-label">{{ LIFE.items }}:</span>
        <span
          v-for="id in ITEM_IDS"
          :key="id"
          class="life__item"
          :class="`life__item--${hud.items[id]}`"
          :title="`${ITEM_NAMES[id]}${hud.items[id] === 'owned' ? '' : ` — ${hud.items[id] === 'pawned' ? LIFE.itemPawned : LIFE.itemSold}`}`"
        >
          {{ ITEM_NAMES[id].split(' ')[0] }}<span class="sr-only">{{ ITEM_NAMES[id] }} {{ hud.items[id] === 'owned' ? '' : hud.items[id] === 'pawned' ? LIFE.itemPawned : LIFE.itemSold }}</span>
        </span>
      </div>

      <p v-if="shell.inCasino.value && game.phase === 'day'" class="life__casino-note">🎰 {{ LIFE.inCasino }}</p>
      <p v-if="hud.energy === 0 && game.phase === 'day'" class="life__casino-note">{{ LIFE.noEnergy }}</p>

      <div class="life__tabs" role="tablist" :aria-label="'Разделы Жизни'" @keydown="onTabKey">
        <button
          v-for="t in TAB_IDS"
          :id="`life-tab-${t}`"
          :key="t"
          type="button"
          role="tab"
          class="life__tab"
          :aria-selected="tab === t"
          :aria-controls="`life-panel-${t}`"
          :tabindex="tab === t ? 0 : -1"
          @click="tab = t"
        >
          {{ LIFE.tabs[t] }}
        </button>
      </div>

      <div :id="`life-panel-${tab}`" class="life__panel" role="tabpanel" :aria-labelledby="`life-tab-${tab}`">
        <template v-if="tab === 'work'">
          <ActionCard
            :title="LIFE.shift.title"
            :verb="LIFE.shift.verb"
            :cost="`−${B.SHIFT_ENERGY}⚡`"
            :gains="[LIFE.shiftGain(hud.shiftPay, B.TILT_SHIFT)]"
            :note="LIFE.shiftPromo(hud.shiftsToPromo)"
            :reason="reasonOf('work/shift')"
            :busy="busy"
            :flash="flashes.shift"
            @act="act('shift', { type: 'work/shift' })"
          />
          <ActionCard
            :title="LIFE.shady.title"
            :verb="LIFE.shady.verb"
            :cost="`−${B.SHADY_ENERGY}⚡ · ❤️${B.SHADY_REP}`"
            :gains="[LIFE.shadyGain(pct(B.SHADY_SUCCESS), B.SHADY_REWARD_MIN, B.SHADY_REWARD_MAX)]"
            :risks="shadyRisks"
            :reason="reasonOf('work/shady')"
            :busy="busy"
            :flash="flashes.shady"
            @act="act('shady', { type: 'work/shady' })"
          />
        </template>

        <template v-else-if="tab === 'people'">
          <ActionCard
            :title="LIFE.family.title"
            :verb="LIFE.family.verb"
            :cost="`−${B.FAMILY_ENERGY}⚡`"
            :gains="[LIFE.familyGain(B.FAMILY_REP, B.TILT_FAMILY)]"
            :reason="reasonOf('family/help')"
            :busy="busy"
            :flash="flashes.family"
            @act="act('family', { type: 'family/help' })"
          />
          <ActionCard
            :title="LIFE.friend.title"
            :verb="LIFE.friend.verb"
            :cost="`−${B.FRIEND_ENERGY}⚡ · ❤️${B.FRIEND_REP}`"
            :gains="[LIFE.friendGain(hud.friendAmount)]"
            :note="LIFE.friendNote"
            :reason="reasonOf('friends/borrow')"
            :busy="busy"
            :flash="flashes.friend"
            @act="act('friend', { type: 'friends/borrow' })"
          />
        </template>

        <template v-else-if="tab === 'money'">
          <ActionCard
            :title="LIFE.bank.title"
            :verb="LIFE.bank.verb"
            :cost="`+${money(B.BANK_LOAN)}₽`"
            :gains="[LIFE.bankGain(B.BANK_LOAN, pct(B.BANK_RATE_DAY, 1))]"
            :note="LIFE.bankNote(B.BANK_REP_MIN, hud.rep)"
            :reason="reasonOf('bank/loan')"
            :busy="busy"
            :flash="flashes.bank"
            @act="act('bank', { type: 'bank/loan' })"
          />
          <ActionCard
            variant="mfo"
            :title="LIFE.mfo.title"
            :verb="LIFE.mfo.verb"
            :shout="LIFE.mfoShout(B.MFO_LOAN)"
            :fine="LIFE.mfoFine(pct(mfoApr), B.MFO_LOAN, mfoAfter28)"
            :note="LIFE.debtLimit(B.DEBT_LIMIT)"
            :reason="reasonOf('mfo/loan')"
            :busy="busy"
            :flash="flashes.mfo"
            @act="act('mfo', { type: 'mfo/loan' })"
          />
          <ActionCard
            v-if="hud.debt > 0"
            :title="LIFE.repay.title"
            :verb="`${LIFE.repay.verb} ${money(repayLabel)}₽`"
            :note="LIFE.repayNote(B.REPAY_REP_STEP)"
            :reason="repayReason"
            :busy="busy"
            :flash="flashes.repay"
            @act="repay"
          >
            <div class="life__repay">
              <input
                v-model.number="repayDraft"
                class="life__input tabular"
                type="number"
                inputmode="numeric"
                :min="repayMin"
                :step="B.REPAY_MIN"
                :aria-label="LIFE.repayAmount"
                @change="normalizeRepay"
              />
              <span>₽</span>
              <button type="button" class="paper-btn life__chip" @click="repayDraft = Math.min(hud.debt, Math.max(hud.wallet, repayMin))">
                {{ LIFE.repayAll }}
              </button>
            </div>
          </ActionCard>
        </template>

        <template v-else>
          <p class="life__pawn-title">{{ LIFE.pawnTitle }}</p>
          <p class="life__small">{{ LIFE.pawnSub }}</p>
          <p v-if="ownedCount === 0" class="life__small">{{ LIFE.pawnEmpty }}</p>
          <ul class="life__pawn">
            <li v-for="id in ITEM_IDS" :key="id" class="life__pawn-item" :class="`life__pawn-item--${hud.items[id]}`">
              <div class="dots">
                <span>{{ ITEM_NAMES[id] }}</span>
                <span v-if="hud.items[id] === 'owned'">+{{ money(B.PAWN_VALUE[id]) }}₽</span>
                <span v-else-if="hud.items[id] === 'pawned'">{{ LIFE.itemPawned }}</span>
                <span v-else>{{ LIFE.soldForever }}</span>
              </div>
              <p class="life__small">{{ ITEM_DESC[id]?.desc }} {{ ITEM_DESC[id]?.note ?? '' }}</p>
              <template v-if="hud.items[id] === 'owned'">
                <div v-if="confirmItem === id" class="life__confirm" role="group">
                  <span class="life__small">{{ LIFE.pawnConfirm(ITEM_NAMES[id], B.PAWN_VALUE[id], redeemCost(id, B)) }}</span>
                  <button type="button" class="paper-btn paper-btn--primary" @click="pawn(id)">{{ LIFE.yes }}</button>
                  <button type="button" class="paper-btn" @click="confirmItem = null">{{ LIFE.no }}</button>
                </div>
                <button
                  v-else
                  type="button"
                  class="paper-btn"
                  :aria-disabled="!!reasonOf({ type: 'pawn/pawn', item: id }) || busy || undefined"
                  @click="!reasonOf({ type: 'pawn/pawn', item: id }) && !busy && (confirmItem = id)"
                >
                  🏷 {{ LIFE.pawn }}
                </button>
              </template>
              <template v-else-if="hud.items[id] === 'pawned'">
                <button
                  type="button"
                  class="paper-btn"
                  :aria-disabled="!!reasonOf({ type: 'pawn/redeem', item: id }) || busy || undefined"
                  @click="!reasonOf({ type: 'pawn/redeem', item: id }) && act(`redeem-${id}`, { type: 'pawn/redeem', item: id })"
                >
                  ↩️ {{ LIFE.redeem(redeemCost(id, B)) }}
                </button>
                <p v-if="reasonOf({ type: 'pawn/redeem', item: id })" class="paper-reason">
                  ⚠ {{ reasonOf({ type: 'pawn/redeem', item: id }) }}
                </p>
              </template>
              <p v-if="flashes[`pawn-${id}`] || flashes[`redeem-${id}`]" class="life__flash" role="status">
                {{ flashes[`pawn-${id}`] || flashes[`redeem-${id}`] }}
              </p>
            </li>
          </ul>
        </template>
      </div>

      <div class="life__sleep">
        <button
          type="button"
          class="paper-btn paper-btn--primary life__sleep-btn"
          :aria-disabled="!!game.actions.sleep || busy || undefined"
          @click="!busy && shell.requestSleep()"
        >
          {{ LIFE.sleep }} <kbd>N</kbd>
        </button>
        <p class="life__small">{{ LIFE.sleepHonest(hud.livingCost, B.TILT_SLEEP_DECAY) }}</p>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  canExecute,
  isRejection,
  ITEM_IDS,
  minRepayAmount,
  planRepay,
  redeemCost,
  type ActionResult,
  type Command,
  type ItemId,
  type Rejection
} from '@/game'
import { formatEvent, formatRejection, ITEM_NAMES, money, TILT_STAGE_LABELS } from '@/i18n'
import { BILLS, ITEM_DESC, LIFE, pct } from '@/i18n/ui'
import { useGameStore } from '@/stores/game'
import { useShell } from '@/composables/useShell'
import ActionCard from './ActionCard.vue'
import Stamp from '@/components/ui/Stamp.vue'

/**
 * S20 «Жизнь» — бумажная панель (art-bible §3.12): честная, всегда рядом с Витриной.
 * Доступность действий — предикат ядра «как если бы ты уже вышел из казино»: выход делает сам клик
 * (при 🔥 ≥ 70 — через S14). Числа — из конфига и HUD, логики здесь нет.
 */
const game = useGameStore()
const shell = useShell()
const B = game.config.balance
const hud = computed(() => game.hud)
const busy = computed(() => shell.spinning.value)

const TAB_IDS = ['work', 'people', 'money', 'pawn'] as const
type TabId = (typeof TAB_IDS)[number]
const tab = ref<TabId>('work')

function onTabKey(event: KeyboardEvent) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
  const i = TAB_IDS.indexOf(tab.value)
  const next = TAB_IDS[(i + (event.key === 'ArrowRight' ? 1 : TAB_IDS.length - 1)) % TAB_IDS.length] ?? 'work'
  tab.value = next
  document.getElementById(`life-tab-${next}`)?.focus()
  event.preventDefault()
}

/** Причина недоступности команды Жизни с учётом того, что клик сам выведет из казино. */
function lifeRejection(cmd: Command): Rejection | null {
  const run = game.run
  if (!run) return { reason: 'wrong_phase' }
  const state = run.location === 'casino' ? { ...run, location: 'life' as const } : run
  return canExecute(state, cmd, game.config)
}
function reasonOf(cmd: Command | Command['type']): string | null {
  const command = typeof cmd === 'string' ? ({ type: cmd } as Command) : cmd
  const r = lifeRejection(command)
  return r ? formatRejection(command.type, r) : null
}

const payReason = computed(() => (game.actions.payBill ? formatRejection('bills/pay', game.actions.payBill) : null))
const quitReason = computed(() => (game.actions.quit ? formatRejection('run/quit', game.actions.quit) : null))
const walletShort = computed(() => (hud.value?.bill ? Math.max(0, hud.value.bill.total - hud.value.wallet) : 0))
const ownedCount = computed(() => (hud.value ? ITEM_IDS.filter((id) => hud.value?.items[id] === 'owned').length : 0))
const mfoApr = computed(() => (1 + B.MFO_RATE_DAY) ** 365 - 1)
const mfoAfter28 = computed(() => Math.round(B.MFO_LOAN * (1 + B.MFO_RATE_DAY) ** B.RUN_DAYS))
const shadyRisks = computed(() => {
  const lines = [LIFE.shadyRisk(pct(1 - B.SHADY_SUCCESS), B.SHADY_FINE)]
  if ((hud.value?.rep ?? 0) <= B.SHADY_JAIL_REP) lines.push(LIFE.shadyJail(pct(B.SHADY_JAIL_CHANCE)))
  return lines
})

// ─── Строка результата у карточки (1.5 с) — та же строка уходит в Хронику ───
const flashes = reactive<Record<string, string>>({})
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const SKIP = new Set(['casinoLeft', 'tiltChanged', 'tiltStageChanged', 'rejected'])

function flash(key: string, result: ActionResult | null, cmd: Command) {
  if (!result) return
  let text = ''
  if (!result.ok) {
    const rej = result.events.find((e) => e.type === 'rejected')
    text = rej && rej.type === 'rejected' ? `⚠ ${formatRejection(cmd.type, rej)}` : ''
  } else {
    const ev = result.events.find((e) => !SKIP.has(e.type))
    text = ev ? formatEvent(ev, game.run?.nextLogId ?? 0) : ''
  }
  if (!text) return
  flashes[key] = text
  const old = timers.get(key)
  if (old) clearTimeout(old)
  timers.set(
    key,
    setTimeout(() => {
      delete flashes[key]
      timers.delete(key)
    }, 2500)
  )
}

function act(key: string, cmd: Command) {
  if (busy.value) return
  shell.viaLife(() => flash(key, game.execute(cmd), cmd))
}

function pawn(id: ItemId) {
  confirmItem.value = null
  act(`pawn-${id}`, { type: 'pawn/pawn', item: id })
}
const confirmItem = ref<ItemId | null>(null)

// ─── Погашение долга (TD-09: черновик, нормализует ядро) ───
const repayDraft = ref<number>(B.REPAY_MIN)
const repayMin = computed(() => minRepayAmount(hud.value?.debt ?? 0, game.config))
const repayPlan = computed(() =>
  game.run
    ? planRepay(game.run.location === 'casino' ? { ...game.run, location: 'life' } : game.run, repayDraft.value, game.config)
    : ({ reason: 'no_debt' } as Rejection)
)
const repayLabel = computed(() => {
  const plan = repayPlan.value
  return isRejection(plan) ? Math.max(0, Math.floor(repayDraft.value || 0)) : plan.amount
})
const repayReason = computed(() => {
  const plan = repayPlan.value
  if (isRejection(plan)) return formatRejection('debt/repay', plan)
  return reasonOf({ type: 'debt/repay', amount: plan.amount })
})
watch(
  () => hud.value?.debt ?? 0,
  (debt) => {
    if (debt > 0 && (repayDraft.value > debt || repayDraft.value < repayMin.value)) repayDraft.value = repayMin.value
  },
  { immediate: true }
)
function normalizeRepay() {
  const plan = repayPlan.value
  repayDraft.value = isRejection(plan) ? repayMin.value : plan.amount
}
function repay() {
  act('repay', { type: 'debt/repay', amount: repayDraft.value })
}

const heading = ref<HTMLElement | null>(null)
function focusHeading() {
  heading.value?.focus({ preventScroll: false })
}

onBeforeUnmount(() => timers.forEach(clearTimeout))
defineExpose({ focusHeading })
</script>

<style scoped>
.life {
  position: relative;
  display: grid;
  align-content: start;
  gap: var(--sp-3);
  padding: var(--sp-5) var(--sp-4) var(--sp-4);
  background: var(--paper) var(--paper-rule);
  font-size: var(--fs-sm);
}
.life__clip {
  position: absolute;
  top: -14px;
  right: 24px;
  font-size: 28px;
  transform: rotate(20deg);
}
.life__kicker {
  font-family: var(--font-condensed);
  font-size: var(--fs-xs);
  letter-spacing: var(--ls-wide);
  color: var(--ink-muted);
}
.life__day {
  font-family: var(--font-mono);
  font-size: var(--fs-lg);
  font-weight: 700;
}
.life__day:focus-visible {
  outline: none;
  background: var(--highlighter);
  box-shadow: 0 0 0 2px var(--highlighter);
}

.life__meter {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--sp-2);
}
.life__meter-label {
  font-weight: 700;
}
.life__bar {
  position: relative;
  height: 12px;
  border: 1px solid var(--ink);
  background: var(--paper-white);
}
.life__bar span {
  display: block;
  height: 100%;
  background: repeating-linear-gradient(90deg, var(--ink) 0 8px, #444 8px 10px);
}
.life__bar i {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  background: var(--stamp-red);
}
.life__meter--tilt .life__bar span {
  background: var(--ink-muted);
}
.life__meter--heated .life__bar span {
  background: #b36b00;
}
.life__meter--tilt.life__meter--tilt .life__bar span,
.life__meter--night .life__bar span {
  background: var(--stamp-red);
}
.life__meter-val {
  min-width: 4ch;
  text-align: right;
  font-weight: 700;
}
.life__tilt-label {
  font-size: var(--fs-xs);
}
.life__tilt-tag {
  padding: 0 var(--sp-1);
  background: var(--stamp-red);
  color: var(--paper-white);
}

.life__bill {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3);
  border: 2px solid var(--ink);
  background: var(--paper-white);
}
.life__bill--today {
  border-color: var(--stamp-red);
  box-shadow: 3px 3px 0 var(--stamp-red);
}
.life__bill-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  font-weight: 700;
}
.life__bill-sum {
  font-size: var(--fs-md);
}
.life__pay {
  margin-top: var(--sp-1);
}
.life__fork {
  display: grid;
  gap: var(--sp-2);
  padding: var(--sp-3);
  border: 2px dashed var(--stamp-green);
}

.life__stats {
  display: grid;
  gap: var(--sp-1);
  margin: 0;
}
.life__stats dd {
  margin: 0;
  font-weight: 700;
}

.life__items {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}
.life__items-label {
  font-weight: 700;
}
.life__item {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--ink);
  background: var(--paper-white);
  font-family: var(--font-emoji);
}
.life__item--pawned {
  border-style: dashed;
  opacity: 0.45;
  filter: grayscale(1);
}
.life__item--sold {
  opacity: 0.2;
  filter: grayscale(1);
  text-decoration: line-through;
}

.life__casino-note {
  padding: var(--sp-2);
  background: var(--highlighter);
  font-size: var(--fs-xs);
  font-weight: 700;
}

.life__tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 2px solid var(--ink);
}
.life__tab {
  min-height: var(--tap-min);
  padding: 0 var(--sp-1);
  border: 0;
  border-right: 1px solid var(--ink);
  background: var(--paper-white);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.life__tab:last-child {
  border-right: 0;
}
.life__tab[aria-selected='true'] {
  background: var(--ink);
  color: var(--paper-white);
}
.life__panel {
  display: grid;
  gap: var(--sp-2);
}

.life__repay {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}
.life__input {
  width: 8ch;
  min-height: 36px;
  padding: 0 var(--sp-2);
  border: 2px solid var(--ink);
  background: var(--paper-white);
  font-family: var(--font-mono);
}
.life__chip {
  min-height: 36px;
  padding: 0 var(--sp-2);
  font-size: var(--fs-xs);
}

.life__pawn-title {
  font-weight: 700;
}
.life__pawn {
  display: grid;
  gap: var(--sp-2);
}
.life__pawn-item {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-2);
  border: 1px solid var(--ink);
  background: var(--paper-white);
}
.life__pawn-item--pawned,
.life__pawn-item--sold {
  border-style: dashed;
  background: transparent;
}
.life__pawn-item .paper-btn {
  justify-self: start;
}
.life__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}

.life__small {
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.life__flash {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
  padding: var(--sp-1) var(--sp-2);
  background: var(--highlighter);
}

.life__sleep {
  display: grid;
  gap: var(--sp-1);
  padding-top: var(--sp-2);
  border-top: 2px dashed var(--ink);
}
.life__sleep-btn {
  width: 100%;
  min-height: 52px;
  font-size: var(--fs-md);
}
@media (max-width: 1023px) {
  /* На мобильном «Лечь спать» — липкая CTA над таб-баром */
  .life__sleep-btn {
    display: none;
  }
}
kbd {
  padding: 0 var(--sp-1);
  border: 1px solid currentColor;
  border-radius: var(--r-xs);
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  font-weight: 400;
}
</style>
