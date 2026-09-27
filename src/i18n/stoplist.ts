/**
 * QA-09 v2 / QA-10: стоп-лист реальных брендов и гард ссылок, контактов и промокодов.
 * Спецификация: production/qa-streamer-prequel.md §3 (ветка design/streamer-prequel).
 *
 * Здесь данные и чистые функции проверки: их использует src/i18n/stoplist.test.ts,
 * позже — генератор ников (QA-12, denylist §3.3 п.8).
 *
 * Уровни:
 *  - A — подстрока после нормализации (+ свёртка гомоглифов и склейка латиницы). Совпадение — тест падает.
 *  - B — по границе слова: `(?<![\p{L}\p{N}_])токен(?![\p{L}\p{N}_])`, флаг `u`. Совпадение — тест падает.
 *    `\b` в JS видит только ASCII даже с флагом `u`, для кириллицы он бесполезен.
 *  - C — омонимы: совпадение по границе слова только печатается в отчёт. Падает, если токен в «ёлочках»
 *    или с заглавной буквы И в той же строке есть слово-контекст (казино / бет / слот / займ / энергетик / стрим).
 *
 * Пополняют writer и qa-lead. Токены пишутся в нижнем регистре, `ё` — как `е`.
 */

// ─── Списки (§3.3, черновик v1) ────────────────────────────────────────────

export type StopCategory =
  | 'platforms'
  | 'donations'
  | 'casinos'
  | 'bookmakers'
  | 'slots'
  | 'finance'
  | 'energy'
  | 'people'

export interface StopLevels {
  readonly A: readonly string[]
  readonly B: readonly string[]
  readonly C: readonly string[]
}

