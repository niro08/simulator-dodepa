import { describe, expect, it } from 'vitest'
import {
  defaultConfig,
  ENDING_IDS,
  ITEM_IDS,
  SLEEP_EVENTS,
  type CommandType,
  type GameEvent,
  type RejectReason
} from '@/game'
import { STRATEGIES, playRun } from '@/game/strategies'
import * as ru from './ru'
import * as ui from './ui'
import {
  ALLOWLIST,
  foldHomoglyphs,
  isAllowlisted,
  normalize,
  PROMO_WHITELIST,
  scanBrands,
  scanLinks,
  type BrandHit,
  type LinkHit
} from './stoplist'

/**
 * QA-09 v2 (стоп-лист брендов) и QA-10 (ссылки, контакты, промокоды) по ВСЕМ строкам игрока:
 * рекурсивный обход экспортов src/i18n/ru.ts и src/i18n/ui.ts, строковые функции вызываются с фикстурами,
 * хроника — по событиям реальных ранов всех стратегий. Спецификация: production/qa-streamer-prequel.md §3.
 * Данные и матчеры — src/i18n/stoplist.ts. Старый узкий QA-09 остаётся в ru.test.ts.
 */

type Found = { path: string; text: string }

// ─── Фикстуры ──────────────────────────────────────────────────────────────

/** Представительный набор событий: реальные раны всех стратегий на нескольких сидах (со статистикой и ачивками). */
function sampleEvents(): GameEvent[] {
  const byKey = new Map<string, GameEvent>()
  for (const strategy of Object.values(STRATEGIES)) {
    for (let seed = 1; seed <= 3; seed++) {
      const { session } = playRun(strategy, seed, defaultConfig, true)
      for (const e of session.events) {
        // По одному событию на тип + ключевые поля, от которых ветвится текст.
        const key = JSON.stringify(e, (k, v) => (typeof v === 'number' && k !== 'choice' && k !== 'multiplier' ? 0 : v))
        if (!byKey.has(key)) byKey.set(key, e)
      }
    }
  }
  return [...byKey.values()]
}

const EVENTS = sampleEvents()

const COMMANDS: CommandType[] = [
  'day/wake', 'day/sleep', 'day/resume', 'event/choose', 'bills/pay', 'bills/defer', 'bills/refuse', 'run/quit', 'run/extend',
  'casino/enter', 'casino/leave', 'casino/deposit', 'casino/withdraw', 'bet/set', 'slot/spin', 'work/shift', 'work/shady', 'work/offer',
  'family/help', 'friends/borrow', 'bank/loan', 'mfo/loan', 'debt/repay', 'pawn/pawn', 'pawn/redeem'
]
const REASONS: RejectReason[] = [
  'wrong_phase', 'in_casino', 'not_in_casino', 'no_energy', 'no_money', 'bet_below_min', 'amount_below_min', 'invalid_amount',
  'bonus_locked', 'daily_limit', 'friends_blocked', 'no_phone', 'friends_broke', 'rep_too_low', 'debt_limit', 'no_debt',
  'item_not_owned', 'item_not_pawned', 'no_bill', 'not_due', 'grace_used', 'not_fork_day', 'bill_unpaid', 'has_debt', 'forced',
  'feature_disabled', 'no_event', 'option_unaffordable', 'blocked_by_mama' as RejectReason, 'no_offer'
]

const IDS = [...Object.keys(ru.ACHIEVEMENT_TEXTS), ...Object.keys(ru.COSMETIC_NAMES), 'unknown:id']
const SLEEP_VARS = { casino_balance: 12_345, amount: 400, item: 'laptop', net: -1250 }

