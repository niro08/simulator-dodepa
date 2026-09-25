import type { GameConfig, ItemId, SlotOutcomeId, SymbolId } from './config'
import type { Rng } from './rng'

/**
 * Модель рана (design/gdd-run-structure.md §3.1, ARCH ADR-005).
 * Изменение формы → новая версия сейва + миграция (src/game/save/migrations.ts).
 */

/** Фаза рана (GDD §3.2). `night` атомарна и в сейве не встречается. */
export type RunPhase = 'morning' | 'event' | 'day' | 'bills' | 'fork' | 'night' | 'daySummary' | 'ended'
export type Location = 'life' | 'casino'
/** `sold` — продано насовсем (событие pawn_offer, CD-12): выкупить нельзя. */
export type ItemStatus = 'owned' | 'pawned' | 'sold'
export type BonusState = 'available' | 'active' | 'done' | 'lost' | 'declined'
export type BillStatus = 'upcoming' | 'due' | 'paid' | 'deferred'
/** 7 концовок (GDD §3.9; id — как в content-pack §1). */
export type EndingId = 'jail' | 'collectors' | 'family_left' | 'casino_nights' | 'minimalism' | 'referral' | 'quit'
export type Grade = 'A' | 'B' | 'C'
export type TiltStage = 'calm' | 'heated' | 'tilt' | 'night'
export type TiltSource =
  | 'spin_loss'
  | 'spin_ldw'
  | 'spin_win'
  | 'all_in'
  | 'sleep'
  | 'casino_night'
  | 'family'
  | 'shift'
  | 'scheme_fail'
  | 'bill_deferred'
  | 'withdraw'
  | 'one_more_week'
  | 'event'

/** Статистика: только числовые монотонные счётчики/максимумы (systems-spec §3.1). Ключи — stats.ts. */
export type PlayerStats = Record<string, number>

export interface Bonus {
  state: BonusState
  /** Оборот, который нужно прокрутить. */
  wagerReq: number
  /** Сколько уже прокручено. */
  wagered: number
}

export interface Withdrawal {
  amount: number
  net: number
  arriveDay: number
}

export interface Bill {
  week: number
  dueDay: number
  /** Фиксированная часть; долговая добавляется в момент оплаты (billTotal). */
  fixed: number
  status: BillStatus
}

/** Дневные счётчики для «Итога дня» (сбрасываются утром). */
export interface DayCounters {
  /** Смены + темки + займы у друзей + выводы. */
  earned: number
  wagered: number
  paidOut: number
  spins: number
  startRep: number
  startTilt: number
  /** Near-miss за день (dream_777). */
  nearMiss: number
  /** Смены за день (boss_caught: «спины в день смены»). */
  shifts: number
}

/**
 * Состояние механик карточек сна (CD-12, content-pack §2). Только числа рана; числа баланса — EVENTS_BALANCE.
 * Появилось в сейве v3.
 */
export interface EventState {
  /** Вычеты из следующих смен, ₽, по одному на смену (boss_caught, boss_advance). */
  shiftDeductions: number[]
  /** Казино недоступно по этот день включительно (mama_blocks_site). 0 — нет блокировки. */
  casinoBlockedUntil: number
  /** Взято у друзей за ран и не возвращено (seryoga_wants_back). */
  friendDebt: number
  /** Смены за текущую неделю (boss_saturday). */
  shiftsThisWeek: number
  /** Выплаты − ставки слота за текущую неделю (cashback_letter: проигрыш = −weekCasinoNet). */
  weekCasinoNet: number
  /** 🔥 в момент отхода ко сну — до ночного спада (insomnia_spin). */
  bedTilt: number
  /** Спинов за ран (signals_channel) — независимо от статистики. */
  spins: number
  /** День последнего спина, 0 — ещё не крутил (push_we_miss_you). */
  lastSpinDay: number
  /** Вещь → день, когда её заложили (pawn_offer: «в ломбарде ≥ N дней»). */
  pawnedOn: Partial<Record<ItemId, number>>
}

