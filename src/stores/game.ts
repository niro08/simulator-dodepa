import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'
import {
  abandonRun,
  applyProgress,
  buildHud,
  buildPendingEvent,
  buildStatement,
  buildUnderbelly,
  canExecute as coreCanExecute,
  createRun,
  defaultConfig,
  executeCommand,
  type ActionResult,
  type Command,
  type DaySummary,
  type EventOf,
  type GameEvent,
  type HudView,
  type LogEntry,
  type PendingEventView,
  type Profile,
  type Rejection,
  type RunPhase,
  type RunState,
  type Settings,
  type Statement,
  type UnderbellyView
} from '@/game'
import { CURRENT_SAVE_VERSION, createDefaultProfile, createDefaultSettings, loadSave, serializeSave, type SaveFile } from '@/game/save'
import { APP_VERSION, createPlatformStorage, randomSeed } from '@/platform'
import { useUiStore } from './ui'

export type SpinOutcome = { spin: EventOf<'spin'>; rejection?: undefined } | { spin?: undefined; rejection: Rejection }

/** Подписчик на события команд. state — состояние после команды. */
export type EventsListener = (events: readonly GameEvent[], state: { run: RunState | null; profile: Profile }) => void

/** Кнопки без параметров, доступность которых UI показывает постоянно (GDD §3.12: недоступная кнопка видима с причиной). */
export const ACTION_COMMANDS = {
  wake: { type: 'day/wake' },
  sleep: { type: 'day/sleep' },
  resume: { type: 'day/resume' },
  enterCasino: { type: 'casino/enter' },
  leaveCasino: { type: 'casino/leave' },
  spin: { type: 'slot/spin' },
  shift: { type: 'work/shift' },
  shady: { type: 'work/shady' },
  family: { type: 'family/help' },
  borrow: { type: 'friends/borrow' },
  bankLoan: { type: 'bank/loan' },
  mfoLoan: { type: 'mfo/loan' },
  payBill: { type: 'bills/pay' },
  deferBill: { type: 'bills/defer' },
  refuseBill: { type: 'bills/refuse' },
  quit: { type: 'run/quit' },
  extend: { type: 'run/extend' }
} as const satisfies Record<string, Command>

export type ActionKey = keyof typeof ACTION_COMMANDS
export type BetAdjust = 'half' | 'double' | 'min' | 'all'

/**
 * Стор игры — тонкая обёртка над чистым ядром (TD-06). Контракт для UI (CD-16/CD-17):
 *
 * Читать (всё реактивно):
 * - `hud: HudView | null` — Витрина и «Жизнь»: день/неделя, ⚡, кошелёк, баланс казино, долг (банк/МФО),
 *   ❤️, 🔥 + стадия, ставка, цена спина, вещи, бонус и вейджер, выводы «на рассмотрении», ближайший счёт
 *   (`bill.total`, `daysLeft`, `isToday`), развилка (`forkOpen`, `quitBlock`), превью смены/друзей, проценты за ночь.
 *   Во время анимации спина — снимок «до результата».
 * - `phase: RunPhase | null` — какой экран показывать (GDD §3.12): morning/event/day/bills/fork/daySummary/ended.
 * - `actions: Record<ActionKey, Rejection | null>` — доступность кнопок без параметров (null — можно; иначе причина →
 *   `formatRejection`). Для команд с параметрами (депозит, вывод, погашение, ломбард) — `canExecute(cmd)`.
 * - `pendingEvent` — карточка сна (id + доступность вариантов), `daySummary` — «Итог дня»,
 *   `underbelly: UnderbellyView | null` — Изнанка (RTP, LDW, near-miss, прогноз бонуса, долг, вещи, часы),
 *   `statement: Statement | null` — Выписка (когда ран закончен), `log` — хроника, `profile`, `settings`, `config`.
 * - `hasSave` — есть незаконченный ран («Продолжить» в меню).
 *
 * Менять:
 * - `execute(cmd)` — единственный путь изменить ран; `canExecute(cmd)` — та же проверка, что в ядре.
 * - `spin()` — спин: исход считается и сохраняется сразу, показ ждёт `revealPending()` после анимации.
 * - `setBet(value)`, `adjustBet('half' | 'double' | 'min' | 'all')` — ставка (нормализует ядро).
 * - `newGame()` — новый ран (активный засчитывается как брошенный); утро дня 1 наступает сразу.
 * - `trackTime(playSec, underbellySec)` — учёт активного времени (зовёт composables/usePlayTime).
 * - `updateSettings(patch)`, `load()`.
 * Подписки: `onEvents` — сразу после команды (статистика, аналитика), `onPresent` — когда можно показывать
 * (тосты, звук); для спина — после revealPending.
 * Сейв (ран + профиль одним файлом) пишется сразу после каждой команды — до анимации (B-04).
 */
