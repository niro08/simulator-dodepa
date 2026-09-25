/**
 * Экономика v1 (design/economy-v1.md §14.1). Единственный источник чисел баланса (ADR-004):
 * ядро, подписи кнопок и «Как играть» читают их отсюда (через ctx.config / store.config).
 * Меняешь число → меняй economy-v1.md §14 и tools/balance-sim/sim.mjs (CFG) и перезапусти симуляцию.
 * Ключи — плоские UPPER_SNAKE из GDD §7 (design/gdd-run-structure.md).
 */

export const ITEM_IDS = ['phone', 'bike', 'laptop', 'teaset', 'console'] as const
export type ItemId = (typeof ITEM_IDS)[number]

export interface BalanceV1 {
  // Ран
  RUN_DAYS: number; ENERGY_PER_DAY: number
  START_WALLET: number; START_REP: number; START_BET: number
  LIVING_COST: number
  BILLS: readonly [number, number, number, number]; BILL_DEBT_SHARE: number
  GRACE_PER_RUN: number; GRACE_PENALTY: number
  ENDLESS_BILL_GROWTH: number; FEATURE_ENDLESS: boolean
  // Казино
  MIN_BET: number; BET_STEP: number; DEPOSIT_MIN: number; SPIN_ENERGY: number
  WITHDRAW_MIN: number; WITHDRAW_FEE: number
  BONUS_MULT: number; BONUS_DEPOSIT_CAP: number; BONUS_WAGER_MULT: number; BONUS_MAX_BET: number
  FREESPINS_COUNT: number; FREESPIN_BET: number; FREESPIN_WAGER_MULT: number
  // Тильт (переопределяет systems-spec §2.9)
  TILT_LOSS: number; TILT_ALLIN: number; TILT_WIN_BIG: number
  TILT_SLEEP_DECAY: number; TILT_FAMILY: number; TILT_SHIFT: number
  TILT_SHADY_FAIL: number; TILT_BILL_DEFERRED: number; TILT_WITHDRAW: number; TILT_ONE_MORE_WEEK: number
  TILT_T1: number; TILT_T2: number; TILT_MAX: number; TILT_NON_SPIN_CAP: number; TILT_AFTER_CASINO_NIGHT: number
  CASINO_NIGHT_LOSS_PCT: number; CASINO_NIGHTS_FOR_ENDING: number
  // Работа
  SHIFT_ENERGY: number; SHIFT_PAY: number
  SHIFT_PROMO_EVERY: number; SHIFT_PROMO_STEP: number; SHIFT_PROMO_MAX: number
  SHIFT_REP_BONUS_STEP: number; SHIFT_REP_BONUS_CAP: number; SHIFT_REP_PENALTY_MULT: number
  SHADY_ENERGY: number; SHADY_REP: number; SHADY_SUCCESS: number
  SHADY_REWARD_MIN: number; SHADY_REWARD_MAX: number; SHADY_REWARD_STEP: number; SHADY_FINE: number
  SHADY_JAIL_REP: number; SHADY_JAIL_CHANCE: number
  // Люди
  FRIEND_ENERGY: number; FRIEND_BASE: number; FRIEND_PER_REP: number; FRIEND_MAX: number
  FRIEND_WEEKLY_DECAY: number; FRIEND_REP: number; FRIEND_MIN_AMOUNT: number
  FAMILY_ENERGY: number; FAMILY_REP: number; FAMILY_HELP_DAILY: number
  // Деньги в долг
  BANK_LOAN: number; BANK_RATE_DAY: number; BANK_REP_MIN: number
  MFO_LOAN: number; MFO_RATE_DAY: number
  DEBT_LIMIT: number; REPAY_MIN: number; REPAY_REP_STEP: number; FIN_ACTION_ENERGY: number
  PAWN_VALUE: Readonly<Record<ItemId, number>>; PAWN_REDEEM_MULT: number
  // ❤️ и концовки
  REP_MIN: number; REP_MAX: number; REP_FAMILY_LEAVES: number
  EVENT_CHANCE_PER_NIGHT: number; EVENT_COOLDOWN_DAYS: number
  MINIMALISM_MONEY: number; REFERRAL_CASINO: number; QUIT_GRADE_A_REP: number
  // Техническое (не экономика): сколько записей хроники хранит ран
  LOG_LIMIT: number
}