/** Снимок «Итог дня» (GDD N8). */
export interface DaySummary {
  day: number
  earned: number
  casinoWagered: number
  casinoPaidOut: number
  casinoNightLoss: number
  livingCost: number
  interest: number
  forcedMfo: number
  debt: number
  wallet: number
  casino: number
  repDelta: number
  tiltDelta: number
  casinoNight: boolean
  /** Событие, выпавшее на утро (id) — для подписи «ночью что-то случилось». */
  eventRolled: boolean
}

export interface RunState {
  id: string
  startedAt: number
  seed: number
  day: number
  phase: RunPhase
  location: Location
  energy: number
  wallet: number
  casino: number
  debtBank: number
  debtMfo: number
  rep: number
  tilt: number
  items: Record<ItemId, ItemStatus>
  bet: number
  bonus: Bonus
  /** Выводы «на рассмотрении». */
  withdrawals: Withdrawal[]
  bills: Bill[]
  graceUsed: boolean
  shiftsDone: number
  friendLoansThisWeek: number
  /** Залипающий флаг «Вы заблокированы». */
  friendsBlocked: boolean
  familyHelpsToday: number
  /** Займы банк/МФО за сегодня (антиабуз ❤️ за погашение). */
  borrowedToday: number
  maxTiltToday: number
  /** Остаток к следующему +1❤️ за погашение. */
  repayProgress: number
  casinoNights: number
  casinoNightPending: boolean
  /** День закончен тильтом 100: в bills/fork нет «Назад». */
  forcedEnd: boolean
  energyModNextMorning: number
  pendingEventId: string | null
  /** id события → день последнего показа (кулдаун и «один раз за ран»). */
  eventCooldowns: Record<string, number>
  /** Выбрано «Ещё неделю» хотя бы раз. */
  endless: boolean
  extraWeeks: number
  endingId: EndingId | null
  grade: Grade | null
  withdrewToday: boolean
  /** Служебное (run-only, systems-spec §3.1): для ачивок и статистики. */
  spinsThisWeek: number
  loseStreak: number
  jackpotToday: boolean
  peakCasino: number
  today: DayCounters
  daySummary: DaySummary | null
  /** Состояние RNG: исход следующего действия не меняется перезагрузкой. */
  rngState: number
  /** Механики карточек сна (CD-12). */
  eventState: EventState
  /** Разовые флаги рана (подсказки; цепочки событий CD-12: deposited, eduard_ignored, mama_told, anzhelika_boost). */
  flags: Record<string, boolean>
  /** Статистика рана (заполняет progress.ts → stats.ts). */
  stats: PlayerStats
  /** Хроника: события, а не строки; текст строит i18n. Новые записи — в начале. */
  log: LogEntry[]
  nextLogId: number
}

export interface LogEntry {
  id: number
  t: number
  event: GameEvent
}

// ─── Команды (GDD §3.5) ─────────────────────────────────────────────────────

export type Command =
  | { type: 'day/wake' }
  | { type: 'day/sleep' }
  /** «Назад» из экрана счёта / развилки. */
  | { type: 'day/resume' }
  | { type: 'event/choose'; option: number }
  | { type: 'bills/pay' }
  | { type: 'bills/defer' }
  | { type: 'bills/refuse' }
  | { type: 'run/quit' }
  | { type: 'run/extend' }
  | { type: 'casino/enter' }
  | { type: 'casino/leave' }
  /** bonus: галочка «ЗАБРАТЬ БОНУС 200%» (по умолчанию включена — пародия, GDD §3.5.3). */
  | { type: 'casino/deposit'; amount: number; bonus?: boolean }
  | { type: 'casino/withdraw'; amount: number }
  | { type: 'bet/set'; value: number }
  | { type: 'slot/spin' }
  | { type: 'work/shift' }
  | { type: 'work/shady' }
  | { type: 'family/help' }
  | { type: 'friends/borrow' }
  | { type: 'bank/loan' }
  | { type: 'mfo/loan' }
  | { type: 'debt/repay'; amount: number }
  | { type: 'pawn/pawn'; item: ItemId }
  | { type: 'pawn/redeem'; item: ItemId }

