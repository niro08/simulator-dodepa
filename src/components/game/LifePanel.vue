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
        <div class="life__bar" role="meter" :aria-valuenow="hud.energy" aria-valuemin="0" :aria-valuemax="energyScale" :aria-label="LIFE.energy">
          <span :style="{ width: `${Math.min(100, (hud.energy / energyScale) * 100)}%` }" />
          <i v-if="energyScale > hud.energyMax" :style="{ left: `${(hud.energyMax / energyScale) * 100}%` }" aria-hidden="true" />
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
          @click="!quitReason && shell.requestQuit()"
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
        <div class="dots" :class="{ 'life__no-debt': hud.debt <= 0 }">
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
        <div class="life__bar" role="meter" :aria-valuenow="hud.tilt" aria-valuemin="0" aria-valuemax="100" :aria-label="LIFE.tilt" :aria-valuetext="`${hud.tilt} — ${TILT_STAGE_LABELS[hud.tiltStage].v}`">
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

      <p v-if="shell.inCasino.value && game.phase === 'day'" class="life__casino-note">
        🎰 {{ LIFE.inCasino }}<template v-if="leaveCost > 0"><br />{{ EVENING.wokeLeave(leaveCost) }}</template>
      </p>
      <p v-if="hud.energy === 0 && game.phase === 'day'" class="life__casino-note">{{ LIFE.noEnergy }}</p>

      <section v-if="eveningOn && game.phase === 'day'" class="life__evening" :class="{ 'life__evening--spent': !!eveningUsed }" aria-labelledby="life-evening-title">
        <p id="life-evening-title" class="life__evening-title">
          🌙 {{ EVENING.title }}: <strong>{{ eveningUsed ? EVENING.spent : EVENING.free }}</strong>
        </p>
        <ul class="life__evening-slots">
          <li
            v-for="slot in EVENING_SLOT_IDS"
            :key="slot"
            class="life__evening-slot"
            :class="{ 'life__evening-slot--used': eveningUsed === slot, 'life__evening-slot--off': !!eveningUsed && eveningUsed !== slot }"
            :aria-current="eveningUsed === slot || undefined"
          >
            <button v-if="slot === 'shady' && contacts" type="button" class="life__evening-link" @click="goContacts">
              {{ CONTACTS.eveningSlot }}
            </button>
            <template v-else>{{ EVENING.slots[slot] }}</template><span v-if="eveningUsed === slot" class="sr-only"> — {{ EVENING.slotUsed }}</span>
          </li>
        </ul>
        <p class="life__small" role="status">{{ eveningUsed ? EVENING_USED_TEXTS[eveningUsed] : EVENING.hint }}</p>
      </section>

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
          <template v-if="eveningOn">
            <ActionCard
              :title="EVENING.halfTitle"
              :verb="EVENING.half(B.HALF_SHIFT_ENERGY, halfPay)"
              :cost="`−${B.HALF_SHIFT_ENERGY}⚡`"
              :gains="[LIFE.shiftGain(halfPay, B.TILT_HALF_SHIFT)]"
              :note="EVENING.halfNote"
              :reason="reasonOf('work/half')"
              :busy="busy"
              :flash="flashes.half"
              @act="act('half', { type: 'work/half' })"
            />
            <ActionCard
              :title="EVENING.overtimeTitle"
              :verb="EVENING.overtime(B.OVERTIME_ENERGY, overtimeCash)"
              :cost="`−${B.OVERTIME_ENERGY}⚡`"
              :gains="[LIFE.shiftGain(overtimeCash, B.TILT_OVERTIME)]"
              :note="`${EVENING.eveningTag} ${EVENING.overtimeNote}`"
              :reason="reasonOf('work/overtime')"
              :busy="busy"
              :flash="flashes.overtime"
              @act="act('overtime', { type: 'work/overtime' })"
            />
          </template>
          <ActionCard
            v-if="!contacts"
            :title="LIFE.shady.title"
            :verb="LIFE.shady.verb"
            :cost="`−${B.SHADY_ENERGY}⚡ · ❤️${B.SHADY_REP}`"
            :gains="[LIFE.shadyGain(pct(B.SHADY_SUCCESS), B.SHADY_REWARD_MIN, B.SHADY_REWARD_MAX)]"
            :risks="shadyRisks"
            :note="eveningOn ? EVENING.eveningTag : ''"
            :reason="reasonOf('work/shady')"
            :busy="busy"
            :flash="flashes.shady"
            @act="act('shady', { type: 'work/shady' })"
          />
          <section v-else class="contacts" aria-labelledby="contacts-title">
            <h3 id="contacts-title" ref="contactsHeading" class="contacts__title" tabindex="-1">{{ CONTACTS.title }}</h3>
            <p class="contacts__heat-label" :class="{ minus: contacts.jailRisk }">
              {{ CONTACTS.heat(contacts.heat, contacts.heatPenaltyPct) }}
            </p>
            <div
              class="life__bar contacts__bar"
              :class="{ 'contacts__bar--hot': contacts.jailRisk }"
              role="meter"
              :aria-valuenow="contacts.heat"
              aria-valuemin="0"
              :aria-valuemax="B.CONTACT_HEAT_MAX"
              :aria-valuetext="CONTACTS.heat(contacts.heat, contacts.heatPenaltyPct)"
              aria-labelledby="contacts-title"
            >
              <span :style="{ width: `${Math.min(100, (contacts.heat / B.CONTACT_HEAT_MAX) * 100)}%` }" />
              <i :style="{ left: `${(B.CONTACT_HEAT_JAIL / B.CONTACT_HEAT_MAX) * 100}%` }" aria-hidden="true" />
            </div>
            <p class="life__small">{{ CONTACTS.heatDecay(contacts.heatDecay) }}</p>
            <p v-if="contacts.fakeLuck" class="contacts__luck">
              <span class="vitrina-only">{{ CONTACTS.fakeLuckShowcase }}</span>
              <span class="honest honest-inline">{{ CONTACTS.fakeLuckHonest }}</span>
            </p>

            <p v-if="!contacts.offers.length" class="contacts__empty">{{ CONTACTS.empty }}</p>
            <ul v-else class="contacts__list">
              <li
                v-for="o in contacts.offers"
                :key="o.offerId"
                class="offer"
                :class="{ 'offer--off': !!offerReasons[o.offerId], 'offer--scam': o.scamPrice !== null }"
              >
                <header class="offer__head">
                  <h4 :id="`offer-${o.offerId}`" class="offer__name">{{ CONTACT_NAMES[o.contact].card }}</h4>
                  <span class="offer__tier" :class="`offer__tier--${o.tier}`">{{ CONTACT_TIER_LABELS[o.tier] }}</span>
                </header>
                <template v-if="o.scamPrice === null">
                  <p class="offer__text">{{ CONTACT_TEXTS[o.offerId]?.text }}</p>
                  <p class="offer__chance">
                    <s v-if="o.chance !== o.chanceBase" class="offer__base">{{ pct(o.chanceBase) }}</s>
                    {{ CONTACTS.chance(toPct(o.chance)) }}
                  </p>
                  <p class="offer__money tabular">{{ CONTACTS.money(o.reward, o.fine) }}</p>
                  <p v-if="contacts.jailRisk" class="offer__risk">{{ CONTACTS.jailWarn(toPct(o.jail)) }}</p>
                </template>
                <template v-else>
                  <p class="vitrina-only offer__from">{{ CONTACTS.scamFrom(CONTACT_NAMES[o.contact].name) }}</p>
                  <p class="vitrina-only offer__text">{{ CONTACT_TEXTS[o.offerId]?.claim }}</p>
                  <p class="honest offer__honest">{{ scamHonestLine(o.offerId, o.scamPrice) }}</p>
                  <p class="offer__money offer__money--scam tabular">{{ CONTACTS.scamPrice(o.scamPrice) }}</p>
                </template>
                <p class="offer__meta">
                  <span class="tabular">{{ CONTACTS.cost(o.energy) }}</span>
                  <span v-if="o.rep !== 0">{{ CONTACTS.rep(o.rep) }}</span>
                  <span>{{ contactExpiryLabel(o.expiresIn) }}</span>
                  <span v-if="o.requiresItem" class="offer__item" :title="ITEM_NAMES[o.requiresItem]">
                    {{ ITEM_NAMES[o.requiresItem].split(' ')[0] }}<span class="sr-only">{{ ITEM_NAMES[o.requiresItem] }}</span>
                  </span>
                </p>
                <button
                  type="button"
                  class="paper-btn offer__btn"
                  :aria-disabled="!!offerReasons[o.offerId] || busy || undefined"
                  :aria-describedby="offerReasons[o.offerId] ? `offer-r-${o.offerId}` : undefined"
                  :aria-label="`${CONTACTS.take}: ${CONTACT_NAMES[o.contact].card}`"
                  @click="takeOffer(o.offerId)"
                >
                  {{ CONTACTS.take }}
                </button>
                <p v-if="offerReasons[o.offerId]" :id="`offer-r-${o.offerId}`" class="paper-reason">⚠ {{ offerReasons[o.offerId] }}</p>
              </li>
            </ul>
            <p v-if="flashes.offer" class="life__flash" role="status">{{ flashes.offer }}</p>
            <ul v-if="contacts.burned.length" class="contacts__burned">
              <li v-for="c in contacts.burned" :key="c" class="life__small">{{ contactBurnedLine(c) }}</li>
            </ul>
          </section>
        </template>

        <template v-else-if="tab === 'people'">
          <ActionCard
            :title="LIFE.family.title"
            :verb="LIFE.family.verb"
            :cost="`−${B.FAMILY_ENERGY}⚡`"
            :gains="[LIFE.familyGain(familyRep, B.TILT_FAMILY)]"
            :note="eveningOn ? EVENING.eveningTag : ''"
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
            :note="eveningOn ? `${EVENING.eveningTag} ${LIFE.friendNote}` : LIFE.friendNote"
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
        <p class="life__small">{{ LIFE.sleepHonest(hud.livingCost, sleepTiltDecay(B)) }}</p>
        <template v-if="eveningOn && game.phase === 'day'">
          <button
            type="button"
            class="paper-btn life__early-btn"
            :aria-disabled="!!earlyReason || busy || undefined"
            :aria-describedby="earlyReason ? 'early-reason' : 'early-preview'"
            @click="!earlyReason && act('early', { type: 'day/early' })"
          >
            {{ EVENING.early }}
          </button>
          <p v-if="earlyReason" id="early-reason" class="paper-reason">⚠ {{ earlyReason }}</p>
          <p v-else id="early-preview" class="life__small">{{ EVENING.earlyPreview(earlyPreview.tilt, earlyPreview.energy) }}</p>
          <p v-if="flashes.early" class="life__flash" role="status">{{ flashes.early }}</p>
        </template>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  canExecute,
  earlyBedPreview,
  energyCap,
  familyRepGain,
  halfShiftPay,
  isRejection,
  ITEM_IDS,
  minRepayAmount,
  overtimePay,
  planRepay,
  redeemCost,
  sleepTiltDecay,
  type EveningSlot,
  type ActionResult,
  type Command,
  type ItemId,
  type Rejection,
  type RunState
} from '@/game'
import {
  CONTACT_NAMES,
  CONTACT_TEXTS,
  CONTACT_TIER_LABELS,
  contactBurnedLine,
  contactExpiryLabel,
  EVENING_USED_TEXTS,
  formatEvent,
  formatRejection,
  ITEM_NAMES,
  money,
  scamHonestLine,
  TILT_STAGE_LABELS
} from '@/i18n'
import { BILLS, CONTACTS, EVENING, ITEM_DESC, LIFE, pct } from '@/i18n/ui'
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

