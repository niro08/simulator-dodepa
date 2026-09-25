import type { GameConfig, SlotOutcomeId, SymbolId } from './config'
import type { Rng } from './rng'

/** Числовые ресурсы забега. */
export interface Resources {
  money: number
  energy: number
  reputation: number
  debt: number
}

/** Изменение ресурсов, которое принесла команда (для хроники, статистики, «+N» в UI). */
export type ResourceDelta = Partial<Resources>

/** Статистика: только числовые счётчики/максимумы (ADR-005). Набор ключей задаёт TD-11. */
export type PlayerStats = Record<string, number>

/**
 * Состояние текущего забега («жизни» лудомана). Сбрасывается новой игрой.
 * Изменение формы → новая версия сейва + миграция (src/game/save/migrations.ts).
 */
export interface RunState extends Resources {
  id: string
  startedAt: number
  bet: number
  /** Состояние RNG: исход следующего действия не меняется перезагрузкой. */
  rngState: number
  /** Разовые флаги забега (события, туториал…). */
  flags: Record<string, boolean>
  /** Статистика забега (заполняется в TD-11). */
  stats: PlayerStats
  /** Хроника: события, а не строки; текст строит i18n. Новые записи — в начале. */
  log: LogEntry[]
  /** Счётчик id записей хроники (стабильные :key). */
  nextLogId: number
}

export interface LogEntry {
  id: number
  t: number
  event: GameEvent
}

// ─── Команды ────────────────────────────────────────────────────────────────

export type Command =
  | { type: 'slot/spin' }
  | { type: 'work/job' }
  | { type: 'work/shady' }
  | { type: 'friends/borrow' }
  | { type: 'friends/help' }
  | { type: 'bank/credit' }
  | { type: 'bank/repay'; amount: number }
  | { type: 'bet/set'; value: number }

export type CommandType = Command['type']
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>

export type RejectReason =
  | 'noEnergy'
  | 'noMoney'
  | 'betTooLow'
  | 'noTrust'
  | 'lowReputation'
  | 'noDebt'
  | 'repayTooLow'
  | 'invalidAmount'

/** Отказ в выполнении команды. min — порог для текста («Минимальная ставка — 50₽»). */
export interface Rejection {
  reason: RejectReason
  min?: number
}

// ─── События ────────────────────────────────────────────────────────────────

/** Результат спина (ADR-001): исход решён ядром до анимации. */
export interface SpinResult {
  bet: number
  outcomeId: SlotOutcomeId
  multiplier: number
  payout: number
  reels: [SymbolId, SymbolId, SymbolId]
}

export type GameEvent =
  | { type: 'runStarted' }
  | ({ type: 'spin'; delta: ResourceDelta } & SpinResult)
  | { type: 'job'; delta: ResourceDelta }
  | { type: 'shady'; delta: ResourceDelta }
  | { type: 'borrow'; delta: ResourceDelta }
  | { type: 'help'; delta: ResourceDelta }
  | { type: 'credit'; delta: ResourceDelta; interest: number }
  | { type: 'repay'; delta: ResourceDelta }
  | { type: 'betChanged'; from: number; to: number }
  | ({ type: 'rejected'; command: CommandType } & Rejection)
  /** Строка из legacy-сейва (до v1). */
  | { type: 'legacyText'; text: string }

export type GameEventType = GameEvent['type']
export type EventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>

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

// ─── Профиль и настройки (переживают забеги) ────────────────────────────────

/**
 * Мета-прогресс игрока (ADR-005). Секции — заготовки под TD-11/12/13:
 * их форму уточнят статистика, достижения и косметика; пустые значения валидны.
 */
export interface Profile {
  /** Lifetime-статистика. */
  stats: PlayerStats
  /** id достижения (UPPER_SNAKE = Steam API Name) → время открытия. */
  achievements: Record<string, { unlockedAt: number }>
  cosmetics: {
    owned: string[]
    /** слот косметики (theme, slotSkin…) → id предмета. */
    equipped: Record<string, string>
  }
  meta: {
    currency: number
    upgrades: Record<string, number>
  }
}

export interface Settings {
  locale: 'ru' | 'en'
  musicVolume: number
  sfxVolume: number
  reducedMotion: boolean
  skipSpinAnimation: boolean
}