export type CommandType = Command['type']
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>

/** Коды отказов — контракт GDD §3.5. Текст строит i18n. */
export type RejectReason =
  | 'wrong_phase'
  | 'in_casino'
  | 'not_in_casino'
  | 'no_energy'
  | 'no_money'
  | 'bet_below_min'
  | 'amount_below_min'
  | 'invalid_amount'
  | 'bonus_locked'
  | 'daily_limit'
  | 'friends_blocked'
  | 'no_phone'
  | 'friends_broke'
  | 'rep_too_low'
  | 'debt_limit'
  | 'no_debt'
  | 'item_not_owned'
  | 'item_not_pawned'
  | 'no_bill'
  | 'not_due'
  | 'grace_used'
  | 'not_fork_day'
  | 'bill_unpaid'
  | 'has_debt'
  | 'forced'
  | 'feature_disabled'
  | 'no_event'
  | 'option_unaffordable'
  /** Мама поставила блокировку сайтов (mama_blocks_site): казино закрыто на сегодня. */
  | 'blocked_by_mama'

/** Отказ в выполнении команды. min — число для текста («Мин. 500₽», «Счёт через N дн.»). */
export interface Rejection {
  reason: RejectReason
  min?: number
}

// ─── События (systems-spec §1) ──────────────────────────────────────────────

/** Результат спина (ADR-001): исход решён ядром до анимации. */
export interface SpinResult {
  bet: number
  outcomeId: SlotOutcomeId
  multiplier: number
  payout: number
  /** Раскладка для показа. При nearMiss — подменённая 7-7-X, исход всё равно `lose`. */
  reels: [SymbolId, SymbolId, SymbolId]
  /** Проигрыш, замаскированный под выигрыш: 0 < x < 1. */
  ldw: boolean
  /** Только визуал: «почти 777». */
  nearMiss: boolean
}

export type RunEndId = EndingId | 'abandoned'