export const STOPLIST: Readonly<Record<StopCategory, StopLevels>> = {
  /** 1. Стрим-платформы, соцсети, мессенджеры, стрим-софт. */
  platforms: {
    A: [
      'twitch', 'твич', 'твитч', 'kick.com', 'kick стрим',
      'youtube', 'youtu.be', 'ютуб', 'ютьюб', 'ютюб', 'tiktok', 'тикток', 'тик-ток', 'тик ток',
      'trovo', 'трово', 'rutube', 'рутуб', 'goodgame', 'гудгейм', 'wasd.tv', 'васд',
      'vkplay', 'вконтакте', 'vkontakte', 'vk.com',
      'nuum', 'нуум', 'facebook', 'фейсбук', 'instagram', 'инстаграм', 'twitter', 'твиттер',
      'dlive', 'nimo tv', 'bigo live', 'picarto', 'likee',
      'telegram', 'телеграм', 'whatsapp', 'ватсап', 'вотсап', 'discord', 'дискорд', 'одноклассники',
      'streamlabs', 'стримлабс', 'restream', 'obs studio'
    ],
    B: [
      'kick', 'wasd', 'x.com', 'ok.ru', 'rumble', 'nimo', 'bigo',
      // Короткие составные: «вк видео» не должно ловиться внутри «ловк видео».
      'vk play', 'вк плей', 'vk видео', 'vk video', 'vk live', 'вк видео', 'вк лайв'
    ],
    C: ['кик', 'dzen', 'дзен', 'телега', 'obs']
  },

  /** 2. Донаты и монетизация. Общее «донат-алерт» — термин GDD-S, не бренд. */
  donations: {
    A: [
      'donationalerts', 'donation alerts', 'донейшн алертс', 'донейшналертс', 'донатион алертс',
      'donatty', 'донатти', 'donatepay', 'донатпей', 'streamelements', 'memealerts', 'мемалертс', 'donatello',
      'boosty', 'patreon', 'патреон', 'buymeacoffee', 'buy me a coffee', 'tipeee', 'sponsr',
      'cloudtips', 'клаудтипс', 'vk donut',
      'yoomoney', 'юmoney', 'юмани', 'яндекс.деньги', 'яндекс деньги', 'qiwi', 'webmoney', 'вебмани',
      'paypal', 'пейпал'
    ],
    // «бусти» — B, а не A (отклонение от §3.3): подстрокой сидит в «бустить», «бустил».
    B: ['бусти', 'ko-fi'],
    C: ['вк донат', 'tribute', 'киви']
  },

  /** 3. Онлайн-казино и крипто-казино. Имена «только в связке с казино» — в CASINO_COMBO ниже. */
  casinos: {
    A: [
      'stake.com', 'roobet', 'rollbit', 'bc.game', 'bcgame', 'gamdom', 'duelbits',
      'azino', 'азино7', 'joycasino', 'джойказино', 'vavada', 'вавада',
      'pin-up', 'pinup', 'пин-ап', 'пинап', 'riobet', 'риобет', 'gizbo', 'гизбо', 'starda', 'старда',
      'legzo', 'легзо',
      '888casino', '888 казино', 'leovegas', 'casumo', 'pokerstars', 'покерстарс', 'ggpoker'
    ],
    // «азино» — B, а не A (отклонение от §3.3): подстрокой сидит в слове «казино».
    // «Азино777» ловится A-токеном «азино7».
    B: ['азино', 'stake', 'izzi', 'иззи', 'mr green', 'casino x', 'казино икс'],
    C: ['стейк']
  },

  /** 4. Букмекеры. */
  bookmakers: {
    A: [
      '1xbet', '1хбет', '1xставка', '1хставка', 'ван икс бет', 'mostbet', 'мостбет', 'melbet', 'мелбет',
      'leonbets', 'леонбетс', 'fonbet', 'фонбет', 'winline', 'винлайн', 'betboom', 'бетбум',
      'parimatch', 'париматч', 'лига ставок', 'ligastavok', 'marathonbet', 'марафонбет', 'olimpbet', 'олимпбет',
      'betcity', 'бетсити', 'tennisi', 'теннизи', 'baltbet', 'балтбет', 'zenitbet', 'зенитбет',
      'bet365', 'william hill', 'williamhill', 'unibet', 'betway', 'draftkings', 'fanduel'
    ],
    B: ['bwin'],
    C: ['леон', 'пари', 'марафон', 'олимп']
  },

  /** 5. Слоты, провайдеры, crash-игры. Пародии («Сладкое Банкротство», «Книга Долгов») — не бренды. */
  slots: {
    A: [
      'pragmatic play', 'прагматик', 'gates of olympus', 'гейтс оф олимпус', 'врата олимпа',
      'sweet bonanza', 'свит бонанза', 'sugar rush', 'шугар раш', 'the dog house', 'дог хаус', 'big bass bonanza',
      'book of dead', 'starburst', 'старберст', 'mega moolah', "gonzo's quest", 'gonzos quest',
      'wanted dead or a wild', 'le bandit',
      'crazy monkey', 'крейзи манки', 'igrosoft', 'игрософт', 'novomatic', 'новоматик', 'netent',
      "play'n go", 'playngo', 'evolution gaming', 'spribe', 'hacksaw', 'nolimit city',
      'lucky jet', 'лаки джет', 'crazy time', 'крейзи тайм'
    ],
    // «книга ра» — B: подстрокой сидит в «книга радости».
    B: ['book of ra', 'книга ра'],
    C: ['big bass', 'книга мертвых', 'обезьянки', 'aviator', 'авиатор', 'plinko', 'плинко']
  },

  /** 6. МФО, банки, крипто (контекст спонсора «МФО»). */
  finance: {
    A: [
      // Действующая МФО. Спонсор #2 уже переименован в «Бесплатные деньги… ну почти» (976c4a4).
      'быстроденьги', 'bystrodengi', 'bistrodengi',
      'займер', 'zaymer', 'манимен', 'мани мэн', 'moneyman', 'екапуста', 'ekapusta', 'вебанкир', 'webbankir',
      'лайм-займ', 'лайм займ', 'lime-zaim', 'турбозайм', 'turbozaim', 'монеза', 'moneza', 'kviku', 'квику',
      'joymoney', 'джоймани', 'мигкредит', 'migcredit', 'смсфинанс', 'smsfinance', 'vivus', 'вивус',
      'займиго', 'zaymigo', 'oneclickmoney', 'kredito24', 'кредито24',
      'сбербанк', 'sberbank', 'тинькофф', 'tinkoff', 'альфа-банк', 'alfa-bank', 'почта банк', 'газпромбанк',
      'binance', 'бинанс', 'bybit', 'байбит', 'coinbase'
    ],
    B: ['сбер', 'втб', 'vtb', 'т-банк', 'tbank', 'usdt', 'tether'],
    C: ['честное слово', 'домашние деньги', 'деньги сразу', 'константа', 'халва']
  },

  /** 7. Энергетики (контекст «Бодрячка»). */
  energy: {
    A: [
      'red bull', 'redbull', 'ред булл', 'редбулл', 'monster energy', 'монстр энерджи',
      'adrenaline rush', 'адреналин раш', 'lit energy', 'rockstar energy', 'hell energy', 'black monster',
      'tornado energy'
    ],
    // Короткие двусловные — B: «драйв ми» не должно ловиться внутри «драйв мимо».
    B: ['flash up', 'флэш ап', 'флеш ап', 'drive me', 'драйв ми', 'burn'],
    C: ['монстр', 'берн', 'торнадо', 'gorilla', 'горилла', 'jaguar', 'ягуар', 'volt', 'e-on']
  },

  /**
   * 8. Реальные люди: ники, которые узнаются как конкретный человек. Список НЕ утверждает связь этих людей
   * с казино — он нужен, чтобы генератор и writer их не выдали.
   * TODO(writer): автор ролика-референса «Фрукти Пупс» (VIS: людей из ролика не берём), RU/глобальные стримеры.
   */
  people: {
    A: ['trainwreckstv', 'roshtein', 'adin ross', 'mellstroy', 'меллстрой', 'evelone', 'эвелон'],
    // «бустер» — B (отклонение от §3.3, там без уровня): обычное слово, но не внутри «бустеры» и т. п.
    B: ['xqc', 'buster', 'бустер'],
    C: ['zloy', 'злой', 'вован']
  }
}