export const useGameStore = defineStore('game', () => {
  const config = markRaw(defaultConfig)
  const storage = createPlatformStorage()
  const ui = useUiStore()

  const run = shallowRef<RunState | null>(null)
  const profile = shallowRef<Profile>(createDefaultProfile())
  const settings = shallowRef<Settings>(createDefaultSettings())
  const loaded = ref(false)
  /** Сейв из будущей версии игры: играть можно, сохранять — нет. */
  const readOnly = ref(false)
  const warnings = ref<string[]>([])

  const eventListeners = new Set<EventsListener>()
  const presentListeners = new Set<EventsListener>()

  /** Есть незаконченный ран. */
  const hasSave = computed(() => run.value !== null && run.value.phase !== 'ended')

  const hud = computed<HudView | null>(() => {
    if (ui.held) return ui.held.hud
    return run.value ? buildHud(run.value, config) : null
  })

  const phase = computed<RunPhase | null>(() => ui.held?.phase ?? run.value?.phase ?? null)

  const actions = computed(() => {
    const current = run.value
    const out = {} as Record<ActionKey, Rejection | null>
    for (const key of Object.keys(ACTION_COMMANDS) as ActionKey[]) {
      out[key] = current ? coreCanExecute(current, ACTION_COMMANDS[key], config) : { reason: 'wrong_phase' }
    }
    return out
  })

  const pendingEvent = computed<PendingEventView | null>(() => (run.value ? buildPendingEvent(run.value, config) : null))
  const daySummary = computed<DaySummary | null>(() => (run.value?.phase === 'daySummary' ? run.value.daySummary : null))
  const underbelly = computed<UnderbellyView | null>(() => (run.value ? buildUnderbelly(run.value, config) : null))
  const statement = computed<Statement | null>(() =>
    run.value?.phase === 'ended' ? buildStatement(run.value, profile.value, config) : null
  )

  const log = computed<LogEntry[]>(() => {
    const entries = run.value?.log ?? []
    const hidden = ui.held?.hiddenLogIds
    return hidden ? entries.filter((e) => !hidden.has(e.id)) : entries
  })

  function snapshot(): SaveFile {
    return {
      version: CURRENT_SAVE_VERSION,
      savedAt: Date.now(),
      build: APP_VERSION,
      run: run.value,
      profile: profile.value,
      settings: settings.value
    }
  }

  /** Записывает сейв. Для веба запись синхронна (до первого await внутри адаптера). */
  async function persist(): Promise<boolean> {
    if (readOnly.value) return false
    try {
      await storage.write(serializeSave(snapshot(), { now: Date.now(), build: APP_VERSION }))
      return true
    } catch (error) {
      console.warn('Не удалось сохранить игру', error)
      return false
    }
  }

  /** Загрузка: основной сейв → бэкап → legacy `dodepaSave` (миграции до v2) → пусто. */
  async function load() {
    const legacy = (await storage.readLegacy?.()) ?? null
    const outcome = loadSave(
      { main: await storage.read(), backup: await storage.readBackup(), legacy },
      { config, now: Date.now(), seed: randomSeed() }
    )
    run.value = outcome.save.run
    profile.value = outcome.save.profile
    settings.value = outcome.save.settings
    readOnly.value = outcome.readOnly
    warnings.value = outcome.warnings
    outcome.warnings.forEach((w) => console.warn(w))

    const written = outcome.needsWrite ? await persist() : false
    // Старый ключ удаляем только когда новый сейв точно лежит в основном слоте.
    if (legacy !== null && !outcome.readOnly && (outcome.source === 'main' || written)) {
      await storage.clearLegacy?.()
    }
    loaded.value = true
  }

  function notify(listeners: Set<EventsListener>, events: readonly GameEvent[]) {
    const state = { run: run.value, profile: profile.value }
    listeners.forEach((listener) => listener(events, state))
  }

  function applyResult(result: ActionResult) {
    const progressed = applyProgress(result.state, profile.value, result.events, config, Date.now())
    run.value = progressed.run
    profile.value = progressed.profile
    void persist()
    notify(eventListeners, result.events)
  }

  /** Выполняет команду через ядро, применяет и сохраняет. null — нет рана. */
  function execute(cmd: Command): ActionResult | null {
    if (!run.value) return null
    revealPending() // незавершённый показ спина — сначала показать
    const result = executeCommand(run.value, cmd, { config, now: Date.now() })
    applyResult(result)
    notify(presentListeners, result.events)
    return result
  }

  /** Причина, по которой команда сейчас недоступна, или null. */
  function canExecute(cmd: Command): Rejection | null {
    return run.value ? coreCanExecute(run.value, cmd, config) : { reason: 'wrong_phase' }
  }

  /**
   * Атомарный спин (ADR-001): результат считается, применяется и сохраняется сразу,
   * а показ (HUD, фаза, хроника, onPresent) откладывается до revealPending().
   * Если спин довёл тильт до 100, ночь уже прошла в ядре — экран сменится после показа.
   */
  function spin(): SpinOutcome | null {
    const before = run.value
    if (!before) return null
    revealPending()
    const result = executeCommand(before, { type: 'slot/spin' }, { config, now: Date.now() })
    const spinEvent = result.events.find((e): e is EventOf<'spin'> => e.type === 'spin')
    if (!result.ok || !spinEvent) {
      applyResult(result)
      notify(presentListeners, result.events)
      const rejected = result.events.find((e): e is EventOf<'rejected'> => e.type === 'rejected')
      return { rejection: rejected ?? { reason: 'no_money' } }
    }

    const beforeHud = buildHud(before, config)
    const hiddenLogIds = new Set(result.state.log.filter((e) => e.id >= before.nextLogId).map((e) => e.id))
    ui.hold({
      hud: {
        ...beforeHud,
        casino: before.casino - spinEvent.bet,
        energy: before.energy - spinEvent.energyCost
      },
      phase: before.phase,
      hiddenLogIds,
      events: result.events
    })
    applyResult(result)
    return { spin: spinEvent }
  }

  /** Конец анимации: показать отложенный результат. Безопасно вызывать повторно. */
  function revealPending() {
    const events = ui.release()
    if (events.length > 0) notify(presentListeners, events)
  }

  function setBet(value: number) {
    execute({ type: 'bet/set', value })
  }

  /** Кнопки ставки ½ / ×2 / MIN / ДОДЕП ВСЁ (GDD §3.5.4). Шаг и лимиты применяет ядро. */
  function adjustBet(kind: BetAdjust) {
    const current = run.value
    if (!current) return
    const B = config.balance
    const value =
      kind === 'half'
        ? Math.max(B.MIN_BET, Math.floor(current.bet / 2))
        : kind === 'double'
          ? current.bet * 2
          : kind === 'min'
            ? B.MIN_BET
            : current.casino
    setBet(value)
  }

  /** Новый ран: активный засчитывается как брошенный (systems-spec §6), утро дня 1 — сразу. */
  function newGame() {
    ui.release()
    const now = Date.now()
    if (run.value) profile.value = abandonRun(run.value, profile.value, config, now)
    const fresh = createRun(config, randomSeed(), now)
    const started: GameEvent[] = [{ type: 'runStarted', runId: fresh.id, seed: fresh.seed }]
    const progressed = applyProgress(fresh, profile.value, started, config, now)
    run.value = progressed.run
    profile.value = progressed.profile
    notify(eventListeners, started)
    notify(presentListeners, started)
    execute({ type: 'day/wake' })
  }

  /** Активное время игры (systems-spec §3.6): не больше TICK_MAX_SEC за вызов. */
  function trackTime(playSec: number, underbellySec = 0) {
    if (!run.value || readOnly.value) return
    const cap = config.stats.TICK_MAX_SEC
    const clampSec = (x: number) => Math.min(cap, Math.max(0, Math.floor(Number.isFinite(x) ? x : 0)))
    const event: GameEvent = { type: 'timeTracked', playSec: clampSec(playSec), underbellySec: clampSec(underbellySec) }
    if (event.playSec === 0 && event.underbellySec === 0) return
    const progressed = applyProgress(run.value, profile.value, [event], config, Date.now())
    run.value = progressed.run
    profile.value = progressed.profile
    void persist()
  }

  function updateSettings(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch }
    void persist()
  }

  function subscribe(set: Set<EventsListener>, listener: EventsListener): () => void {
    set.add(listener)
    return () => set.delete(listener)
  }

  return {
    config,
    run,
    profile,
    settings,
    loaded,
    readOnly,
    warnings,
    hasSave,
    hud,
    phase,
    actions,
    pendingEvent,
    daySummary,
    underbelly,
    statement,
    log,
    load,
    execute,
    canExecute,
    spin,
    revealPending,
    setBet,
    adjustBet,
    newGame,
    trackTime,
    updateSettings,
    onEvents: (listener: EventsListener) => subscribe(eventListeners, listener),
    onPresent: (listener: EventsListener) => subscribe(presentListeners, listener)
  }
})