export type GameEvent =
  | { type: 'runStarted'; runId: string; seed: number }
  | { type: 'dayStarted'; day: number; week: number }
  | { type: 'slept'; day: number; casinoNight: boolean; tilt70: boolean; cleanWeek: boolean; noSpins: boolean }
  | ({
      type: 'spin'
      allIn: boolean
      energyCost: number
      tiltBefore: number
      casinoBefore: number
      casinoAfter: number
      bonusLocked: boolean
      /** Серия спинов подряд с payout < bet (включая этот). */
      loseStreak: number
    } & SpinResult)
  | { type: 'casinoEntered' }
  | { type: 'casinoLeft' }
  | { type: 'deposit'; amount: number }
  | { type: 'bonusGranted'; deposit: number; bonus: number; wagerRequired: number }
  | { type: 'bonusDeclined' }
  | { type: 'bonusCleared'; released: number }
  | { type: 'bonusBusted'; balanceLeft: number; wagerLeft: number }
  | { type: 'withdrawRequested'; gross: number; fee: number; net: number; arriveDay: number }
  | { type: 'withdrawPaid'; net: number }
  | { type: 'shiftWorked'; pay: number; promoted: boolean; repPenalty: boolean; /** Вычет по карточке сна, ₽. */ deducted?: number }
  | { type: 'schemeResolved'; success: boolean; amount: number; fine: number; jailed: boolean }
  | { type: 'friendBorrowed'; amount: number; diminished: boolean }
  | { type: 'friendsBlocked' }
  | { type: 'familyHelped' }
  | { type: 'loanTaken'; lender: 'bank' | 'mfo'; amount: number }
  | { type: 'interestAccrued'; bank: number; mfo: number; total: number; debt: number }
  | { type: 'debtRepaid'; amount: number; repGain: number; debtLeft: number; viaBill: boolean }
  /** Недостача при обязательном списании оформлена в МФО (GDD §3.5.12). */
  | { type: 'forcedMfo'; amount: number; reason: 'living' | 'shady_fine' | 'event' }
  | { type: 'itemPawned'; itemId: ItemId; amount: number; ownedLeft: number }
  | { type: 'itemRedeemed'; itemId: ItemId; cost: number; pawnAmount: number }
  | { type: 'livingCostPaid'; amount: number }
  | { type: 'billsOpened'; week: number; total: number; forced: boolean }
  | { type: 'billPaid'; week: number; amount: number; late: boolean; debtPart: number }
  | { type: 'billDeferred'; week: number; penalty: number; fixed: number; dueDay: number }
  | { type: 'billCreated'; week: number; dueDay: number; fixed: number }
  | { type: 'forkOpened'; week: number; debt: number; forced: boolean }
  | { type: 'weekChoice'; choice: 'quit' | 'one_more_week'; week: number }
  | { type: 'tiltChanged'; value: number; delta: number; source: TiltSource }
  | { type: 'tiltStageChanged'; from: TiltStage; to: TiltStage }
  | { type: 'casinoNight'; n: number; lost: number }
  | { type: 'sleepEventShown'; eventId: string }
  /** amount/item/wager — для плейсхолдеров текста результата ({net}, {amount}, {item}, {debt}, {wager_left}). */
  | { type: 'sleepEventResolved'; eventId: string; choice: number; amount?: number; item?: ItemId; wager?: number }
  /** Зачисление на баланс казино под вейджер от карточки сна (фриспины, кэшбэк). */
  | { type: 'casinoCredited'; source: 'freespins' | 'cashback'; amount: number; wagerRequired: number }
  /** Вещь продана Гоше насовсем (pawn_offer). */
  | { type: 'itemSold'; itemId: ItemId; amount: number }
  | {
      type: 'runEnded'
      endingId: RunEndId
      grade: Grade | null
      day: number
      weeksSurvived: number
      /** Баланс казино, оставшийся у казино. */
      forfeitedCasino: number
      /** Выводы в очереди, которые не придут. */
      forfeitedWithdrawals: number
      itemsLost: ItemId[]
    }
  | { type: 'betChanged'; from: number; to: number }
  | ({ type: 'rejected'; command: CommandType } & Rejection)
  /** Мета-событие: активное время игры (стор, systems-spec §3.6). Ран не меняет. */
  | { type: 'timeTracked'; playSec: number; underbellySec: number }
  /** Мета-событие (UI): фейковый таймер «бонус сгорит» дошёл до 00:00 (ачивка TIMER_LIES). Ран не меняет. */
  | { type: 'fakeTimerExpired' }
  /** Мета-событие (progress.ts, CD-13): открыто достижение; rewards — CosmeticId из каталога. */
  | { type: 'achievementUnlocked'; id: string; hidden: boolean; rewards: string[] }

export type GameEventType = GameEvent['type']
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>

// ─── События сна (система — здесь, контент — CD-12) ─────────────────────────

/**
 * Эффекты варианта карточки (GDD §3.5.11). Простые ключи общего pipeline + несколько механик CD-12
 * (фриспины, кэшбэк, аванс, продажа вещи, блокировка сайтов) — всё декларативно, числа в EVENTS_BALANCE.
 */