/** Образцы аргументов по имени параметра. Неизвестное имя — число. Вызовы — «зип» по кругу, не декартово произведение. */
const SAMPLES: Record<string, readonly unknown[]> = {
  id: IDS,
  on: [true, false],
  iznanka: [true, false],
  endless: [false, true],
  isNew: [true, false],
  secret: [false, true],
  endlessWeek: [undefined, 6],
  forms: [['шаурма', 'шаурмы', 'шаурм']],
  stats: [defaultConfig.stats],
  config: [defaultConfig],
  endingId: ENDING_IDS,
  grade: ['A', 'B', 'C', null],
  cause: [
    { week: 1, deferred: true, graceUsed: true, fork: false },
    { week: 2, deferred: false, graceUsed: false, fork: false },
    { week: 4, deferred: false, graceUsed: false, fork: true }
  ],
  command: COMMANDS,
  rejection: REASONS.flatMap((reason) => [{ reason, min: 1000 }, { reason }]),
  view: SLEEP_EVENTS.map((e) => ({ eventId: e.id, vars: SLEEP_VARS })),
  vars: [SLEEP_VARS],
  template: ['{amount} · {item} · {net}'],
  variants: [['образец']],
  rewards: [['skin:clown'], [], ['theme:monday', 'title:unknown']],
  ts: [Date.UTC(2026, 8, 27)],
  // pct(x, digits): доли и число знаков после запятой.
  x: [0.08, 0.9, 1],
  digits: [0, 1],
  item: [...ITEM_IDS.map((i) => ru.ITEM_NAMES[i])],
  // Строковые параметры UI-функций: подставляем нейтральный образец.
  ...Object.fromEntries(
    ['title', 't', 'time', 'date', 'hint', 'apr', 'success', 'fail', 'chance', 'rate', 'feePct', 'actual', 'declared',
      'clearShare', 'banner', 'bill', 'a', 'g'].map((n) => [n, ['Образец']])
  )
}
const NUMBERS = [1234, 1, 0, 5, 21, -500, 12_345]

/**
 * Функции, которые обходятся не «по образцам», а специальными фикстурами (хроника по событиям).
 * Новая экспортная функция попадает в общий обход автоматически; если она не выдала ни одной строки — тест падает.
 */
const SPECIAL = new Set(['ru.formatEvent', 'ru.formatEventHonest', 'ru.formatSpinBanner', 'ru.eventTone'])

function paramNames(fn: Function): string[] {
  const src = fn.toString()
  const arrow = /^\s*(?:async\s*)?([\p{L}_$][\p{L}\p{N}_$]*)\s*=>/u.exec(src)
  if (arrow) return [arrow[1]!]
  const open = src.indexOf('(')
  if (open < 0) return []
  let depth = 0
  let end = open
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const inner = src.slice(open + 1, end)
  const parts: string[] = []
  let cur = ''
  depth = 0
  for (const ch of inner) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => p.split('=')[0]!.trim()).filter(Boolean)
}

function argSets(fn: Function): unknown[][] {
  const names = paramNames(fn)
  const pools = names.map((n) => SAMPLES[n] ?? NUMBERS)
  const count = Math.max(1, ...pools.map((p) => p.length))
  return Array.from({ length: count }, (_, k) => pools.map((p) => p[k % p.length]))
}

// ─── Обход ─────────────────────────────────────────────────────────────────

interface Collected {
  strings: Found[]
  /** Функции, которые не дали ни одной строки (все вызовы бросили или вернули не строку). */
  silent: string[]
}

function collect(value: unknown, path: string, out: Collected, seen: WeakSet<object>): void {
  if (typeof value === 'string') {
    out.strings.push({ path, text: value })
    return
  }
  if (typeof value === 'function') {
    if (SPECIAL.has(path)) return
    const before = out.strings.length
    argSets(value).forEach((args, k) => {
      let result: unknown
      try {
        result = (value as (...a: unknown[]) => unknown)(...args)
      } catch {
        return
      }
      collect(result, `${path}()#${k}`, out, seen)
    })
    if (out.strings.length === before) out.silent.push(path)
    return
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return
    seen.add(value)
    for (const [k, v] of Object.entries(value)) collect(v, `${path}.${k}`, out, seen)
  }
}

function collectAll(): Collected {
  const out: Collected = { strings: [], silent: [] }
  const seen = new WeakSet<object>()
  for (const [name, v] of Object.entries(ru)) collect(v, `ru.${name}`, out, seen)
  for (const [name, v] of Object.entries(ui)) collect(v, `ui.${name}`, out, seen)
  // Хроника, Изнанка, баннеры и тон — по событиям реальных ранов.
  EVENTS.forEach((event, i) => {
    for (let variant = 0; variant < 4; variant++) {
      out.strings.push({ path: `ru.formatEvent(${event.type}#${i},${variant})`, text: ru.formatEvent(event, variant) })
    }
    const honest = ru.formatEventHonest(event)
    if (honest !== null) out.strings.push({ path: `ru.formatEventHonest(${event.type}#${i})`, text: honest })
    if (event.type === 'spin') out.strings.push({ path: `ru.formatSpinBanner(#${i})`, text: ru.formatSpinBanner(event) })
  })
  // Явно: «Как играть» из конфига и тикер с долей бонуса (дублирует общий обход — на случай смены сигнатур).
  collect(ru.howToPlay(defaultConfig), 'ru.howToPlay(defaultConfig)', out, seen)
  collect(ui.tickerHonest(defaultConfig.stats), 'ui.tickerHonest(stats)', out, seen)
  return out
}

