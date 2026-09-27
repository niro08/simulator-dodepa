/**
 * GOLD-01 / AC-F1 (production/qa-streamer-prequel.md §2, streamer-prequel-tech-risks.md §4 п.4, R-01):
 * golden-снимок базового рана — страховка до любых правок ядра под режим «Стример».
 *
 * 20 сидов × 3 бота (честный, лудоман из strategies.ts и детерминированный «случайный») прогоняются через
 * настоящее ядро (testing.ts: executeCommand → applyProgress, как стор) до концовки/развилки. От каждого рана
 * берём SHA-256 канонического JSON финального RunState и журнала событий сессии и сверяем с golden-файлом.
 *
 * Поля будущего режима `mode` и `streamer` (GDD-S §3.1) из хэша выкидываются, если они есть: их появление
 * со значениями 'base'/null — ожидаемая правка, а не дрейф базового рана. Всё остальное должно совпасть бит в бит.
 *
 * Перегенерация golden-файла (только осознанно: изменение базового рана = изменение баланса/поведения):
 *   GOLDEN_UPDATE=1 npx vitest run src/game/golden-base.test.ts
 * Затем закоммитить src/game/golden-base.fixture.json и объяснить в PR, почему базовый ран поменялся.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ITEM_IDS } from './config'
import { findSleepEvent } from './day'
import { createRng } from './rng'
import { casinoSession, playRun, STRATEGIES, type Strategy } from './strategies'
import { tryExec, type Session } from './testing'

const FIXTURE_PATH = fileURLToPath(new URL('./golden-base.fixture.json', import.meta.url))
const UPDATE = process.env.GOLDEN_UPDATE === '1'

/** Сиды 1…20. Меняются только вместе с перегенерацией golden-файла. */
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1)

/** Ключи будущего режима, которые не участвуют в хэше (AC-F1 в новой формулировке). */
const EXCLUDED_KEYS: ReadonlySet<string> = new Set(['mode', 'streamer'])

/**
 * Канонический JSON: ключи объектов отсортированы, undefined выпадает (как в JSON.stringify).
 * На верхнем уровне объекта (RunState, событие) отбрасываются EXCLUDED_KEYS.
 */
function canonicalJson(value: unknown, dropTopLevel: ReadonlySet<string> = EXCLUDED_KEYS): string {
  const walk = (v: unknown, top: boolean): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x, false))
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(v).sort()) {
        if (top && dropTopLevel.has(key)) continue
        out[key] = walk((v as Record<string, unknown>)[key], false)
      }
      return out
    }
    return v
  }
  return JSON.stringify(walk(value, true)) ?? 'undefined'
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

/** Хэш журнала: каждое событие канонизируется отдельно (поля режима отбрасываются и у событий). */
function hashEvents(events: readonly unknown[]): string {
  return sha256(events.map((e) => canonicalJson(e)).join('\n'))
}

// ─── «Случайный» бот ─────────────────────────────────────────────────────────────
// Своя mulberry32 от сида бота, НЕ run.rngState: ядро видит только команды, как от живого игрока.
// Покрывает команды, до которых честный и лудоман не доходят (темка, ломбард/выкуп, вывод, займы, произвольные ставки).

const RANDOM_BOT_SALT = 0x9e3779b9
const RANDOM_BETS = [50, 100, 200, 500, 1000]