/**
 * Казино, которые банятся только в связке «X казино / казино X / X casino» (A по связке, иначе — C).
 */
export const CASINO_COMBO: readonly string[] = [
  'vulkan', 'вулкан', 'cat', 'kent', 'кент', 'sol', 'сол', 'jet', 'джет', 'fresh', 'фреш', 'drip',
  'monro', 'монро', 'rox', 'volna', 'волна', 'daddy', 'kometa', 'комета', 'r7', 'irwin', 'ирвин',
  'lex', 'gama', 'гама', 'эльдорадо', 'joy', 'джой', 'selector', 'селектор'
]

/** Слова-контекст для уровня C (основы; ловятся как начало слова). */
export const C_CONTEXT = ['казино', 'casino', 'бет', 'слот', 'займ', 'энергетик', 'стрим'] as const

// ─── Allowlist (§3.2): по пути ключа И точному значению ────────────────────

export interface AllowEntry {
  /** Путь строки в обходе теста: `ui.HELP_LINK.url`. */
  readonly path: string
  /** Точное значение. Изменили строку — allowlist перестаёт действовать, гарды снова проверяют её. */
  readonly value: string
  readonly why: string
}

export const ALLOWLIST: readonly AllowEntry[] = [
  {
    path: 'ui.HELP_LINK.url',
    value: 'https://www.gamblersanonymous.org/',
    why: 'Анонимные Игроки — реальная организация помощи. Ссылка нужна и правильна.'
  },
  {
    path: 'ui.HELP_LINK.text',
    value: 'Анонимные Игроки — группы поддержки',
    why: 'Подпись к ссылке помощи.'
  }
]

/** Внутриигровые (выдуманные) промокоды. Всё остальное в верхнем регистре после «промокод/код» — провал QA-10. */
export const PROMO_WHITELIST: readonly string[] = [
  'ДОДЕП',
  'НЕСГОРИТ',
  'ДОЛГ_НАВСЕГДА',
  // ui.TICKER_SHOWCASE[37] «Се***а: промокод ЛОВИФРИБЕТ» — выдуманный код реферала из ленты «побед» (сатира,
  // пара в TICKER_HONEST[37]). Реальным промокодом не проверялся (нет сети) — см. отчёт П-05.
  'ЛОВИФРИБЕТ'
]

/** Разрешённая доменная зона (выдуманная, §5 про делегирование зоны). Остальные зоны ловит DOMAIN_RE. */
export const ALLOWED_ZONE = '.нет'

// ─── Нормализация (§3.2) ───────────────────────────────────────────────────

const INVISIBLE = /[­​-‍⁠﻿]/g

/** NFKC → `ё→е` → удалить мягкий перенос и нулевые пробелы. Регистр сохраняется (нужен уровню C и QA-10). */
export function normalizeKeepCase(s: string): string {
  return s.normalize('NFKC').replace(/ё/g, 'е').replace(/Ё/g, 'Е').replace(INVISIBLE, '')
}

/** NFKC → нижний регистр → `ё→е` → удалить невидимые символы. */
export function normalize(s: string): string {
  return normalizeKeepCase(s).toLowerCase().replace(/ё/g, 'е')
}