const ALL = collectAll()

// ─── Проверки ──────────────────────────────────────────────────────────────

function brandFailures(found: readonly Found[]): string[] {
  return found
    .filter((f) => !isAllowlisted(f.path, f.text))
    .flatMap((f) => scanBrands(f.text).filter((h) => h.fail).map((h) => fmtBrand(f, h)))
}

function brandReview(found: readonly Found[]): string[] {
  return found
    .filter((f) => !isAllowlisted(f.path, f.text))
    .flatMap((f) => scanBrands(f.text).filter((h) => !h.fail).map((h) => fmtBrand(f, h)))
}

function linkHits(found: readonly Found[], fail: boolean): string[] {
  return found
    .filter((f) => !isAllowlisted(f.path, f.text))
    .flatMap((f) => scanLinks(f.text).filter((h) => h.fail === fail).map((h) => fmtLink(f, h)))
}

const fmtBrand = (f: Found, h: BrandHit) => `${f.path}: [${h.level}/${h.category}] «${h.match}» в «${f.text.slice(0, 120)}»`
const fmtLink = (f: Found, h: LinkHit) => `${f.path}: [${h.rule}] «${h.match}» в «${f.text.slice(0, 120)}»`

/**
 * Вставка слова в реальную строку игры. Возвращает только изменённую строку: остальные строки чистые
 * (это проверяет основной тест), а полный пересчёт на каждую инъекцию стоит десятки секунд.
 */
function inject(word: string): Found[] {
  const base = ALL.strings.find((f) => f.path.startsWith('ui.TICKER_SHOWCASE.'))!
  return [{ path: `${base.path}+inject`, text: `${base.text} ${word}` }]
}

describe('QA-09 v2 / QA-10: сбор строк игрока', () => {
  it('обход покрывает ru.ts, ui.ts, ачивки, карточки сна, концовки, хронику и «Как играть»', () => {
    const paths = ALL.strings.map((f) => f.path)
    expect(ALL.strings.length).toBeGreaterThan(1500)
    for (const prefix of [
      'ru.ACHIEVEMENT_TEXTS.',
      'ru.SLEEP_EVENT_TEXTS.',
      'ru.ENDINGS.',
      'ru.QUIT_GRADES.',
      'ru.formatEvent(',
      'ru.formatEventHonest(',
      'ru.formatSpinBanner(',
      'ru.howToPlay(defaultConfig)',
      'ru.formatRejection()',
      'ru.formatSleepEventCard()',
      'ui.TICKER_SHOWCASE.',
      'ui.TICKER_HONEST.',
      'ui.HELP_LINK.url',
      'ui.BANNERS.',
      'ui.MENU.continueSub()'
    ]) {
      expect(paths.some((p) => p.startsWith(prefix)), prefix).toBe(true)
    }
  })

  it('каждая экспортная функция выдала хотя бы одну строку (иначе — новые фикстуры в SAMPLES)', () => {
    expect(ALL.silent).toEqual([])
  })

  it('события: хроника построена по всем основным типам', () => {
    const types = new Set(EVENTS.map((e) => e.type))
    for (const t of ['spin', 'deposit', 'loanTaken', 'billPaid', 'sleepEventResolved', 'runEnded', 'achievementUnlocked'] as const) {
      expect(types.has(t), t).toBe(true)
    }
  })
})

describe('QA-09 v2: стоп-лист брендов по всем строкам', () => {
  it('нет брендов уровней A, B, связок «X казино» и C с кавычками/заглавной у контекста', () => {
    expect(brandFailures(ALL.strings)).toEqual([])
  })

  it('отчёт уровня C (омонимы) — только печать, решает ревью §4', () => {
    const review = [...new Set(brandReview(ALL.strings))]
    if (review.length > 0) console.info(`QA-09 C-отчёт (${review.length}):\n${review.join('\n')}`)
    expect(Array.isArray(review)).toBe(true)
  })

  it('allowlist работает по пути И точному значению', () => {
    for (const a of ALLOWLIST) {
      const f = ALL.strings.find((s) => s.path === a.path)
      expect(f?.text, a.path).toBe(a.value)
    }
    expect(isAllowlisted('ui.HELP_LINK.url', 'https://www.gamblersanonymous.org/')).toBe(true)
    expect(isAllowlisted('ui.HELP_LINK.url', 'https://twitch.tv/')).toBe(false)
    expect(isAllowlisted('ui.SITE.address', 'https://www.gamblersanonymous.org/')).toBe(false)
  })
})