export interface SleepEventEffect {
  wallet?: number
  casino?: number
  rep?: number
  tilt?: number
  /** «−40⚡ завтра» в тексте карточки = сегодня (карточка показывается утром). Кламп [0; ENERGY_PER_DAY]. */
  energyToday?: number
  energyNextMorning?: number
  /** Принудительный долг в МФО (без лимита, как недостача). */
  debtMfo?: number
  /** Погасить долг (МФО → банк) на столько ₽ (не больше долга); деньги — из `cost`. */
  repayDebt?: number
  /** `cost` уходит на баланс казино как обычный депозит (withdraw_verification). */
  costToCasino?: boolean
  /** Вернуть Серёге весь долг рана (seryoga_wants_back; сумма — в `cost: 'friendDebt'`). */
  repayFriend?: boolean
  /** Засчитать смены для повышения (boss_saturday). */
  shiftsDone?: number
  /** Вычеты из следующих смен: фикс ₽ или доля оплаты следующей смены. */
  shiftDeduction?: { amount?: number; shareOfShift?: number; shifts: number }
  /** Обычный займ МФО (sms_preapproved); вариант недоступен, если упирается в лимит долга. */
  mfoLoan?: boolean
  /** Фриспины (push_we_miss_you): EVT_FREESPINS_*; выигрыш блокируется вейджером. */
  freespins?: boolean
  /** Кэшбэк недели (cashback_letter): EVT_CASHBACK_*; блокируется вейджером. */
  cashback?: boolean
  /** Следующий депозит получает бонус Анжелики (EVT_ANZH_*). */
  depositBoost?: boolean
  /** Автосерия спинов по текущей ставке без ⚡ и тильта за спин (insomnia_spin). */
  autoSpins?: number
  /** Казино недоступно N игровых дней, начиная с сегодняшнего (mama_blocks_site). */
  casinoBlockDays?: number
  /** Продать Гоше самую «старую» вещь из ломбарда: +доля залога, выкуп невозможен (pawn_offer). */
  sellPawned?: boolean
  /** Сразу открыть сайт казино (dream_777 «Это знак»). */
  enterCasino?: boolean
  /** Поставить флаг рана (цепочки: eduard_call → eduard_visit, mama_worried → mama_blocks_site). */
  setFlag?: string
}

/** Динамическая стоимость: долг Серёге или «не больше долга» (для eduard_call). */
export type SleepEventCost = number | 'friendDebt' | { upToDebt: number }

export interface SleepEventOption {
  /** Стоимость в ₽ из кошелька; при нехватке вариант недоступен (option_unaffordable). */
  cost?: SleepEventCost
  effect: SleepEventEffect
}

export interface SleepEventDef {
  id: string
  weight: number
  /** Не чаще раза за ран. */
  once?: boolean
  /** Условие появления (проверяется ночью, после сна). */
  when?: (run: RunState, config: GameConfig) => boolean
  /** Ровно 2 варианта; хотя бы один без стоимости (правило контента). */
  options: readonly [SleepEventOption, SleepEventOption]
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

export interface GameContext {
  rng: Rng
  config: GameConfig
  now: number
}

export interface ActionResult {
  ok: boolean
  state: RunState
  events: GameEvent[]
}

// ─── Профиль и настройки (переживают раны; systems-spec §6) ────────────────

export interface RunSummary {
  runId: string
  startedAt: number
  endedAt: number
  endingId: RunEndId
  grade: Grade | null
  days: number
  extraWeeks: number
  casinoNetFinal: number
  totalWagered: number
  totalPaidOut: number
  playSec: number
}

/**
 * Мета-профиль. Мета-валюты нет (пиллар 5, systems-spec §6).
 * achievements — progress.ts (CD-13); equipped/unseenCosmetics — cosmetics.ts. Владение косметикой вычисляется из ачивок.
 */
export interface Profile {
  /** Lifetime-статистика (та же форма, что run.stats). */
  stats: PlayerStats
  /** id достижения (UPPER_SNAKE = Steam API Name) → когда и в каком ране открыто. */
  achievements: Record<string, { unlockedAt: number; runId: string | null }>
  /** Коллекция концовок. */
  endings: Partial<Record<EndingId, { count: number; firstAt: number; bestGrade: Grade | null }>>
  /** Слот косметики (skin, theme, sound, title) → CosmeticId (`skin:fruit`…). Пусто — умолчание. */
  equipped: Record<string, string>
  unseenCosmetics: string[]
  /** Последние раны (FIFO, STATS_BALANCE.RUN_HISTORY_LIMIT). */
  runHistory: RunSummary[]
  flags: { tutorialDone: boolean; hintsSeen: string[] }
}

export interface Settings {
  locale: 'ru' | 'en'
  musicVolume: number
  sfxVolume: number
  reducedMotion: boolean
  skipSpinAnimation: boolean
}
