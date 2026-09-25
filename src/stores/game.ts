import { defineStore } from 'pinia'
import { computed, markRaw, ref, shallowRef } from 'vue'
import {
  applyProgress,
  canExecute as coreCanExecute,
  createRun,
  defaultConfig,
  executeCommand,
  type ActionResult,
  type Command,
  type EventOf,
  type GameEvent,
  type LogEntry,
  type Profile,
  type Rejection,
  type RunState,
  type Settings
} from '@/game'
import { createDefaultProfile, createDefaultSettings, loadSave, serializeSave, type SaveFile } from '@/game/save'
import { APP_VERSION, createPlatformStorage, randomSeed } from '@/platform'
import { useUiStore } from './ui'

/** То, что показывает UI: ресурсы с учётом презентационной задержки спина. */
export interface GameView {
  money: number
  energy: number
  reputation: number
  debt: number
  bet: number
}

export type SpinOutcome = { spin: EventOf<'spin'>; rejection?: undefined } | { spin?: undefined; rejection: Rejection }

/** Подписчик на события команд. state — состояние после команды. */
export type EventsListener = (events: readonly GameEvent[], state: { run: RunState | null; profile: Profile }) => void

/**
 * Стор игры — тонкая обёртка над чистым ядром (TD-06).
 *
 * Контракт для UI:
 * - читать: `view` (ресурсы для показа), `log` (хроника), `run`/`profile`/`settings`, `config`, `hasSave`;
 * - проверять: `canExecute(cmd)` → причина отказа или null (для disabled и подсказок);
 * - менять: `execute(cmd)` — единственный путь изменить забег; `spin()` — спин с задержкой показа,
 *   после анимации обязательно `revealPending()`; `setBet`, `newGame`, `updateSettings`;
 * - подписываться: `onEvents` — сразу после команды (логика: статистика, аналитика),
 *   `onPresent` — когда результат можно показывать (тосты, звук); для спина — после revealPending.
 * Сейв пишется сразу после каждой команды (до анимации — спин атомарен, B-04).
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

  const hasSave = computed(() => run.value !== null)

  const view = computed<GameView>(() => {
    const current = run.value
    if (!current) return { ...config.balance.start }
    const held = ui.held
    return { ...pickView(current), ...(held ? held.resources : {}) }
  })

  const log = computed<LogEntry[]>(() => {
    const entries = run.value?.log ?? []
    const hidden = ui.held?.hiddenLogIds
    return hidden ? entries.filter((e) => !hidden.has(e.id)) : entries
  })

  function snapshot(): SaveFile {
    return {
      version: 1,
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

  /** Загрузка: основной сейв → бэкап → legacy `dodepaSave` (миграция v0 → v1) → пусто. */
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
    // Старый ключ удаляем только когда v1 точно лежит в основном слоте.
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
    const progressed = applyProgress(result.state, profile.value, result.events, config)
    run.value = progressed.run
    profile.value = progressed.profile
    void persist()
    notify(eventListeners, result.events)
  }

  /** Выполняет команду через ядро, применяет и сохраняет. null — нет активного забега. */
  function execute(cmd: Command): ActionResult | null {
    if (!run.value) return null
    const result = executeCommand(run.value, cmd, { config, now: Date.now() })
    applyResult(result)
    notify(presentListeners, result.events)
    return result
  }

  /** Причина, по которой команда сейчас недоступна, или null. */
  function canExecute(cmd: Command): Rejection | null {
    return run.value ? coreCanExecute(run.value, cmd, config) : null
  }

  /**
   * Атомарный спин (ADR-001): результат считается, применяется и сохраняется сразу,
   * а показ (ресурсы, хроника, onPresent) откладывается до revealPending().
   */
  function spin(): SpinOutcome | null {
    const before = run.value
    if (!before) return null
    const result = executeCommand(before, { type: 'slot/spin' }, { config, now: Date.now() })
    const spinEvent = result.events.find((e): e is EventOf<'spin'> => e.type === 'spin')
    if (!result.ok || !spinEvent) {
      applyResult(result)
      notify(presentListeners, result.events)
      const rejected = result.events.find((e): e is EventOf<'rejected'> => e.type === 'rejected')
      return { rejection: rejected ?? { reason: 'noMoney' } }
    }

    const hiddenLogIds = new Set(result.state.log.filter((e) => e.id >= before.nextLogId).map((e) => e.id))
    ui.hold({
      resources: { ...pickView(before), money: before.money - before.bet },
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

  /** Новый забег (прогресс забега сбрасывается, профиль сохраняется). */
  function newGame() {
    ui.release()
    run.value = createRun(config, randomSeed(), Date.now())
    void persist()
    const events: GameEvent[] = [{ type: 'runStarted' }]
    notify(eventListeners, events)
    notify(presentListeners, events)
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
    view,
    log,
    load,
    execute,
    canExecute,
    spin,
    revealPending,
    setBet,
    newGame,
    updateSettings,
    onEvents: (listener: EventsListener) => subscribe(eventListeners, listener),
    onPresent: (listener: EventsListener) => subscribe(presentListeners, listener)
  }
})

function pickView(run: RunState): GameView {
  return { money: run.money, energy: run.energy, reputation: run.reputation, debt: run.debt, bet: run.bet }
}