// ─── Пакет «Быстрый фикс» (quick-fix-evening.md): при FEATURE_EVENING_FIX=false всё ниже скрыто ───
const eveningOn = B.FEATURE_EVENING_FIX
const EVENING_SLOT_IDS = ['family', 'friends', 'shady', 'overtime'] as const satisfies readonly EveningSlot[]
const eveningUsed = computed<EveningSlot | undefined>(() => (eveningOn ? game.run?.eveningUsed : undefined))
/** Шкала ⚡: при флаге потолок 110 (ранний сон), отметка на обычном максимуме. */
const energyScale = computed(() => Math.max(energyCap(B), hud.value?.energy ?? 0))
/** Цена первого выхода после пробуждения в казино (§3.4) — её же спишет клик по действию Жизни. */
const leaveCost = computed(() => {
  const run = game.run
  return run?.location === 'casino' && run.wokeInCasino ? Math.min(B.WAKE_CASINO_LEAVE_ENERGY, Math.max(0, run.energy)) : 0
})

/** Состояние «как если бы уже вышел из казино» (с ценой выхода после пробуждения). */
function lifeState(run: RunState): RunState {
  if (run.location !== 'casino') return run
  const state: RunState = { ...run, location: 'life', energy: run.energy - leaveCost.value }
  delete state.wokeInCasino
  return state
}