export const BALANCE_V1 = {
  RUN_DAYS: 28, ENERGY_PER_DAY: 100,
  START_WALLET: 1000, START_REP: 10, START_BET: 100,
  LIVING_COST: 300,
  BILLS: [3500, 5500, 7500, 10000], BILL_DEBT_SHARE: 0.10,
  GRACE_PER_RUN: 1, GRACE_PENALTY: 0.5,
  ENDLESS_BILL_GROWTH: 1.35, FEATURE_ENDLESS: true,

  MIN_BET: 50, BET_STEP: 10, DEPOSIT_MIN: 50, SPIN_ENERGY: 2,
  WITHDRAW_MIN: 1000, WITHDRAW_FEE: 0.05,
  BONUS_MULT: 2, BONUS_DEPOSIT_CAP: 5000, BONUS_WAGER_MULT: 40, BONUS_MAX_BET: 100,
  FREESPINS_COUNT: 50, FREESPIN_BET: 10, FREESPIN_WAGER_MULT: 40,

  TILT_LOSS: 4, TILT_ALLIN: 10, TILT_WIN_BIG: 5,
  TILT_SLEEP_DECAY: 50, TILT_FAMILY: 15, TILT_SHIFT: 10,
  TILT_SHADY_FAIL: 10, TILT_BILL_DEFERRED: 15, TILT_WITHDRAW: 5, TILT_ONE_MORE_WEEK: 10,
  TILT_T1: 40, TILT_T2: 70, TILT_MAX: 100, TILT_NON_SPIN_CAP: 99, TILT_AFTER_CASINO_NIGHT: 50,
  CASINO_NIGHT_LOSS_PCT: 0.20, CASINO_NIGHTS_FOR_ENDING: 3,

  SHIFT_ENERGY: 60, SHIFT_PAY: 900,
  SHIFT_PROMO_EVERY: 5, SHIFT_PROMO_STEP: 0.15, SHIFT_PROMO_MAX: 5,
  SHIFT_REP_BONUS_STEP: 0.01, SHIFT_REP_BONUS_CAP: 0.30, SHIFT_REP_PENALTY_MULT: 0.70,
  SHADY_ENERGY: 30, SHADY_REP: -2, SHADY_SUCCESS: 0.50,
  SHADY_REWARD_MIN: 1800, SHADY_REWARD_MAX: 2800, SHADY_REWARD_STEP: 100, SHADY_FINE: 2000,
  SHADY_JAIL_REP: -10, SHADY_JAIL_CHANCE: 0.25,

  FRIEND_ENERGY: 10, FRIEND_BASE: 200, FRIEND_PER_REP: 15, FRIEND_MAX: 800,
  FRIEND_WEEKLY_DECAY: 0.5, FRIEND_REP: -3, FRIEND_MIN_AMOUNT: 50,
  FAMILY_ENERGY: 20, FAMILY_REP: 2, FAMILY_HELP_DAILY: 1,

  BANK_LOAN: 5000, BANK_RATE_DAY: 0.003, BANK_REP_MIN: 15,
  MFO_LOAN: 3000, MFO_RATE_DAY: 0.01,
  DEBT_LIMIT: 30000, REPAY_MIN: 500, REPAY_REP_STEP: 2000, FIN_ACTION_ENERGY: 0,
  PAWN_VALUE: { phone: 3000, bike: 2500, laptop: 6000, teaset: 1500, console: 4000 },
  PAWN_REDEEM_MULT: 1.30,

  REP_MIN: -15, REP_MAX: 40, REP_FAMILY_LEAVES: -15,
  EVENT_CHANCE_PER_NIGHT: 0.40, EVENT_COOLDOWN_DAYS: 7,
  MINIMALISM_MONEY: 50, REFERRAL_CASINO: 100000, QUIT_GRADE_A_REP: 20,

  LOG_LIMIT: 50
} as const satisfies BalanceV1

