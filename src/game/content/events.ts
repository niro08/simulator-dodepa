import { EVENTS_BALANCE as E, EVENT_WEIGHTS as W, ITEM_IDS, type ItemId, type SleepEventId } from '../config/balance'
import type { GameConfig } from '../config'
import type { RunState, SleepEventDef } from '../types'

/**
 * Карточки сна (CD-12): 26 карточек design/content-pack.md §2 + 3 бытовые life_* (economy-v1 §9.2).
 * Только данные: условие появления (`when`, проверяется ночью, после спада тильта), веса (EVENT_WEIGHTS),
 * 2 варианта с декларативными эффектами (types.ts SleepEventEffect → day.ts applySleepEventOption).
 * Все числа — EVENTS_BALANCE. Тексты — i18n SLEEP_EVENT_TEXTS.
 * Модуль не импортирует rules.ts (config/index → content → rules → config дал бы цикл) — хелперы ниже.
 *
 * Упрощения относительно content-pack (согласовано в economy-v1 «Изменения после CD-12»):
 * - «−N⚡ завтра» = сегодня: карточка показывается утром (energyToday);
 * - dream_777 «+10⚡»: энергия и так 100 утром → работает только поверх утреннего штрафа (кламп 100);
 * - eduard_visit «расчёт долга на 28-й день» — число в результате (sleepEventResolved.amount);
 * - seryoga_blocking: ❤️ ≤ 0 блокирует друзей сразу (GDD §3.8), поэтому карточка — «после блокировки», 1 раз за ран.
 */

const debt = (run: RunState) => run.debtBank + run.debtMfo

/** Ближайший неоплаченный счёт со сроком не раньше сегодняшнего дня. */
function upcomingBill(run: RunState) {
  return run.bills
    .filter((b) => b.status !== 'paid' && b.dueDay >= run.day)
    .sort((a, b) => a.dueDay - b.dueDay)[0]
}

/** Самая давно заложенная вещь, если она лежит в ломбарде ≥ minDays на момент показа (день + 1). */
export function oldestPawned(run: RunState, minDays = 0): ItemId | null {
  let best: ItemId | null = null
  let bestDay = Infinity
  for (const id of ITEM_IDS) {
    if (run.items[id] !== 'pawned') continue
    const since = run.eventState.pawnedOn[id] ?? 0
    if (since < bestDay) {
      best = id
      bestDay = since
    }
  }
  if (best === null) return null
  // Условие проверяется ночью (карточку покажут в день run.day + 1); при выборе утром minDays = 0.
  return run.day + 1 - bestDay >= minDays ? best : null
}

/** Кэшбэк недели (cashback_letter): доля чистого проигрыша слота за неделю. */
export function cashbackAmount(run: RunState, config: GameConfig): number {
  const loss = Math.max(0, -run.eventState.weekCasinoNet)
  return Math.floor(loss * config.events.balance.EVT_CASHBACK_PCT)
}

type Def = SleepEventDef & { id: SleepEventId }
const def = (d: Omit<Def, 'weight'>): Def => ({ ...d, weight: W[d.id] })