describe('QA-09 v2: мета-тест матчера (§3.2 — обязателен)', () => {
  it.each(['Twitch', 'Твич', 'тwitch', 'Тwitch', 'Donation Alerts', 'DonationAlerts', '1хбет', '1 x bet', 'Быстроденьги', 'БЫСТРОДЕНЬГИ',
    'быстроДЕНЬГИ', 'https://kick.com', 'Твитч', 'YouTube', 'Ютуб', 'твич­стрим', 'tw​itch', 'Азино777', 'Pin-Up', 'пин-ап',
    'Сбер', 'ВТБ', 'Red Bull', 'Лига Ставок', 'Вулкан казино', 'казино «Вулкан»', 'Gates of Olympus', 'Мёллстрой'])(
    'вставка «%s» в строку игры ловится',
    (word) => {
      const failures = brandFailures(inject(word))
      expect(failures.length, word).toBeGreaterThan(0)
      expect(failures.every((f) => f.includes('+inject'))).toBe(true)
    }
  )

  it('границы слова по \\p{L}, не \\b: обычные слова не ловятся', () => {
    for (const ok of ['сбережения', 'бустить', 'бустил', 'казино', 'kicker', 'книга радости', 'драйв мимо', 'ловк видео', 'бустеры',
      'стейкхолдер', 'киви-фрукт', 'Олимпиада', 'бернский', 'обезьянки лезут', 'кикбоксинг', 'донат-алерт', '888 рублей']) {
      expect(scanBrands(ok).filter((h) => h.fail), ok).toEqual([])
    }
    expect(scanBrands('кик из чата').filter((h) => h.fail)).toEqual([])
    expect(scanBrands('кик из чата').some((h) => h.level === 'C')).toBe(true)
  })

  it('C: омоним падает только в «ёлочках» или с заглавной рядом с контекстом', () => {
    expect(scanBrands('монстр под кроватью').some((h) => h.fail)).toBe(false)
    expect(scanBrands('«Монстр» — энергетик чемпионов').some((h) => h.fail)).toBe(true)
    expect(scanBrands('Олимп ставок нет, есть казино').some((h) => h.fail)).toBe(true)
    expect(scanBrands('олимп страстей, казино рядом').some((h) => h.fail)).toBe(false)
  })

  it('нормализация: регистр, ё→е, невидимые символы, гомоглифы кириллица→латиница', () => {
    expect(normalize('ЁЛКА­​')).toBe('елка')
    expect(foldHomoglyphs(normalize('Тwitch'))).toBe('twitch')
    expect(foldHomoglyphs('рокер')).toBe('pokep')
  })
})

describe('QA-10: ссылки, телефоны, промокоды', () => {
  it('в строках игры нет URL/доменов/хэндлов/e-mail/телефонов/чужих промокодов (кроме ссылки помощи)', () => {
    expect(linkHits(ALL.strings, true)).toEqual([])
  })

  it('единственный URL — ссылка помощи из allowlist', () => {
    const urls = ALL.strings.filter((f) => scanLinks(f.text).some((h) => h.rule === 'url'))
    expect(urls.map((f) => f.path)).toEqual(['ui.HELP_LINK.url'])
  })

  it('CTA (QR, «ссылка в описании») — отчёт уровня C, не провал', () => {
    const cta = [...new Set(linkHits(ALL.strings, false))]
    if (cta.length > 0) console.info(`QA-10 CTA-отчёт (${cta.length}):\n${cta.join('\n')}`)
    expect(Array.isArray(cta)).toBe(true)
  })

  it('мета: инъекции ловятся', () => {
    const bad = [
      'https://kick.com', 'заходи на www.example.org', 't.me/dodep', 'dodep.ru', 'додеп.рф', 'casino.bet', 'пиши @streamer_pro',
      'почта help@dodep.ru', 'звони +7 (999) 123-45-67', '8-800-555-35-35', '8 800 555 35 35', 'промокод ХАЛЯВА500', 'Промо: FREEBET'
    ]
    for (const text of bad) {
      const failures = linkHits(inject(text), true)
      expect(failures.length, text).toBeGreaterThan(0)
      expect(failures.every((f) => f.includes('+inject')), text).toBe(true)
    }
  })

  it('мета: разрешённое не ловится', () => {
    const ok = [
      'додеп-зеркало-47.нет', 'по приглашению от @жирный_кот_42', ...PROMO_WHITELIST.map((c) => `промокод ${c}`),
      'Ставка 1 234₽, баланс 12 345₽', 'День 36 · неделя 6', 'код 1234'
    ]
    for (const text of ok) expect(scanLinks(text).filter((h) => h.fail), text).toEqual([])
  })
})