/** Числа карточек событий (ключи — design/content-pack.md §2; + бытовые life_* из economy-v1 §9.2). */
export const EVENTS_BALANCE = {
  EVT_MAMA_MEDS_COST: 2000, EVT_MAMA_MEDS_REP: 4, EVT_MAMA_MEDS_REFUSE_REP: -3, EVT_MAMA_MEDS_REFUSE_TILT: 10,
  EVT_FREESPINS_COUNT: 50, EVT_FREESPINS_BET: 10, EVT_FREESPINS_WAGER: 40, EVT_FREESPINS_TILT: 5, EVT_FREESPINS_DECLINE_TILT: -5,
  EVT_FISHING_ENERGY: -40, EVT_FISHING_TILT: -30, EVT_FISHING_REP: 2, EVT_FISHING_DECLINE_REP: -1,
  EVT_EDUARD_CALL_PAY: 500, EVT_EDUARD_CALL_TILT: -5, EVT_EDUARD_CALL_IGNORE_TILT: 10,
  EVT_EDUARD_VISIT_ENERGY: -20, EVT_EDUARD_VISIT_TILT: -10, EVT_EDUARD_HIDE_TILT: 15, EVT_EDUARD_HIDE_REP: -1,
  EVT_BOSS_SAT_PAY: 600, EVT_BOSS_SAT_ENERGY: -30, EVT_BOSS_SAT_TILT: -5,
  EVT_BOSS_CAUGHT_REP: -1, EVT_BOSS_CAUGHT_PAY_PENALTY: 0.30, EVT_BOSS_SORRY_TILT: -10, EVT_BOSS_SORRY_REP: 1,
  EVT_SERYOGA_REPAY_REP: 3, EVT_SERYOGA_DELAY_REP: -2, EVT_SERYOGA_DELAY_TILT: 5,
  EVT_ANZH_BONUS_PCT: 1.0, EVT_ANZH_BONUS_CAP: 3000, EVT_ANZH_BONUS_WAGER: 35,
  EVT_SMS_DECLINE_TILT: -5, // вариант «ДА» = обычный займ MFO_LOAN / MFO_RATE_DAY
  EVT_SIGNALS_COST: 1000, EVT_SIGNALS_DECLINE_TILT: -5,
  EVT_GRANDMA_LIE_REP: -1, EVT_GRANDMA_LIE_TILT: 5, EVT_GRANDMA_TRUTH_REP: -2, EVT_GRANDMA_TRUTH_TILT: -20,
  EVT_DREAM_SIGN_TILT: 15, EVT_DREAM_SLEEP_TILT: -10, EVT_DREAM_SLEEP_ENERGY: 10,
  EVT_DRILL_KNOCK_TILT: 5, EVT_DRILL_WALK_ENERGY: -10, EVT_DRILL_WALK_TILT: -10,
  EVT_MAMA_BDAY_COST: 3000, EVT_MAMA_BDAY_REP: 4, EVT_MAMA_BDAY_TILT: -10, EVT_MAMA_BDAY_CHEAP_REP: -2,
  EVT_CLIP_WATCH_TILT: 15, EVT_CLIP_REPORT_TILT: -5,
  EVT_SERYOGA_SORRY_ENERGY: -20, EVT_SERYOGA_SORRY_REP: 1, EVT_SERYOGA_OK_TILT: 10,
  EVT_MFO_PROLONG_FEE: 500, EVT_MFO_OPERATOR_ENERGY: -10,
  EVT_VERIFY_DEPOSIT: 1000,
  EVT_SERYOGA_BDAY_COST: 1000, EVT_SERYOGA_BDAY_ENERGY: -30, EVT_SERYOGA_BDAY_REP: 2, EVT_SERYOGA_BDAY_TILT: -20, EVT_SERYOGA_BDAY_SKIP_REP: -1,
  EVT_INSOMNIA_SPINS: 10, EVT_INSOMNIA_TILT: 10, EVT_INSOMNIA_ENERGY: -20, EVT_INSOMNIA_RESIST_TILT: -15,
  EVT_MAMA_WORRY_LIE_TILT: 5, EVT_MAMA_WORRY_TRUTH_TILT: -30, EVT_MAMA_WORRY_TRUTH_REP: 2,
  EVT_MAMA_BLOCK_DAYS: 1, EVT_MAMA_BLOCK_TILT: -20, EVT_MAMA_BLOCK_REP: 1, EVT_MAMA_BLOCK_REFUSE_TILT: 10, EVT_MAMA_BLOCK_REFUSE_REP: -2,
  EVT_ADVANCE_AMOUNT: 2000, EVT_ADVANCE_DEDUCT_PER_SHIFT: 1000, EVT_ADVANCE_SHIFTS: 2, EVT_ADVANCE_REP: -1,
  EVT_CASHBACK_PCT: 0.05, EVT_CASHBACK_WAGER: 10, EVT_CASHBACK_DECLINE_TILT: -5,
  EVT_PAWN_SELL_BONUS: 0.20,
  EVT_LIFE_FRIDGE_COST: 2500, EVT_LIFE_FRIDGE_ENERGY: -60, EVT_LIFE_FRIDGE_TILT: 10,
  EVT_LIFE_TOOTH_COST: 2000, EVT_LIFE_TOOTH_ENERGY: -60, EVT_LIFE_TOOTH_TILT: 15,
  EVT_LIFE_FINE_COST: 1500, EVT_LIFE_FINE_DEBT: 2000,
  // Пороги условий появления (content-pack §2 `when`; CD-12)
  EVT_FREESPINS_IDLE_DAYS: 2, EVT_EDUARD_CALL_FROM_DAY: 8, EVT_EDUARD_VISIT_DEBT: 15000, EVT_EDUARD_VISIT_FROM_DAY: 15,
  EVT_BOSS_SAT_MIN_SHIFTS: 2, EVT_BOSS_CAUGHT_TILT: 40, EVT_SIGNALS_MIN_SPINS: 50, EVT_DREAM_NEAR_MISS: 3,
  EVT_MAMA_BDAY_FROM_DAY: 8, EVT_MAMA_BDAY_TO_DAY: 21, EVT_CLIP_TILT: 30, EVT_INSOMNIA_BED_TILT: 70,
  EVT_MAMA_WORRY_TILT: 40, EVT_MAMA_WORRY_REP_BELOW: 5, EVT_ADVANCE_DAYS_TO_BILL: 2,
  EVT_CASHBACK_MIN_LOSS: 5000, EVT_PAWN_OFFER_MIN_DAYS: 3
} as const satisfies Record<string, number>