export const SLEEP_EVENTS: readonly SleepEventDef[] = [
  def({
    id: 'mama_meds',
    once: true,
    options: [
      { cost: E.EVT_MAMA_MEDS_COST, effect: { rep: E.EVT_MAMA_MEDS_REP } },
      { effect: { rep: E.EVT_MAMA_MEDS_REFUSE_REP, tilt: E.EVT_MAMA_MEDS_REFUSE_TILT } }
    ]
  }),
  def({
    id: 'push_we_miss_you',
    when: (run) => run.day + 1 - run.eventState.lastSpinDay > E.EVT_FREESPINS_IDLE_DAYS,
    options: [{ effect: { freespins: true, tilt: E.EVT_FREESPINS_TILT } }, { effect: { tilt: E.EVT_FREESPINS_DECLINE_TILT } }]
  }),
  def({
    id: 'seryoga_fishing',
    // Выходные: карточка утром субботы или воскресенья (день 7k−1 → 7k, 7k → 7k+1), ❤️ > 0
    when: (run) => (run.day % 7 === 6 || run.day % 7 === 0) && run.rep > 0,
    options: [
      { effect: { energyToday: E.EVT_FISHING_ENERGY, tilt: E.EVT_FISHING_TILT, rep: E.EVT_FISHING_REP } },
      { effect: { rep: E.EVT_FISHING_DECLINE_REP } }
    ]
  }),
  def({
    id: 'eduard_call',
    when: (run) => debt(run) > 0 && run.day + 1 >= E.EVT_EDUARD_CALL_FROM_DAY,
    options: [
      { cost: { upToDebt: E.EVT_EDUARD_CALL_PAY }, effect: { repayDebt: E.EVT_EDUARD_CALL_PAY, tilt: E.EVT_EDUARD_CALL_TILT } },
      { effect: { tilt: E.EVT_EDUARD_CALL_IGNORE_TILT, setFlag: 'eduard_ignored' } }
    ]
  }),
  def({
    id: 'eduard_visit',
    when: (run) =>
      run.flags.eduard_ignored === true || (debt(run) >= E.EVT_EDUARD_VISIT_DEBT && run.day + 1 >= E.EVT_EDUARD_VISIT_FROM_DAY),
    options: [
      { effect: { energyToday: E.EVT_EDUARD_VISIT_ENERGY, tilt: E.EVT_EDUARD_VISIT_TILT } },
      { effect: { tilt: E.EVT_EDUARD_HIDE_TILT, rep: E.EVT_EDUARD_HIDE_REP } }
    ]
  }),
  def({
    id: 'boss_saturday',
    when: (run) => run.eventState.shiftsThisWeek >= E.EVT_BOSS_SAT_MIN_SHIFTS,
    options: [
      { effect: { wallet: E.EVT_BOSS_SAT_PAY, energyToday: E.EVT_BOSS_SAT_ENERGY, tilt: E.EVT_BOSS_SAT_TILT, shiftsDone: 1 } },
      { effect: {} }
    ]
  }),
  def({
    id: 'boss_caught',
    when: (run) => run.maxTiltToday >= E.EVT_BOSS_CAUGHT_TILT && run.today.spins > 0 && run.today.shifts > 0,
    options: [
      { effect: { rep: E.EVT_BOSS_CAUGHT_REP, shiftDeduction: { shareOfShift: E.EVT_BOSS_CAUGHT_PAY_PENALTY, shifts: 1 } } },
      { effect: { tilt: E.EVT_BOSS_SORRY_TILT, rep: E.EVT_BOSS_SORRY_REP } }
    ]
  }),
  def({
    id: 'seryoga_wants_back',
    when: (run) => run.eventState.friendDebt > 0,
    options: [
      { cost: 'friendDebt', effect: { repayFriend: true, rep: E.EVT_SERYOGA_REPAY_REP } },
      { effect: { rep: E.EVT_SERYOGA_DELAY_REP, tilt: E.EVT_SERYOGA_DELAY_TILT } }
    ]
  }),
  def({
    id: 'anzhelika_bonus',
    when: (run) => run.flags.deposited === true && run.flags.anzhelika_boost !== true,
    options: [{ effect: { depositBoost: true } }, { effect: {} }]
  }),
  def({
    id: 'sms_preapproved',
    when: (run, config) =>
      debt(run) + config.balance.MFO_LOAN <= config.balance.DEBT_LIMIT && run.rep < config.balance.BANK_REP_MIN,
    options: [{ effect: { mfoLoan: true } }, { effect: { tilt: E.EVT_SMS_DECLINE_TILT } }]
  }),
  def({
    id: 'signals_channel',
    when: (run) => run.eventState.spins >= E.EVT_SIGNALS_MIN_SPINS,
    options: [{ cost: E.EVT_SIGNALS_COST, effect: {} }, { effect: { tilt: E.EVT_SIGNALS_DECLINE_TILT } }]
  }),
  def({
    id: 'grandma_service',
    when: (run) => run.items.teaset === 'pawned',
    options: [
      { effect: { rep: E.EVT_GRANDMA_LIE_REP, tilt: E.EVT_GRANDMA_LIE_TILT } },
      { effect: { rep: E.EVT_GRANDMA_TRUTH_REP, tilt: E.EVT_GRANDMA_TRUTH_TILT } }
    ]
  }),
  def({
    id: 'dream_777',
    when: (run) => run.today.nearMiss >= E.EVT_DREAM_NEAR_MISS,
    options: [
      { effect: { tilt: E.EVT_DREAM_SIGN_TILT, enterCasino: true } },
      { effect: { tilt: E.EVT_DREAM_SLEEP_TILT, energyToday: E.EVT_DREAM_SLEEP_ENERGY } }
    ]
  }),
  def({
    id: 'neighbor_drill',
    options: [
      { effect: { tilt: E.EVT_DRILL_KNOCK_TILT } },
      { effect: { energyToday: E.EVT_DRILL_WALK_ENERGY, tilt: E.EVT_DRILL_WALK_TILT } }
    ]
  }),
  def({
    id: 'mama_birthday',
    once: true,
    when: (run) => run.day + 1 >= E.EVT_MAMA_BDAY_FROM_DAY && run.day + 1 <= E.EVT_MAMA_BDAY_TO_DAY,
    options: [
      { cost: E.EVT_MAMA_BDAY_COST, effect: { rep: E.EVT_MAMA_BDAY_REP, tilt: E.EVT_MAMA_BDAY_TILT } },
      { effect: { rep: E.EVT_MAMA_BDAY_CHEAP_REP } }
    ]
  }),
  def({
    id: 'stream_clip',
    when: (run) => run.tilt >= E.EVT_CLIP_TILT,
    options: [{ effect: { tilt: E.EVT_CLIP_WATCH_TILT } }, { effect: { tilt: E.EVT_CLIP_REPORT_TILT } }]
  }),
  def({
    id: 'seryoga_blocking',
    once: true,
    when: (run) => run.rep <= 0,
    options: [
      { effect: { energyToday: E.EVT_SERYOGA_SORRY_ENERGY, rep: E.EVT_SERYOGA_SORRY_REP } },
      { effect: { tilt: E.EVT_SERYOGA_OK_TILT } }
    ]
  }),
  def({
    id: 'mfo_robot',
    when: (run) => run.debtMfo > 0,
    options: [{ cost: E.EVT_MFO_PROLONG_FEE, effect: {} }, { effect: { energyToday: E.EVT_MFO_OPERATOR_ENERGY } }]
  }),
  def({
    id: 'withdraw_verification',
    when: (run) => run.withdrawals.length > 0,
    options: [{ cost: E.EVT_VERIFY_DEPOSIT, effect: { costToCasino: true } }, { effect: {} }]
  }),
  def({
    id: 'seryoga_birthday',
    once: true,
    when: (run) => run.rep > 0,
    options: [
      {
        cost: E.EVT_SERYOGA_BDAY_COST,
        effect: { energyToday: E.EVT_SERYOGA_BDAY_ENERGY, rep: E.EVT_SERYOGA_BDAY_REP, tilt: E.EVT_SERYOGA_BDAY_TILT }
      },
      { effect: { rep: E.EVT_SERYOGA_BDAY_SKIP_REP } }
    ]
  }),
  def({
    id: 'insomnia_spin',
    when: (run, config) => run.eventState.bedTilt >= E.EVT_INSOMNIA_BED_TILT && run.casino >= config.balance.MIN_BET,
    options: [
      { effect: { autoSpins: E.EVT_INSOMNIA_SPINS, tilt: E.EVT_INSOMNIA_TILT, energyToday: E.EVT_INSOMNIA_ENERGY } },
      { effect: { tilt: E.EVT_INSOMNIA_RESIST_TILT } }
    ]
  }),
  def({
    id: 'mama_worried',
    once: true,
    when: (run) => run.tilt >= E.EVT_MAMA_WORRY_TILT || run.rep < E.EVT_MAMA_WORRY_REP_BELOW,
    options: [
      { effect: { tilt: E.EVT_MAMA_WORRY_LIE_TILT } },
      { effect: { tilt: E.EVT_MAMA_WORRY_TRUTH_TILT, rep: E.EVT_MAMA_WORRY_TRUTH_REP, setFlag: 'mama_told' } }
    ]
  }),
  def({
    id: 'mama_blocks_site',
    once: true,
    when: (run) => run.flags.mama_told === true,
    options: [
      { effect: { casinoBlockDays: E.EVT_MAMA_BLOCK_DAYS, tilt: E.EVT_MAMA_BLOCK_TILT, rep: E.EVT_MAMA_BLOCK_REP } },
      { effect: { tilt: E.EVT_MAMA_BLOCK_REFUSE_TILT, rep: E.EVT_MAMA_BLOCK_REFUSE_REP } }
    ]
  }),
  def({
    id: 'boss_advance',
    when: (run) => {
      const bill = upcomingBill(run)
      return bill !== undefined && bill.dueDay - run.day <= E.EVT_ADVANCE_DAYS_TO_BILL && run.wallet < bill.fixed
    },
    options: [
      {
        effect: {
          wallet: E.EVT_ADVANCE_AMOUNT,
          shiftDeduction: { amount: E.EVT_ADVANCE_DEDUCT_PER_SHIFT, shifts: E.EVT_ADVANCE_SHIFTS },
          rep: E.EVT_ADVANCE_REP
        }
      },
      { effect: {} }
    ]
  }),
  def({
    id: 'cashback_letter',
    when: (run, config) => -run.eventState.weekCasinoNet >= E.EVT_CASHBACK_MIN_LOSS && cashbackAmount(run, config) > 0,
    options: [{ effect: { cashback: true } }, { effect: { tilt: E.EVT_CASHBACK_DECLINE_TILT } }]
  }),
  def({
    id: 'pawn_offer',
    when: (run) => oldestPawned(run, E.EVT_PAWN_OFFER_MIN_DAYS) !== null,
    options: [{ effect: { sellPawned: true } }, { effect: {} }]
  }),
  // Бытовые (economy-v1 §9.2): обе опции чего-то стоят — ₽ или ⚡/🔥.
  def({
    id: 'life_fridge',
    options: [
      { cost: E.EVT_LIFE_FRIDGE_COST, effect: {} },
      { effect: { energyToday: E.EVT_LIFE_FRIDGE_ENERGY, tilt: E.EVT_LIFE_FRIDGE_TILT } }
    ]
  }),
  def({
    id: 'life_tooth',
    options: [
      { cost: E.EVT_LIFE_TOOTH_COST, effect: {} },
      { effect: { energyToday: E.EVT_LIFE_TOOTH_ENERGY, tilt: E.EVT_LIFE_TOOTH_TILT } }
    ]
  }),
  def({
    id: 'life_fine',
    options: [{ cost: E.EVT_LIFE_FINE_COST, effect: {} }, { effect: { debtMfo: E.EVT_LIFE_FINE_DEBT } }]
  })
]

/** Бытовые карточки отдельно — для тестов дисперсии честного рана. */
export const LIFE_EVENTS: readonly SleepEventDef[] = SLEEP_EVENTS.filter((e) => e.id.startsWith('life_'))