/** Причина недоступности команды Жизни с учётом того, что клик сам выведет из казино. */
function lifeRejection(cmd: Command): Rejection | null {
  const run = game.run
  if (!run) return { reason: 'wrong_phase' }
  return canExecute(lifeState(run), cmd, game.config)
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
const halfPay = computed(() => (game.run ? halfShiftPay(game.run, B) : 0))
const overtimeCash = computed(() => (game.run ? overtimePay(game.run, B) : 0))
const earlyPreview = computed(() => earlyBedPreview({ energy: game.run ? lifeState(game.run).energy : 0 }, B))
const earlyReason = computed(() => (eveningOn ? reasonOf('day/early') : null))
/** ❤️ за визит к маме — из ядра (rules.familyRepGain). */
const familyRep = computed(() => (game.run ? familyRepGain(game.run, B) : B.FAMILY_REP))
const shadyRisks = computed(() => {
  const lines = [LIFE.shadyRisk(pct(1 - B.SHADY_SUCCESS), B.SHADY_FINE)]
  if ((hud.value?.rep ?? 0) <= B.SHADY_JAIL_REP) lines.push(LIFE.shadyJail(pct(B.SHADY_JAIL_CHANCE)))
  return lines
})

// ─── Пакет 2 «Контакты» (contacts-shady §9): null — пакет выключен, показываем старую «Темку» ───
const contacts = computed(() => game.contacts)
const contactsHeading = ref<HTMLElement | null>(null)
/** Доля 0…1 → целые проценты для строк CONTACTS. */
const toPct = (x: number) => Math.round(x * 100)
/** Причины серого состояния по id предложения (как у остальных карточек — «как если бы вышел из казино»). */
const offerReasons = computed<Record<string, string | null>>(() => {
  const out: Record<string, string | null> = {}
  for (const o of contacts.value?.offers ?? []) {
    const cmd: Command = { type: 'work/offer', offerId: o.offerId }
    const r = lifeRejection(cmd)
    out[o.offerId] =
      r?.reason === 'item_not_owned' && o.requiresItem && hud.value?.items[o.requiresItem] === 'pawned'
        ? CONTACTS.itemPawned(ITEM_NAMES[o.requiresItem])
        : r
          ? formatRejection(cmd.type, r)
          : null
  }
  return out
})
/** Слот вечера «📞 Контакты» ведёт к блоку на вкладке «Работа». */
function goContacts() {
  tab.value = 'work'
  void nextTick(() => contactsHeading.value?.focus())
}
/** События исхода сделки — в строку результата (а не побочные «друзья отвернулись»). */
const OFFER_OUTCOMES = new Set(['schemeResolved', 'scamPaid'])
function takeOffer(offerId: string) {
  if (busy.value || offerReasons.value[offerId]) return
  const cmd: Command = { type: 'work/offer', offerId }
  shell.viaLife(() => flash('offer', game.offer(offerId), cmd, OFFER_OUTCOMES))
}

// ─── Строка результата у карточки (1.5 с) — та же строка уходит в Хронику ───
const flashes = reactive<Record<string, string>>({})
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const SKIP = new Set(['casinoLeft', 'tiltChanged', 'tiltStageChanged', 'rejected'])

function flash(key: string, result: ActionResult | null, cmd: Command, prefer?: ReadonlySet<string>) {
  if (!result) return
  let text = ''
  if (!result.ok) {
    const rej = result.events.find((e) => e.type === 'rejected')
    text = rej && rej.type === 'rejected' ? `⚠ ${formatRejection(cmd.type, rej)}` : ''
  } else {
    const ev = (prefer && result.events.find((e) => prefer.has(e.type))) || result.events.find((e) => !SKIP.has(e.type))
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
    ? planRepay(lifeState(game.run), repayDraft.value, game.config)
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
  outline: 2px solid var(--stamp-blue);
  outline-offset: 2px;
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
/* «Долгов нет. …» — фраза без значения: точечный отвод к пустой ячейке не нужен (и висел после переноса) */
.life__no-debt::after {
  content: none;
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

.life__evening {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-2) var(--sp-3);
  border: 2px dashed var(--ink);
  background: var(--paper-white);
}
.life__evening--spent {
  border-style: solid;
}
.life__evening-title {
  font-weight: 700;
}
.life__evening-slots {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
  margin: 0;
  padding: 0;
  list-style: none;
}
.life__evening-slot {
  padding: 0 var(--sp-2);
  border: 1px solid var(--ink);
  font-size: var(--fs-xs);
}
.life__evening-slot--used {
  background: var(--highlighter);
  font-weight: 700;
}
.life__evening-slot--off {
  border-style: dashed;
  opacity: 0.5;
  text-decoration: line-through;
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

.life__evening-link {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

/* Пакет 2 «Контакты» — блок вместо карточки «Темка» */
.contacts {
  display: grid;
  gap: var(--sp-1);
  padding: var(--sp-3);
  border: 1px solid var(--ink);
  border-radius: var(--r-paper);
  background: var(--paper-white);
  min-width: 0;
}
.contacts__title {
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.contacts__title:focus-visible {
  outline: 2px solid var(--stamp-blue);
  outline-offset: 2px;
}
.contacts__heat-label {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.contacts__bar span {
  background: #b36b00;
}
.contacts__bar--hot span {
  background: var(--stamp-red);
}
.contacts__luck {
  justify-self: start;
  padding: 0 var(--sp-2);
  background: var(--highlighter);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.contacts__empty {
  padding: var(--sp-2);
  border: 1px dashed var(--ink);
  font-style: italic;
}
.contacts__list,
.contacts__burned {
  display: grid;
  gap: var(--sp-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.contacts__burned {
  gap: 0;
  text-decoration: line-through;
}
.offer {
  display: grid;
  gap: var(--sp-1);
  min-width: 0;
  padding: var(--sp-2);
  border: 1px solid var(--ink);
  background: var(--paper);
  overflow-wrap: anywhere;
}
.offer--off {
  border-style: dashed;
  opacity: 0.75;
}
.offer--scam {
  border-color: var(--stamp-red);
}
.offer__head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--sp-1) var(--sp-2);
}
.offer__name {
  min-width: 0;
  font-family: var(--font-mono);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.offer__tier {
  flex: none;
  padding: 0 var(--sp-1);
  border: 1px solid var(--ink);
  font-size: var(--fs-xs);
}
.offer__tier--2 {
  border-style: dashed;
}
.offer__tier--3 {
  background: var(--ink);
  color: var(--paper-white);
}
.offer__text,
.offer__from {
  font-size: var(--fs-xs);
  font-style: italic;
}
.offer__from {
  color: var(--ink-muted);
}
.offer__honest {
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--stamp-red);
}
.offer__chance {
  font-weight: 700;
}
.offer__base {
  color: var(--ink-muted);
  font-weight: 400;
}
.offer__money {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.offer__money--scam,
.offer__risk {
  color: var(--stamp-red);
}
.offer__risk {
  font-size: var(--fs-xs);
  font-weight: 700;
}
.offer__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--sp-2);
  color: var(--ink-muted);
  font-size: var(--fs-xs);
}
.offer__item {
  font-family: var(--font-emoji);
}
.offer__btn {
  justify-self: start;
  min-height: var(--tap-min);
}

.life__repay {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
}
.life__input {
  width: 8ch;
  min-height: var(--tap-min);
  padding: 0 var(--sp-2);
  border: 2px solid var(--ink);
  background: var(--paper-white);
  font-family: var(--font-mono);
}
.life__chip {
  min-height: var(--tap-min);
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
.life__early-btn {
  width: 100%;
  min-height: var(--tap-min);
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