/**
 * Веса карточек сна (economy-v1 §9: все 1). Тюнинг частоты — здесь, без правки content/events.ts.
 * Ключи совпадают с id карточек (тест: у каждой карточки пула есть вес).
 */
export const EVENT_WEIGHTS = {
  mama_meds: 1, push_we_miss_you: 1, seryoga_fishing: 1, eduard_call: 1, eduard_visit: 1,
  boss_saturday: 1, boss_caught: 1, seryoga_wants_back: 1, anzhelika_bonus: 1, sms_preapproved: 1,
  signals_channel: 1, grandma_service: 1, dream_777: 1, neighbor_drill: 1, mama_birthday: 1,
  stream_clip: 1, seryoga_blocking: 1, mfo_robot: 1, withdraw_verification: 1, seryoga_birthday: 1,
  insomnia_spin: 1, mama_worried: 1, mama_blocks_site: 1, boss_advance: 1, cashback_letter: 1,
  pawn_offer: 1, life_fridge: 1, life_tooth: 1, life_fine: 1
} as const satisfies Record<string, number>
export type SleepEventId = keyof typeof EVENT_WEIGHTS

/**
 * Честная статистика и Выписка (systems-spec §3.3, §3.6). Цены эквивалентов, связанные с балансом
 * (смена, день жизни), берутся из BALANCE_V1 в statement.ts.
 */
export interface StatsBalance {
  /** Эквиваленты «потеряно в пересчёте на…»: id → цена, ₽ (порядок = приоритет). */
  EQUIVALENTS: readonly { id: string; price: number | 'SHIFT_PAY' | 'LIVING_COST' }[]
  EQUIVALENTS_SHOWN: number
  /** Ниже этой потери — строка «Почти ничего не проиграно». */
  EQ_LOW_LOSS: number
  AWAKE_HOURS: number
  NIGHT_HOURS: number
  /** Больше этого за один тик времени не засчитывается (защита от скачков часов). */
  TICK_MAX_SEC: number
  /** Сколько последних спинов показывает Изнанка. */
  RECENT_SPINS: number
  /** Сколько ранов хранит история профиля (FIFO). */
  RUN_HISTORY_LIMIT: number
}

export const STATS_BALANCE = {
  EQUIVALENTS: [
    { id: 'EQ_GIFT_MOM', price: 3000 },
    { id: 'EQ_UTILITIES', price: 6000 },
    { id: 'EQ_SHIFTS', price: 'SHIFT_PAY' },
    { id: 'EQ_DAYS_OF_LIFE', price: 'LIVING_COST' },
    { id: 'EQ_SHAWARMA', price: 250 },
    { id: 'EQ_FISHING', price: 1500 }
  ],
  EQUIVALENTS_SHOWN: 3,
  EQ_LOW_LOSS: 250,
  AWAKE_HOURS: 16,
  NIGHT_HOURS: 8,
  TICK_MAX_SEC: 15,
  RECENT_SPINS: 10,
  RUN_HISTORY_LIMIT: 20
} as const satisfies StatsBalance