function randomStrategy(seed: number): Strategy {
  const rng = createRng((seed ^ RANDOM_BOT_SALT) >>> 0)
  const actions: ((s: Session) => void)[] = [
    (s) => void tryExec(s, { type: 'work/shift' }),
    (s) => void tryExec(s, { type: 'work/shady' }),
    (s) => void tryExec(s, { type: 'family/help' }),
    (s) => void tryExec(s, { type: 'friends/borrow' }),
    (s) => void tryExec(s, { type: 'bank/loan' }),
    (s) => void tryExec(s, { type: 'mfo/loan' }),
    (s) => void tryExec(s, { type: 'debt/repay', amount: Math.max(1, Math.floor(s.run.wallet * rng.next())) }),
    (s) => void tryExec(s, { type: 'pawn/pawn', item: rng.pick(ITEM_IDS) }),
    (s) => void tryExec(s, { type: 'pawn/redeem', item: rng.pick(ITEM_IDS) }),
    (s) => void tryExec(s, { type: 'casino/withdraw', amount: Math.max(1, Math.floor(s.run.casino * rng.next())) }),
    (s) =>
      casinoSession(s, {
        bet: rng.pick(RANDOM_BETS),
        budget: Math.floor(s.run.wallet * rng.next()),
        bonus: rng.next() < 0.5,
        maxSpins: rng.int(1, 30)
      })
  ]
  return {
    day(s) {
      // Смена почти всегда: иначе бот умирает от коллекторов к 8-му дню и не доходит до поздних недель
      if (rng.next() < 0.8) tryExec(s, { type: 'work/shift' })
      const n = rng.int(0, 5)
      for (let i = 0; i < n && s.run.phase === 'day'; i++) rng.pick(actions)(s)
    },
    event(s) {
      const def = findSleepEvent(s.config, s.run.pendingEventId ?? '')
      return def ? rng.int(0, def.options.length - 1) : 1
    }
  }
}

const BOTS: Record<string, (seed: number) => Strategy> = {
  honest: () => STRATEGIES.honest,
  ludoman: () => STRATEGIES.ludoman,
  random: randomStrategy
}

interface GoldenEntry {
  /** Для читаемого диффа: чем кончился ран. */
  outcome: string
  day: number
  phase: string
  events: number
  runHash: string
  eventsHash: string
}

function snapshot(bot: string, seed: number): GoldenEntry {
  // progress=true: события идут через applyProgress, как в сторе (статистика, ачивки, timeTracked)
  const { outcome, session } = playRun(BOTS[bot]!(seed), seed, undefined, true)
  return {
    outcome,
    day: session.run.day,
    phase: session.run.phase,
    events: session.events.length,
    runHash: sha256(canonicalJson(session.run)),
    eventsHash: hashEvents(session.events)
  }
}

function computeAll(): Record<string, GoldenEntry> {
  const out: Record<string, GoldenEntry> = {}
  for (const bot of Object.keys(BOTS)) for (const seed of SEEDS) out[`${bot}#${seed}`] = snapshot(bot, seed)
  return out
}

describe('GOLD-01: golden-снимок базового рана (AC-F1)', () => {
  it('canonicalJson отбрасывает mode/streamer только на верхнем уровне и не зависит от порядка ключей', () => {
    const base = { b: 1, a: { mode: 'x', c: [1, { z: 2, y: 3 }] } }
    const withMode = { mode: 'base', streamer: null, a: { c: [1, { y: 3, z: 2 }], mode: 'x' }, b: 1 }
    expect(canonicalJson(withMode)).toBe(canonicalJson(base))
    expect(canonicalJson({ a: { mode: 'x' } })).not.toBe(canonicalJson({ a: {} }))
  })

  it('прогон детерминирован: повтор даёт те же хэши', () => {
    expect(snapshot('random', 7)).toEqual(snapshot('random', 7))
  })

  it('20 сидов × 3 бота совпадают с golden-файлом', () => {
    const actual = computeAll()
    if (UPDATE) {
      writeFileSync(FIXTURE_PATH, JSON.stringify(actual, null, 2) + '\n', 'utf-8')
      return
    }
    expect(existsSync(FIXTURE_PATH), 'нет golden-файла: GOLDEN_UPDATE=1 npx vitest run src/game/golden-base.test.ts').toBe(true)
    const expected = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as Record<string, GoldenEntry>
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort())
    for (const key of Object.keys(expected)) {
      expect(actual[key], `базовый ран ${key} разошёлся с golden-файлом`).toEqual(expected[key])
    }
  })

  it('боты покрывают разные исходы (golden-набор не вырожден)', () => {
    const expected = existsSync(FIXTURE_PATH)
      ? (JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as Record<string, GoldenEntry>)
      : computeAll()
    const outcomes = new Set(Object.values(expected).map((e) => e.outcome))
    expect(outcomes.size).toBeGreaterThanOrEqual(3)
  })
})