const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', к: 'k', м: 'm', т: 't', в: 'b', н: 'h'
}

/** Свёртка кириллических двойников в латиницу: «тwitch» → «twitch». Применяется к тексту и к токену. */
export function foldHomoglyphs(s: string): string {
  return s.replace(/[аеорсхукмтвн]/g, (c) => HOMOGLYPHS[c] ?? c)
}

/** Склейка латиницы: убрать пробелы, точки, дефисы и апострофы между латинскими буквами/цифрами. */
export function glueLatin(s: string): string {
  return s.replace(/(?<=[a-z0-9])[\s.\-'’]+(?=[a-z0-9])/g, '')
}

const LATIN_TOKEN = /^[a-z0-9 .\-'’]+$/
const GLUE_MIN = 5

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const NOT_WORD_BEFORE = '(?<![\\p{L}\\p{N}_])'
const NOT_WORD_AFTER = '(?![\\p{L}\\p{N}_])'

function boundaryRe(token: string): RegExp {
  return new RegExp(NOT_WORD_BEFORE + escapeRe(token) + NOT_WORD_AFTER, 'giu')
}

// ─── Проверка брендов ──────────────────────────────────────────────────────

export type BrandLevel = 'A' | 'B' | 'C' | 'combo'

export interface BrandHit {
  readonly level: BrandLevel
  readonly category: StopCategory | 'casinos-combo'
  readonly token: string
  /** Совпавший фрагмент нормализованного текста. */
  readonly match: string
  /** Для C: true — провал (кавычки/заглавная + контекст), false — только в отчёт. */
  readonly fail: boolean
}

interface Prepared {
  readonly level: 'A' | 'B' | 'C'
  readonly category: StopCategory
  readonly token: string
  readonly folded: string
  readonly glued: string | null
  readonly re: RegExp
  readonly reFolded: RegExp
}

const PREPARED: readonly Prepared[] = (Object.keys(STOPLIST) as StopCategory[]).flatMap((category) =>
  (['A', 'B', 'C'] as const).flatMap((level) =>
    STOPLIST[category][level].map((raw): Prepared => {
      const token = normalize(raw)
      const folded = foldHomoglyphs(token)
      const glued = LATIN_TOKEN.test(folded) ? folded.replace(/[\s.\-'’]/g, '') : null
      return {
        level,
        category,
        token,
        folded,
        glued: glued && glued.length >= GLUE_MIN ? glued : null,
        re: boundaryRe(token),
        reFolded: boundaryRe(folded)
      }
    })
  )
)

const CASINO_WORD = '(?:казино|casino)'
const QUOTES = '[\\s«»"“”„\']+'
const COMBO_RES = CASINO_COMBO.map((raw) => {
  const n = escapeRe(normalize(raw))
  return {
    token: raw,
    re: new RegExp(
      `${NOT_WORD_BEFORE}(?:${n}${QUOTES}${CASINO_WORD}|${CASINO_WORD}${QUOTES}${n})${NOT_WORD_AFTER}`,
      'iu'
    ),
    solo: boundaryRe(normalize(raw))
  }
})

const C_CONTEXT_RE = new RegExp(`(?<![\\p{L}])(?:${C_CONTEXT.join('|')})`, 'iu')

function cVerdict(keepCase: string, index: number, length: number): boolean {
  if (!C_CONTEXT_RE.test(keepCase)) return false
  const first = keepCase.charAt(index)
  const capital = first !== first.toLowerCase()
  const before = keepCase.charAt(index - 1)
  const after = keepCase.charAt(index + length)
  const quoted = /[«"“„]/.test(before) && /[»"”]/.test(after)
  return capital || quoted
}

/**
 * Все совпадения стоп-листа в строке. Провал теста — хиты с `fail: true`
 * (A, B, связка казино и C с кавычками/заглавной рядом с контекстом).
 */
export function scanBrands(text: string): BrandHit[] {
  const keepCase = normalizeKeepCase(text)
  const norm = normalize(text)
  const folded = foldHomoglyphs(norm)
  const glued = glueLatin(folded)
  const hits: BrandHit[] = []
  for (const p of PREPARED) {
    if (p.level === 'A') {
      const direct = norm.includes(p.token) || folded.includes(p.folded)
      const viaGlue = !direct && p.glued !== null && glued.includes(p.glued)
      if (direct || viaGlue) hits.push({ level: 'A', category: p.category, token: p.token, match: p.token, fail: true })
      continue
    }
    const seen = new Set<number>()
    for (const [re, src] of [[p.re, norm], [p.reFolded, folded]] as const) {
      re.lastIndex = 0
      for (const m of src.matchAll(re)) {
        if (seen.has(m.index)) continue
        seen.add(m.index)
        // Нормализация не меняет длину строки, кроме NFKC-составных и удалённых невидимых символов;
        // для решения по C берём позицию в keepCase-тексте по тому же индексу (обе строки после одной нормализации).
        const fail = p.level === 'B' ? true : cVerdict(keepCase, m.index, m[0].length)
        hits.push({ level: p.level, category: p.category, token: p.token, match: m[0], fail })
      }
    }
  }
  for (const c of COMBO_RES) {
    const m = norm.match(c.re)
    if (m) {
      hits.push({ level: 'combo', category: 'casinos-combo', token: c.token, match: m[0], fail: true })
      continue
    }
    c.solo.lastIndex = 0
    for (const s of norm.matchAll(c.solo)) {
      hits.push({ level: 'C', category: 'casinos-combo', token: c.token, match: s[0], fail: cVerdict(keepCase, s.index, s[0].length) })
    }
  }
  return hits
}

// ─── QA-10: ссылки, контакты, промокоды (§3.4) ─────────────────────────────

export type LinkRule = 'url' | 'domain' | 'handle' | 'email' | 'phone' | 'promo' | 'cta'

export interface LinkHit {
  readonly rule: LinkRule
  readonly match: string
  /** `cta` (QR, «ссылка в описании») — уровень C: только отчёт, решает ревью §4. */
  readonly fail: boolean
}

const URL_RE = /https?:\/\/|www\.|t\.me\/|wa\.me|bit\.ly|clck\.ru|vk\.cc|goo\.gl/giu
const DOMAIN_RE =
  /[\p{L}\p{N}-]+\.(?:ru|рф|su|com|net|org|io|tv|gg|bet|casino|live|me|xyz|club|online|site|pro|app|ком|орг|сайт|онлайн)(?![\p{L}\p{N}])/giu
const EMAIL_RE = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu
const HANDLE_RE = /(?<![\p{L}\p{N}_.@])@([\p{L}\p{N}_]+)/gu
/** Маска ников GDD-S §3.11: «по приглашению от @ник». */
export const NICK_MASK = /^[а-я]+_[а-я]+_\d{1,4}$/u
const PHONE_RE = /\+?\d[\d\s()-]{9,}\d/gu
const HOTLINE_RE = /8-800|(?<!\d)8\s?\(?800\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/gu
const PROMO_RE = /(?<![\p{L}])(?:промокод|промо|promo|код)[\s:—–«"“-]*([\p{L}\p{N}_]{2,})/giu
const CTA_RE =
  /(?<![\p{L}\p{N}_])qr(?![\p{L}\p{N}_])|ссылк\p{L}*\s+в\s+(?:описании|профиле|био)|link\s+in\s+bio/giu

export function scanLinks(text: string): LinkHit[] {
  const s = normalizeKeepCase(text)
  const hits: LinkHit[] = []
  const push = (rule: LinkRule, match: string, fail = true) => hits.push({ rule, match, fail })
  for (const m of s.matchAll(URL_RE)) push('url', m[0])
  for (const m of s.matchAll(DOMAIN_RE)) push('domain', m[0])
  for (const m of s.matchAll(EMAIL_RE)) push('email', m[0])
  const withoutEmails = s.replace(EMAIL_RE, ' ')
  for (const m of withoutEmails.matchAll(HANDLE_RE)) {
    const nick = (m[1] ?? '').toLowerCase()
    if (!NICK_MASK.test(nick)) push('handle', m[0])
  }
  for (const m of s.matchAll(PHONE_RE)) push('phone', m[0])
  for (const m of s.matchAll(HOTLINE_RE)) push('phone', m[0])
  for (const m of s.matchAll(PROMO_RE)) {
    const code = m[1] ?? ''
    const upper = code === code.toUpperCase() && /\p{L}/u.test(code)
    if (upper && !PROMO_WHITELIST.includes(code)) push('promo', m[0])
  }
  for (const m of s.matchAll(CTA_RE)) push('cta', m[0], false)
  return hits
}

/** Строка из allowlist (путь и точное значение совпали) не проверяется гардами брендов и ссылок. */
export function isAllowlisted(path: string, value: string): boolean {
  return ALLOWLIST.some((a) => a.path === path && a.value === value)
}
