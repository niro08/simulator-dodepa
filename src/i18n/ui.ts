/**
 * Строки оболочки UI (CD-16/CD-17): меню, шапка-сайт, баннеры, тикеры, касса, Изнанка, Выписка, настройки.
 * Источник — design/content-pack.md (§1.1, §4–§8, §10–§12) и design/ux-flows.md.
 * Хроника, отказы, концовки и карточки сна — в ru.ts (его ведёт gameplay-programmer).
 * Числа баланса сюда не хардкодятся: функции получают их аргументами из store.config / hud.
 */
import { COSMETIC_NAMES, money } from './ru'

/** Склонение по Intl.PluralRules('ru'): [одна, две, пять]. */
const pluralRules = new Intl.PluralRules('ru')
export function plural(n: number, forms: readonly [string, string, string]): string {
  const rule = pluralRules.select(Math.abs(Math.floor(n)))
  return rule === 'one' ? forms[0] : rule === 'few' ? forms[1] : forms[2]
}

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`

/** 754 → «12 мин», 4000 → «1 ч 06 мин». */
export function duration(sec: number): string {
  const total = Math.max(0, Math.floor(sec / 60))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h} ч ${String(m).padStart(2, '0')} мин` : `${m} мин`
}

/**
 * «День 12 из 28» или, в режиме «Ещё неделю», «День 36 · неделя 6» (QA-03, GDD §3.7): после 28-го дня «из 28» врёт.
 */
export function dayOfRun(day: number, runDays: number, endlessWeek?: number): string {
  return endlessWeek !== undefined ? `День ${day} · неделя ${endlessWeek}` : `День ${day} из ${runDays}`
}

export const HELP_LINK = {
  text: 'Анонимные Игроки — группы поддержки',
  url: 'https://www.gamblersanonymous.org/'
} as const

// ─── Общие ─────────────────────────────────────────────────────────────────

export const COMMON = {
  back: '← Назад',
  backToRun: '← В ран',
  close: 'Закрыть',
  cancel: 'Отмена',
  menu: 'В меню',
  soundOn: 'Звук включён',
  soundOff: 'Звук выключен',
  soundAria: (on: boolean) => (on ? 'Выключить звук (M)' : 'Включить звук (M)'),
  pauseAria: 'Пауза и меню (Esc)',
  glassesOff: '👓 Снять очки',
  glassesOn: '🕶️ Надеть обратно',
  glassesAria: (iznanka: boolean) => (iznanka ? 'Надеть очки: вернуть Витрину (I)' : 'Снять очки: показать Изнанку (I)'),
  saved: 'сохранено ✓',
  saveReadOnly: '⚠️ Сейв создан более новой версией игры — прогресс не сохраняется.',
  skipTransition: 'Нажми любую клавишу, чтобы пропустить',
  loading: 'Считаем ваши долги…'
} as const

export const DISCLAIMER = {
  menuFooter: 'Игра-сатира. Реальных денег здесь нет — ни на входе, ни на выходе.',
  help: 'Если это про тебя — это лечится.',
  underside:
    'Если ты узнал в Витрине свой вечер — это не шутка, и это лечится. Помощь при игровой зависимости анонимна:',
  firstLaunch:
    '«Симулятор Додепа» — пародия. Казино, бонусы, зеркала и Анжелика выдуманы, деньги ненастоящие. ' +
    'Настоящие здесь только приёмы: вейджер, «почти-выигрыш», фанфары за проигрыш и таймеры, которые не кончаются. ' +
    'Мы их не придумали. Мы просто подписали.'
} as const

// ─── Главное меню (S01, S02) ───────────────────────────────────────────────

export const MENU = {
  title: 'Симулятор Додепа',
  taglines: [
    '4 недели. 1 слот. 0 настоящих рублей.',
    'Сатирический роглайт, где победить можно одним способом — уйти.',
    'Казино обещает бонус 200%. Игра показывает выписку.'
  ],
  continue: '▶ Продолжить',
  /** endlessWeek — неделя в режиме «Ещё неделю» (QA-03: без «из 28»). */
  continueSub: (day: number, runDays: number, wallet: number, debt: number, endlessWeek?: number) =>
    `${dayOfRun(day, runDays, endlessWeek)} · 👛 ${money(wallet)}₽${debt > 0 ? ` · долг ${money(debt)}₽` : ''}`,
  newRun: '✨ Новый ран',
  wardrobe: '👔 Гардероб',
  achievements: '🏆 Достижения',
  endings: '📜 Концовки',
  settings: '⚙ Настройки',
  howTo: '❔ Как играть',
  lifetime: (lost: number, spins: number, time: string) =>
    lost > 0
      ? `Изнанка · за всё время: проиграно ${money(lost)}₽ ненастоящих денег · ${spins} ${plural(spins, ['спин', 'спина', 'спинов'])} · ${time}`
      : spins > 0
        ? `Изнанка · за всё время: ${spins} ${plural(spins, ['спин', 'спина', 'спинов'])}, казино пока не в плюсе · ${time}`
        : 'Изнанка: ты ещё ничего не проиграл. Пока.',
  confirmTitle: 'Начать новый ран?',
  confirmBody: (day: number, runDays: number, endlessWeek?: number) =>
    `Текущий ран (${dayOfRun(day, runDays, endlessWeek).toLowerCase()}) будет удалён.`,
  confirmKeep: 'Достижения, концовки и гардероб останутся.',
  confirmYes: 'Начать заново',
  confirmNo: 'Отмена',
  /** QA-05: сейв старой версии мигрирован, забег закрыт (TD-07). Показывается один раз. */
  legacyResetTitle: '🔧 Игра обновилась',
  legacyResetBody:
    'Старый забег закрыт: в новой версии другие правила, и переносить в неё прошлые деньги было бы бонусом. А бонусы здесь ' +
    'только у казино. Настройки на месте, ненастоящих денег не пострадало.',
  legacyResetOk: 'Понятно'
} as const

/** Общие строки экранов меты S03–S05 (CD-19). */
export const META = {
  counter: (open: number, total: number) => `${open} / ${total}`,
  counterAria: (open: number, total: number) => `Открыто ${open} из ${total}`,
  locked: 'закрыто',
  secret: 'СЕКРЕТ',
  unknown: '???',
  date: (ts: number) => new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
} as const

/** Названия видов косметики и строки наград (карточки ачивок, Гардероб). */
export const COSMETIC_KIND = {
  skin: { icon: '🎨', tab: 'Скины слота', one: 'Скин' },
  theme: { icon: '🖥', tab: 'Темы', one: 'Тема' },
  sound: { icon: '🔊', tab: 'Звук-паки', one: 'Звук-пак' },
  title: { icon: '🏷', tab: 'Титулы', one: 'Титул' }
} as const

/** «🏷 Новичок» — чип косметики (награда ачивки, Гардероб). */
export function cosmeticChip(id: string): string {
  const kind = id.split(':')[0] as keyof typeof COSMETIC_KIND
  const icon = COSMETIC_KIND[kind]?.icon ?? '🎁'
  return `${icon} ${COSMETIC_NAMES[id] ?? id}`
}

// ─── S04 · Достижения ──────────────────────────────────────────────────────

export const ACHIEVEMENTS_SCREEN = {
  title: 'Достижения',
  empty: 'Пока ничего. Первое достижение — за первый депозит. Мы не советуем.',
  filters: { all: 'Все', open: 'Открытые', locked: 'Закрытые' },
  filtersAria: 'Фильтр достижений',
  honest: 'Изнанка:',
  secretHint: (hint: string) => `«${hint}»`,
  secretReward: '🎁 награда: ???',
  unlockedOn: (date: string) => `✓ ${date}`,
  progress: (cur: number, target: number) => `${money(cur)} / ${money(target)}`,
  scope: { run: 'за ран', lifetime: 'за всё время' },
  noneInFilter: 'Здесь пусто. Пока.',
  foot: 'Награды — только косметика. Ни одна не меняет шансы: возврат 90% при любых ачивках.'
} as const

// ─── S03 · Гардероб ────────────────────────────────────────────────────────

export const WARDROBE = {
  title: 'Гардероб',
  tabsAria: 'Виды косметики',
  onlyDefault: 'Открывается за достижения. Никогда — за деньги.',
  preview: 'Превью',
  equip: 'Надеть',
  equipped: '✓ надето',
  newBadge: 'NEW',
  newAria: 'новое',
  locked: '🔒 закрыто',
  unlockBy: 'Откроется за:',
  unlockOr: 'или',
  hiddenAch: '??? (секретное достижение)',
  noSource: 'Пока не выдаётся: достижение для неё появится в обновлении.',
  default: 'Есть у всех с первого запуска.',
  honest: 'Косметика не меняет шансы. Возврат 90% в любом скине.',
  tiers: ['0.5x', '1x', '2x', '5x', '10x', '25x', '777', 'пусто'] as const,
  tiersHonest: 'Символы по тирам выплат. Тиры и вероятности одинаковы во всех скинах.',
  themeSample: { balance: 'Баланс', cta: 'ДЕПОЗИТ', hot: 'HOT', win: '+500₽', text: 'Удача любит смелых*' },
  themeHonest: 'Тема меняет только Витрину. Изнанка и «Жизнь» остаются бумажными.',
  soundDesc: {
    'sound:classic': 'Квадратная волна, «динь-динь», арпеджио на выигрыш. Проигрыш с фанфарами звучит как выигрыш.',
    'sound:honest': 'Один сухой щелчок на любой исход. Выигрыш, проигрыш и «почти» звучат одинаково — как и есть.',
    'sound:hall_90s': 'Электромеханика, монеты в лоток. Проигрыш с фанфарами звучит как выигрыш.',
    'sound:streamer': 'Хорны «ДОДЕП!». Громко празднует всё, включая минус.'
  } as Record<string, string>,
  soundHonest: 'В Изнанке исходы спина всегда звучат «Честно», какой бы пак ни был надет.',
  titleWhere: 'Печатается в шапке сайта и в Выписке.',
  titlePrefix: 'Игрок:',
  titleChipAria: (t: string) => `Твой титул: ${t}. Сменить — в Гардеробе`,
  equipFailed: 'Эта вещь ещё закрыта'
} as const

// ─── S05 · Коллекция концовок ──────────────────────────────────────────────

export const ENDINGS_SCREEN = {
  title: 'Концовки',
  intro: 'Концовок семь. Хорошая — одна.',
  count: (n: number) => `×${n}`,
  first: (date: string) => `впервые ${date}`,
  best: 'лучшая оценка',
  grades: 'Оценки «Завязал»',
  read: 'Читать',
  readTitle: 'Концовка',
  achievement: (title: string) => `🏆 ${title}`,
  hintNote: 'Подсказки — направление, а не инструкция.'
} as const

// ─── Шапка-сайт, лобби, подвал (content-pack §5.3) ─────────────────────────

export const SITE = {
  address: 'додеп-зеркало-47.нет',
  addressHonest: 'сайт казино',
  nav: ['СЛОТЫ', 'LIVE', 'БОНУСЫ 🔥', 'ТУРНИРЫ', 'VIP'],
  casino: 'Баланс',
  casinoHonest: 'Твои деньги у них',
  wallet: 'Кошелёк',
  deposit: 'ДЕПОЗИТ',
  depositHonest: 'Перевести из кошелька в казино',
  withdrawPending: (net: number) => `+${money(net)}₽ утром ⏳`,
  skipToSlot: 'К слоту',
  skipToLife: 'К жизни',
  /** Скрытый заголовок игрового экрана для скринридера (CD-21). */
  screenTitle: (day: number) => `Симулятор Додепа. День ${day}`,
  footerResponsible: 'Ответственная игра',
  footerResponsibleHonest: 'Ты здесь',
  footerCopy: '© ДОДЕП КАЗИНО. Все права защищены. Все деньги — тоже.',
  footerLicense: 'Лицензия №000000 выдана где-то*. *Не проверяйте.',
  footerFine: '*Бонус с отыгрышем. Таймер декоративный. 18+ · сатира',
  footerPay: '💳 Карта мамы · 🏦 МФО · 📱 Ломбард',
  lobbyTitle: 'ЛОББИ',
  lobbyPlay: 'ИГРАТЬ'
} as const

export const LOBBY_TILES = [
  { key: 'gold_dodep', name: 'Золото Додепа', emoji: '🍒', playable: true, honest: 'RTP 90%. Единственный играбельный. Остальные такие же.' },
  { key: 'book_of_debts', name: 'Книга Долгов', emoji: '📕', playable: false, honest: 'Тот же слот, другие картинки.' },
  { key: 'sweet_bankruptcy', name: 'Сладкое Банкротство', emoji: '🍭', playable: false, honest: 'Тот же слот, картинки слаще.' },
  { key: 'collector_gates', name: 'Врата Коллектора', emoji: '🚪', playable: false, honest: 'Эти врата открываются только внутрь.' }
] as const

// ─── Баннеры (content-pack §5.1) ───────────────────────────────────────────

export interface BannerText {
  key: string
  kicker: string
  title: string
  hero?: string
  cta: string
  fine: string
  honest: string
  emoji: string
  tone: 'magenta' | 'cyan' | 'gold'
  timer?: boolean
}

export const BANNERS: Record<string, BannerText> = {
  bonus_200: {
    key: 'bonus_200',
    kicker: 'ЭКСКЛЮЗИВ ДЛЯ ТЕБЯ',
    title: 'БОНУС НА ПЕРВЫЙ ДЕП!*',
    hero: '200%',
    cta: 'ЗАБРАТЬ БОНУС',
    fine: '*Вейджер от суммы бонуса. Весь баланс заблокирован до отыгрыша.',
    honest: 'Кладёшь X — казино запирает 3X. Ожидаемый остаток после отыгрыша ≈ 0₽.',
    emoji: '🎁',
    tone: 'magenta',
    timer: true
  },
  win_back: {
    key: 'win_back',
    kicker: 'ТЫ ПОЧТИ У ЦЕЛИ',
    title: 'ОТЫГРАЙСЯ! УДАЧА УЖЕ РЯДОМ!*',
    hero: '🔥🔥🔥',
    cta: 'КРУТИТЬ ЕЩЁ',
    fine: '*Результаты прошлых игр не гарантируют будущих.',
    honest: 'Прошлые спины не влияют на следующий. «Отыграться» = «проиграть больше, но позже».',
    emoji: '💸',
    tone: 'magenta',
    timer: true
  },
  instant_withdraw: {
    key: 'instant_withdraw',
    kicker: 'ТОЛЬКО У НАС',
    title: 'МГНОВЕННЫЙ ВЫВОД ЗА 5 МИНУТ!*',
    hero: '5 МИН',
    cta: 'ДЕПОЗИТ',
    fine: '*Время обработки может составлять до 1 рабочего дня. Комиссия 5%.',
    honest: 'Депозит — 0 секунд. Вывод — до утра и минус 5%. Скорость зависит от направления.',
    emoji: '⚡',
    tone: 'cyan'
  },
  mirror: {
    key: 'mirror',
    kicker: 'ДОБАВЬ В ЗАКЛАДКИ',
    title: 'РАБОЧЕЕ ЗЕРКАЛО №47 — ВСЕГДА ОНЛАЙН!*',
    hero: '№47',
    cta: 'ИГРАТЬ',
    fine: '*Добавьте в закладки.',
    honest: 'Предыдущие 46 тоже были «всегда онлайн».',
    emoji: '🪞',
    tone: 'gold'
  },
  happy_hour: {
    key: 'happy_hour',
    kicker: 'СЧАСТЛИВЫЙ ЧАС',
    title: 'RTP ДО 99%!*',
    hero: '99%',
    cta: 'КРУТИТЬ',
    fine: '*«До» — ключевое слово.',
    honest: 'RTP этого слота — 90%. Всегда. Ночью, днём, в «счастливый час».',
    emoji: '🍀',
    tone: 'gold'
  }
}

// ─── Тикеры (content-pack §4): honest[i] — зеркало showcase[i] ─────────────

export const TICKER_SHOWCASE = [
  'Ал***й выиграл 48 000₽ в «Золоте Додепа»! 🔥',
  'Ма***а сорвала x25 — 12 500₽ за один спин!',
  'Се***й поймал 7️⃣7️⃣7️⃣ — 100 000₽!!! 💎',
  'Ди***н вывел 30 000₽ за 5 минут!*',
  'Ол***г выиграл 2 000₽! Ставка была… неважно! 🎉',
  'Ек***на получила 777 фриспинов по промокоду ДОДЕП 🎁',
  'Ан***н поднял x10 с третьей попытки! А ты?',
  'Ви***р забрал ДЖЕКПОТ после 400 спинов «на удачу»! 🍀',
  'Юл***я: «Депнула на последние — и ПОПЁРЛО!» 🚀',
  'Ки***л отыграл бонус 200%! Такое бывает!*',
  'Ар***м выиграл 15 000₽ в перерыве на работе 💼',
  'Та***на сделала x5 и купила маме подарок 🎁',
  'Ро***н: ДОДЕП ВСЁ → x10 → 50 000₽! Ты следующий?',
  'Ни***й вывел выигрыш на карту! Правда! 💳',
  'Св***на крутит уже 3 часа и В ПЛЮСЕ!* 🔥',
  'Па***л выиграл 3 раза подряд! Слот разогрет! 🔥',
  'Ол***а: +8 000₽ за вечер. Муж даже не заметил! 😉',
  'Ег***р поднял 22 000₽ с бонуса «Мы скучаем» 💌',
  'Им***н: 777 в 3:12 ночи! Ночные слоты щедрее!*',
  'Ва***й поднял x10 и сразу депнул обратно — вот это вера! 💪',
  'Дм***й вернул долг другу с одного спина! Друг в шоке 😱',
  'Ли***я: первый деп — и сразу x5! Новичкам везёт! 🍀',
  'Гр***й — VIP-Бриллиант! Кэшбэк 5%! Уважение! 👑',
  'Ст***в выиграл 500₽ на ставке 50₽ — x10!!',
  'Ал***а выиграла 60 000₽ и уволилась! 🏖️',
  'Ти***р поймал серию из 5 выигрышей! 🎺🎺🎺',
  'Ве***а подняла 4 400₽, пока варила пельмени 🥟',
  'Ма***м: «Думал завязать — и тут 777!» 😎',
  'Ко***н закрыл ипотеку?! Подробности в нашем канале*',
  'Ан***я: 3 000₽ на кофе с одного спина ☕',
  'Фё***р отыгрался! Полностью! Почти! 🔥',
  'Жа***а сорвала x25 на ставке 200₽ — 5 000₽!',
  'Се***а: «Только зарегалась — уже в плюсе!» 🤑',
  'Бо***с поднял 18 000₽ через рабочее зеркало №47 🔗',
  'Ев***й выиграл в «Золоте Додепа» 11 раз за час!',
  'Ки***а: промокод НЕСГОРИТ даёт +300%!*',
  'Ле***д получил кэшбэк 400₽! Казино заботится! ❤️',
  'Ма***н в VIP-зале! Личный менеджер уже на связи 🥂',
  'Ас***я: x10 с первой ставки! Бонус ещё активен! ⏰',
  'Эд***д выиграл 3 000₽! (Взыскал, но тоже считается)',
  'Он***н: +50₽!!! 🎉🎉🎉',
  'Т***: можешь быть следующим! ДЕПОЗИТ →'
] as const

/**
 * Честный тикер. Строки с числами баланса — функции от config (QA-07: «не отыграл, как ~N%» = 1 − BONUS_CLEAR_SHARE,
 * та же цифра, что в Протоколе Изнанки). Длина и порядок совпадают с TICKER_SHOWCASE (пары V/I).
 */
export function tickerHonest(stats: { BONUS_CLEAR_SHARE: number }): string[] {
  const failPct = 100 - Math.round(stats.BONUS_CLEAR_SHARE * 100)
  return TICKER_HONEST.map((line) => line.replace('{bonus_fail_pct}', String(failPct)))
}

export const TICKER_HONEST = [
  'Ал***й: −61 000₽ за месяц до этого выигрыша. Итог: −13 000₽.',
  'Ма***а: следующие 40 спинов вернули казино 12 500₽ и ещё 3 000₽.',
  'Се***й: 777 выпало на 1 214-м спине. Оборот: 121 400₽.',
  'Ди***н: вывод «5 минут» пришёл через сутки. Минус 5%.',
  'Ол***г: ставка была 4 000₽. Итог −2 000₽.',
  'Ек***на: 777 фриспинов × 1₽ → вейджер ×40 → 0₽.',
  'Ан***н: попытки 1 и 2 стоили 6 000₽. Попытка 3 вернула 5 000₽.',
  'Ви***р: 400 спинов «на удачу». Удача: −10% от оборота, по таблице.',
  'Юл***я: депнула на последние. Последние закончились.',
  'Ки***л: не отыграл бонус. Как ~{bonus_fail_pct}% игроков.',
  'Ар***м: −15 000₽ в перерыве. Премию срезали за опоздание с перерыва.',
  'Та***на: подарок маме вернула в магазин. Деньги ушли в слот.',
  'Ро***н: следующий ДОДЕП ВСЁ → 🍒🍋🤡 → 0₽. Одно нажатие.',
  'Ни***й: следующая заявка на вывод отменена. Им самим. Проиграна к утру.',
  'Св***на: оборот 60 000₽, итог −6 100₽. Фактический RTP — 89.8%.',
  'Па***л: три выигрыша подряд, потом 19 проигрышей. Слоты не «греются».',
  'Ол***а: −8 000₽. Муж заметил.',
  'Ег***р: взял 3 000₽ в МФО. Через 30 дней должен ≈4 040₽.',
  'Им***н: 3:12 ночи, −2 300₽. Ночью слоты такие же. Люди — нет.',
  'Ва***й: выиграл x10 и депнул обратно. Итог дня −1 200₽.',
  'Дм***й: занял у друга снова через два дня. Заблокирован.',
  'Ли***я: первый деп x5, следующие 30 депов в минус.',
  'Гр***й: VIP-Бриллиант. Проиграл 1 500 000₽. Кэшбэк — 5% от них.',
  'Ст***в: восемь раз −50₽, один раз +450₽. Остальное в строку не влезло.',
  'Ал***а: уволилась. Не из-за выигрыша.',
  'Ти***р: 5 «выигрышей» из 10. Три из них меньше ставки.',
  'Ве***а: пельмени сгорели. Баланс тоже. −4 400₽.',
  'Ма***м: хотел завязать. Пока ждал 777, не завязал.',
  'Ко***н: ипотека на месте. Плюс МФО. Плюс подписка на канал.',
  'Ан***я: −3 000₽. Кофе дома стоит 40₽.',
  'Фё***р: «почти отыгрался» — 11-й день подряд.',
  'На каждый выигрыш в ленте выше приходится 9 строк вроде этой. Мы показываем все.',
  'Операций за час: 1 432. Вернулось игрокам: 90%. Остальное — зарплата зеркала.',
  'Бо***с: −18 000₽. Зеркало №47 заблокировали. Открылось №48.',
  'Ев***й: 11 выигрышей за час. И 49 проигрышей за тот же час.',
  'Ки***а: промокод НЕСГОРИТ сгорел.',
  'Ле***д: −40 000₽. Кэшбэк 400₽ с вейджером ×10.',
  'Ма***н: «личный менеджер» — это бот. Бот не спит. Ма***н тоже.',
  'Ас***я: бонус ещё активен. Баланс — уже нет.',
  'Эд***д: не играет. Работает с последствиями тех, кто выше.',
  'Он***н: +50₽ при ставке 100₽. Итог −50₽. Фанфары бесплатно.',
  'Т***: следующим будешь ты. В этой ленте.'
] as const

export const TICKER = {
  winnersLabel: '🔥 LIVE-ВЫИГРЫШИ',
  winnersHonestLabel: 'ЛЕНТА «ПОБЕД»',
  meanwhileLabel: 'А тем временем:',
  honestMeta: (shown: number) =>
    `Лента «побед»: показано ${shown} ${plural(shown, ['имя', 'имени', 'имён'])}. Реальная пропорция — 1 выигрыш на 9 проигрышей.`
} as const

// ─── Слот (content-pack §6, §7.1) ──────────────────────────────────────────

export const SLOT = {
  title: 'ЗОЛОТО ДОДЕПА',
  bet: 'Ставка',
  betHonest: 'Платёж',
  betAria: 'Размер ставки, рублей',
  half: '½',
  double: '×2',
  min: 'MIN',
  allIn: 'ДОДЕП ВСЁ',
  allInHonest: (casino: number) => `Поставить весь баланс (${money(casino)}₽) на один спин`,
  doubleHonest: '×2 к ставке, ×2 к потере',
  spin: 'КРУТИТЬ',
  spinBusy: 'КРУТИМ…',
  spinBusyHonest: 'Исход уже известен',
  spinHonest: (bet: number, expected: number) => `Ставка ${money(bet)}₽ · в среднем −${money(expected)}₽`,
  spinCost: (energy: number) => (energy > 0 ? `${energy}⚡` : '0⚡ 🔥'),
  depositToPlay: 'ДЕПОЗИТ, чтобы играть',
  depositToPlayHonest: 'Кнопка спина превратилась в депозит. Это приём.',
  hotkey: 'Пробел',
  placeholder: 'Жми КРУТИТЬ — удача любит смелых!*',
  wager: (done: number, total: number) => `Бонус: отыграно ${money(done)} из ${money(total)}₽`,
  wagerHonest: (expected: number) => `Ожидаемый остаток после отыгрыша ≈ ${money(expected)}₽`,
  rtpBadge: 'RTP 90%',
  lampsNote: 'Лампочки',
  freeSpinHonest: 'Спины при тильте ≥70 не тратят ⚡. Ты не замечаешь времени.',
  opLine: (n: number, bet: number, win: number, net: number) =>
    `Операция №${n}. Ставка ${money(bet)}₽. Возврат ${money(win)}₽. Итог ${net > 0 ? '+' : ''}${money(net)}₽.`,
  stampLoss: (net: number) => `${money(net)}₽`,
  stampWin: (net: number) => `+${money(net)}₽`,
  srResult: (banner: string, bet: number, net: number) =>
    `${banner}. Ставка ${money(bet)} рублей. Итог ${net >= 0 ? 'плюс' : 'минус'} ${money(Math.abs(net))} рублей.`,
  quickSpin: 'Быстрый спин',
  betTooHigh: (casino: number) => `Ставка больше баланса казино (${money(casino)}₽)`,
  betFix: (casino: number) => `Поставить ${money(casino)}₽`
} as const

// ─── Касса и бонус (S12, S13) ──────────────────────────────────────────────

export const CASHIER = {
  title: 'КАССА',
  tabDeposit: '▶ ДЕПОЗИТ',
  tabWithdraw: 'вывод',
  from: (wallet: number) => `Из кошелька 👛 ${money(wallet)}₽ → в казино 🎰`,
  amount: 'Сумма',
  wholeWallet: (wallet: number) => `Весь кошелёк ${money(wallet)}₽`,
  bonusCheck: (bonus: number) => `ЗАБРАТЬ БОНУС 200%! (+${money(bonus)}₽)*`,
  bonusFine: (wager: number) => `*баланс казино будет заблокирован до отыгрыша ${money(wager)}₽. Подробнее`,
  depositCta: (amount: number, bonus: number) =>
    bonus > 0 ? `ДЕПНУТЬ ${money(amount)}₽ + БОНУС ${money(bonus)}₽` : `ЗАЧИСЛИТЬ МГНОВЕННО ${money(amount)}₽ ⚡`,
  afterDeposit: (wallet: number, bill: string) => `После депа: 👛 ${money(wallet)}₽${bill ? ` · ${bill}` : ''}`,
  billHint: (daysLeft: number, total: number) =>
    daysLeft === 0 ? `📄 счёт сегодня: ${money(total)}₽` : `📄 счёт через ${daysLeft} дн.: нужно ${money(total)}₽`,
  emptyWallet: 'В кошельке пусто. Деньги берутся в Жизни: смена, темка, банк…',
  openLife: 'Открыть Жизнь',
  withdrawFrom: (casino: number) => `Из казино 🎰 ${money(casino)}₽ → в кошелёк 👛`,
  withdrawMin: (min: number) => `мин. ${money(min)}₽`,
  withdrawFee: (feePct: string, fee: number, net: number) => `Комиссия ${feePct}: −${money(fee)}₽ · Придёт: ${money(net)}₽`,
  withdrawWhen: (day: number) => `Когда: завтра утром (день ${day})`,
  withdrawBillToday: '⚠ Счёт сегодня? Вывод не успеет.',
  withdrawCta: 'Заказать вывод',
  withdrawLocked: (left: number) => `Вывод заблокирован до отыгрыша: осталось ${money(left)}₽`,
  pending: (net: number, day: number) => `${money(net)}₽ — на рассмотрении ⏳ · придёт утром дня ${day}`,
  pendingTitle: 'Заявки',
  honestDeposit: 'Депозит — 0 секунд, одно нажатие. Вывод — завтра, с комиссией и минимумом. Асимметрия — это дизайн.',
  honestAfter: 'После депозита касса сама закрывается, а фокус прыгает на КРУТИТЬ. Удобство — тоже приём.'
} as const

export const BONUS_OFFER = {
  title: '★★★ БОНУС 200% НА ПЕРВЫЙ ДЕП! ★★★',
  body: (dep: number, total: number) => `Депни ${money(dep)}₽ — получи ${money(total)}₽ НА ИГРУ!*`,
  timer: 'Предложение сгорит через 04:59',
  take: '▶ ЗАБРАТЬ ◀',
  decline: 'Без бонуса',
  termsTitle: '*Условия (читаемым шрифтом, не свёрнуто):',
  terms: (mult: number, cap: number, wagerMult: number, maxBet: number) => [
    `бонус = ${mult}× депозита, депозит в зачёт — до ${money(cap)}₽`,
    `весь баланс казино заблокирован, пока не поставишь ${wagerMult}× бонуса`,
    `до этого вывод невозможен, ставка ограничена ${money(maxBet)}₽`,
    'таймер декоративный'
  ],
  honest: 'ИЗНАНКА: при возврате 90% после такого оборота в среднем остаётся ≈ 0₽. Отыгрывают немногие.'
} as const

// ─── Выход из казино при тильте ≥70 (content-pack §6.1) ────────────────────

export const EXIT_CONFIRM = {
  step1Title: 'Уже уходишь? 😢',
  step1Body: 'Слот как раз разогрелся! Ещё пара спинов — и точно!',
  step1Stay: '▶ ОСТАТЬСЯ И КРУТИТЬ ◀',
  step1Leave: 'Всё равно выйти',
  step1Honest: 'Изнанка: это «confirmshaming» — приём стыдить за уход.',
  step2Title: 'ТОЧНО?',
  step2Body: 'Твой персональный бонус сгорит через 04:59!*',
  step2Fine: '*Не сгорит. Его нет.',
  step2Stay: 'Остаться и крутить 🔥',
  step2Leave: 'Выйти',
  step2Honest: 'Два подтверждения на выход и ноль на депозит. Это тоже дизайн. Ты можешь уйти.'
} as const

// ─── Жизнь (S20, S30–S33) ──────────────────────────────────────────────────

export const LIFE = {
  title: 'ЖИЗНЬ',
  day: (day: number, runDays: number, week: number, endless: boolean) =>
    endless ? `День ${day} · неделя ${week}` : `День ${day} из ${runDays} · неделя ${week}`,
  energy: 'Энергия',
  bill: (daysLeft: number, week: number) =>
    daysLeft === 0 ? `📄 СЧЁТ НЕДЕЛИ ${week} — СЕГОДНЯ` : `📄 СЧЁТ через ${daysLeft} ${plural(daysLeft, ['день', 'дня', 'дней'])}`,
  billLines: (fixed: number, total: number) =>
    total > fixed ? `${money(fixed)}₽ + ${money(total - fixed)}₽ (10% долга) = ${money(total)}₽` : `${money(total)}₽`,
  billEnough: (wallet: number) => `👛 ${money(wallet)}₽ · ✓ хватает`,
  billShort: (wallet: number, short: number) => `👛 ${money(wallet)}₽ · не хватает ${money(short)}₽`,
  billDeferred: 'ПРОСРОЧЕН · последний день',
  billPay: (total: number) => `🧾 Оплатить ${money(total)}₽`,
  billWalletOnly: 'Платится только из кошелька. Казино — нет.',
  noBills: 'Счетов больше нет.',
  debt: (debt: number, interest: number) => `💳 Долг ${money(debt)}₽ · +${money(interest)}₽ за ночь`,
  noDebt: '💳 Долгов нет. Пока.',
  rep: 'Репутация',
  tilt: 'Тильт',
  tiltTag: 'ТИЛЬТ',
  items: 'Вещи',
  itemPawned: 'в ломбарде',
  itemSold: 'продан',
  wallet: 'Кошелёк',
  tabs: { work: 'Работа', people: 'Люди', money: 'Деньги', pawn: 'Ломбард' },
  noEnergy: 'Сил нет. День окончен — ложись спать.',
  sleep: '🌙 ЛЕЧЬ СПАТЬ',
  sleepHonest: (living: number, decay: number) => `Сон · −${money(living)}₽ на жизнь · проценты · 🔥 −${decay}`,
  quit: '✓ ЗАВЯЗАТЬ',
  quitHint: 'Счёт оплачен. Можно завязать — если долг 0.',
  inCasino: 'Ты сейчас в казино. Любое действие здесь — выход из казино.',
  forcedEnd: 'День закончен.',
  // Карточки действий
  shift: { title: '💼 Смена', verb: 'Выйти на смену' },
  shiftGain: (pay: number, tilt: number) => `+${money(pay)}₽ · 🔥 −${tilt}`,
  shiftPromo: (n: number) => (n > 0 ? `до повышения: ${n} ${plural(n, ['смена', 'смены', 'смен'])}` : 'повышений больше нет'),
  shady: { title: '😈 Темка', verb: 'Замутить' },
  shadyGain: (success: string, min: number, max: number) => `${success}: +${money(min)}…${money(max)}₽`,
  shadyRisk: (fail: string, fine: number) => `${fail}: штраф −${money(fine)}₽`,
  shadyJail: (chance: string) => `⚠ При провале ${chance} — концовка «Сел»`,
  family: { title: '🏡 Помочь семье', verb: 'Поехать к своим' },
  familyGain: (rep: number, tilt: number) => `❤️ +${rep} · 🔥 −${tilt}`,
  friend: { title: '🤝 Занять у друга', verb: 'Позвонить' },
  friendGain: (amount: number) => (amount > 0 ? `+${money(amount)}₽` : 'друзьям самим не хватает'),
  friendNote: 'Друзья не банк. Сумма падает с каждым звонком.',
  bank: { title: '🏦 Банк «Надёжный»', verb: 'Взять кредит' },
  bankGain: (amount: number, rate: string) => `кредит ${money(amount)}₽ · ${rate} в день`,
  bankNote: (repMin: number, rep: number) => `Нужна репутация ❤️ ≥ ${repMin} (у тебя ${rep})`,
  mfo: { title: '💸 МФО «БЫСТРОДЕНЬГИ-НУ-ПОЧТИ»', verb: '▶ ПОЛУЧИТЬ ДЕНЬГИ ◀' },
  mfoShout: (amount: number) => `${money(amount)}₽ ЗА 5 МИНУТ! ВСЕГО 1% В ДЕНЬ!* Одобряем ВСЕМ!`,
  mfoFine: (apr: string, amount: number, after28: number) =>
    `*${apr} годовых. Сложный процент: через 28 дней ${money(amount)}₽ → ${money(after28)}₽.`,
  debtLimit: (limit: number) => `лимит долга ${money(limit)}₽`,
  repay: { title: '💸 Погасить долг', verb: 'Погасить' },
  repayNote: (step: number) => `+1❤️ за каждые ${money(step)}₽ погашения`,
  repayAll: 'Весь долг',
  repayAmount: 'Сумма погашения, рублей',
  pawnTitle: 'Ломбард «У Гоши»',
  pawnSub: 'Выкуп — 130%. Гоша никуда не торопится.',
  pawn: 'Заложить',
  pawnConfirm: (item: string, amount: number, redeem: number) => `Сдать ${item} за ${money(amount)}₽? Выкуп обойдётся в ${money(redeem)}₽.`,
  yes: 'Да',
  no: 'Нет',
  redeem: (cost: number) => `Выкупить за ${money(cost)}₽`,
  soldForever: 'Продан навсегда',
  pawnEmpty: 'Закладывать больше нечего. Комната пустая.',
  resultFlash: 'Результат'
} as const

export const ITEM_DESC: Record<string, { desc: string; note?: string }> = {
  phone: { desc: 'Через него звонит мама. И казино.', note: 'Без телефона нельзя занимать у друзей.' },
  bike: { desc: 'Летом возил тебя на смену. Бесплатно и с ветерком.' },
  laptop: { desc: 'На нём резюме и 40 открытых вкладок зеркал.' },
  teaset: { desc: 'Доставали по праздникам. Теперь достают в ломбарде.' },
  console: { desc: 'Единственная игра, в которой ты не проигрывал деньги.' }
}

// ─── Хроника ───────────────────────────────────────────────────────────────

export const CHRONICLE = {
  title: 'ХРОНИКА',
  titleHonest: 'ПРОТОКОЛ ОПЕРАЦИЙ',
  empty: 'Здесь будет видно, куда ушли деньги.',
  day: (d: number) => `д${d}`,
  more: 'Показать ещё',
  less: 'Свернуть'
} as const

// ─── Изнанка: протокол (content-pack §7.1, ux S10i) ────────────────────────

export const PROTOCOL = {
  title: 'ИЗНАНКА · протокол операций',
  scopeRun: 'Ран',
  scopeAll: 'Всё время',
  firstRun: '(первый ран)',
  day: (day: number) => `ран, день ${day}`,
  spins: 'Спинов',
  wagered: 'Поставлено (оборот)',
  paidOut: 'Возвращено',
  rtp: 'Фактический возврат',
  rtpValue: (actual: string, declared: string) => `${actual} (заявл. ${declared})`,
  net: 'ИТОГ КАЗИНО',
  netEq: (n: number) => `= ${n} ${plural(n, ['шаурма', 'шаурмы', 'шаурм'])}`,
  ldw: '«Выигрышей» меньше ставки (LDW)',
  ldwNote: 'это проигрыши с фанфарами',
  nearMiss: '«Почти-выигрышей» показано',
  nearMissNote: 'исход решён до вращения. Это приём',
  winsShown: 'Празднований / настоящих выигрышей',
  bonus: (done: number, total: number) => `Бонус: отыграно ${money(done)} / ${money(total)}₽`,
  /** clearShare — BONUS_CLEAR_SHARE из config.stats (та же цифра, что в честном тикере, QA-07). */
  bonusExpected: (expected: number, clearShare: string) =>
    `Ожидаемый остаток после отыгрыша ≈ ${money(expected)}₽ · отыгрывают ~${clearShare} игроков`,
  tilt: (v: number) => `Тильт: ${v}/100 · тильт не меняет шансы`,
  debt: (total: number, tonight: number, paid: number) =>
    `Долг ${money(total)}₽ · ночью +${money(tonight)}₽ · процентов уплачено ${money(paid)}₽`,
  mfoApr: (apr: string) => `МФО: ${apr} годовых`,
  items: (pawned: number, lost: number) => `Вещей в ломбарде: ${pawned} · потеряно: ${lost}`,
  nights: (n: number, max: number) => `Ночей в казино: ${n} из ${max}`,
  hours: (h: number, unnoticed: number) => `В казино по внутриигровым часам: ${h} ч, из них «не заметил»: ${unnoticed} ч`,
  time: (t: string) => `В игре: ${t}`,
  luck: (luck: number) =>
    luck > 0 ? `Тебе везло больше среднего на ${money(luck)}₽. Это не навык.` : luck < 0 ? `Невезение: −${money(-luck)}₽ к ожидаемому.` : 'Ровно по таблице.',
  withdrawable: (n: number) => `Можно вывести сейчас: ${money(n)}₽`,
  empty: 'Ты ещё не играл. Казино пока ничего не заработало.',
  lifetimeLost: (lost: number) => `За всё время ты проиграл ${money(lost)}₽ ненастоящих денег.`,
  recent: 'Последние операции'
} as const

// ─── Фазы дня ──────────────────────────────────────────────────────────────

export const MORNING = {
  title: (day: number) => `Утро. День ${day}`,
  body: 'Будильник. Телефон уже светится: «Бонус сгорит через 04:59!»',
  cta: (day: number) => `Встать · День ${day}`
} as const

export const SLEEP_CONFIRM = {
  title: 'Лечь спать?',
  energyLeft: (e: number) => `Осталось ${e}⚡ — они не переносятся.`,
  billWarn: (total: number) => `⚠ Счёт ${money(total)}₽ сегодня не оплачен. Перед сном придётся решить: оплатить, отсрочить или не платить.`,
  stay: 'Ещё не сплю',
  sleep: '🌙 Спать',
  inCasinoNote: 'Сон — тоже выход из казино.'
} as const

export const NIGHT = {
  line: (from: number, to: number) => `Ночь ${from} → ${to}…`
} as const

export const EVENT_CARD = {
  kicker: (day: number) => `НОЧЬ ${day}`,
  hint: 'Выбери вариант: ← / 1 или → / 2.',
  noCost: 'бесплатно',
  cost: (c: number) => `👛 −${money(c)}₽`,
  unaffordable: (wallet: number) => `В кошельке ${money(wallet)}₽`,
  walletNote: (wallet: number) => `👛 сейчас ${money(wallet)}₽. Счета и события — только из кошелька.`
} as const

export const RECEIPT = {
  title: (day: number) => `ЧЕК · ДЕНЬ ${day} → УТРО ДНЯ ${day + 1}`,
  no: (day: number) => `№ ${String(day).padStart(6, '0')}`,
  dayPart: 'ДЕНЬ',
  nightPart: 'НОЧЬ',
  earned: 'Заработано (смены, темки, друзья, выводы)',
  casino: (w: number, p: number) => `Казино: поставлено ${money(w)}₽, возвращено ${money(p)}₽`,
  casinoNight: 'Ночь в казино: −20% баланса',
  living: 'На жизнь',
  interest: 'Проценты по долгу',
  forcedMfo: 'Недостача оформлена в МФО',
  toDebt: 'к долгу',
  rep: '❤️ за день',
  tilt: '🔥 за день',
  wallet: 'КОШЕЛЁК',
  casinoBal: 'КАЗИНО',
  debt: 'ДОЛГ',
  walletMinus: '⚠ кошелёк в минусе',
  event: 'Ночью что-то случилось. Утром узнаешь.',
  next: (day: number) => `Встать · День ${day}`,
  quiet: 'Тихая ночь.',
  casinoNightTitle: 'НОЧЬ В КАЗИНО',
  casinoNightBody: (lost: number) =>
    `Ты моргнул, а за окном светает. На столе холодный чай, в телефоне 4% заряда. Баланс казино −20% (${money(lost)}₽).`,
  casinoNightCounter: (n: number, max: number) => `Ночей в казино: ${n} из ${max}.`,
  casinoNightLast: 'Ещё одна такая ночь — и ты не вспомнишь неделю.',
  sign: 'Витринные «выигрыши» здесь не пересказываются. В чеке только нетто.'
} as const

export const BILLS = {
  title: (week: number) => `📄 СЧЁТ НЕДЕЛИ ${week}`,
  formNo: 'ФОРМА №7-СЧ',
  deadline: 'Оплатить сегодня, из кошелька.',
  living: 'Коммуналка, еда, связь',
  debtPart: 'Обязательный платёж по долгу (10%)',
  total: 'ИТОГО',
  wallet: (wallet: number) => `В кошельке ${money(wallet)}₽. Баланс казино здесь не принимается.`,
  enough: '✓ хватает',
  short: (n: number) => `не хватает ${money(n)}₽`,
  where: 'Где взять сегодня: смена, ломбард, банк, МФО. Вывод из казино придёт только завтра — поздно.',
  pay: (total: number) => `💳 Оплатить ${money(total)}₽`,
  defer: (total: number) => `⏳ Отсрочка до завтра (+50%) → ${money(total)}₽`,
  deferUsed: 'Отсрочка уже использована. Следующий неоплаченный счёт — к Эдуарду.',
  refuse: 'Не платить',
  refuseNote: 'Это концовка «Добрый вечер, мы из банка».',
  back: '← Позже (вернуться в день)',
  overdue: 'ПРОСРОЧЕНО',
  paid: 'ОПЛАЧЕНО'
} as const

export const FORK = {
  kicker: (day: number) => `ДЕНЬ ${day} · ВЕЧЕР`,
  title: (debt: number) => `Долг: ${money(debt)}₽.`,
  body: 'Счета оплачены. Казино прислало «персональный бонус 300% — только сегодня*». Приложение всё ещё на телефоне. Палец — над ним.',
  quit: 'ЗАВЯЗАТЬ',
  quitSub: 'Ран закончится. Навсегда (до следующего рана).',
  more: 'ЕЩЁ НЕДЕЛЮ!',
  moreSub: (growth: number) => `Ты же в плюсе, бро! 🔥 Счета ×${growth}. Бонус сгорит через 04:59*`,
  footnote: '* Мы тоже используем приём «ещё один раз». Разница: здесь это стоит 0₽.',
  back: '← Назад в день',
  locked: (debt: number) => `Долг ${money(debt)}₽. Завязать можно только с нулём: коллекторы не завязывают.`
} as const

/** Предупреждение «ЗАВЯЗАТЬ» при деньгах на сайте / выводе в очереди (GDD §3.7, E24; QA-01). */
export const QUIT_CONFIRM = {
  title: 'Завязать? На сайте остались деньги',
  casino: (casino: number) => `На сайте осталось ${money(casino)}₽. Вывод придёт завтра. Завтра не будет.`,
  withdrawals: (net: number) => `Заявка на вывод ${money(net)}₽ «на рассмотрении». Придёт завтра. Завтра не будет.`,
  total: (total: number) => `Итого останется у казино: ${money(total)}₽ — строкой «Осталось у казино» в Выписке.`,
  honest: 'Изнанка: казино рассчитывает, что ради этих денег ты останешься ещё на день. Уйти всё равно можно — это единственный выход.',
  back: '← Назад',
  confirm: '✓ Всё равно завязать'
} as const

export const ENDING_SCREEN = {
  kicker: (n: number, total: number, isNew: boolean) => `КОНЦОВКА ${n} из ${total}${isNew ? ' · НОВАЯ' : ''}`,
  abandoned: 'Ран брошен',
  dayLine: (day: number, runDays: number, endlessWeek?: number) => dayOfRun(day, runDays, endlessWeek),
  grade: (g: string) => `Оценка ${g}`,
  gradeWhy: (items: number, itemsTotal: number, rep: number, repA: number) =>
    `Сохранено вещей: ${items} из ${itemsTotal} · ❤️ ${rep} (для A нужно ≥ ${repA} и все вещи)`,
  toStatement: 'Смотреть выписку'
} as const

export const STATEMENT = {
  title: 'ВЫПИСКА ПО СЧЁТУ «ЖИЗНЬ»',
  glassesOff: '👓 отключено',
  holder: (title: string) => `Держатель счёта: ${title}`,
  holderDefault: 'Держатель счёта: Игрок',
  period: (days: number, time: string) => `Период: дни 1–${days}. Реальное время в игре: ${time}.`,
  ending: (title: string) => `Основание закрытия: ${title}.`,
  earned: 'ЗАРАБОТАНО',
  shifts: 'Смен отработано',
  shady: 'Темок (удачных / всего)',
  friends: 'Занято у друзей',
  casino: 'КАЗИНО',
  spins: 'Спинов',
  turnover: 'Оборот ставок',
  won: 'Выплачено казино',
  rtp: 'Фактический возврат',
  rtpValue: (a: string, d: string) => `${a} (заявлено ${d})`,
  deposited: 'Внесено депозитами',
  withdrawn: 'Выведено (дошло)',
  forfeited: 'Осталось у казино',
  net: 'Чистый итог по казино',
  ldw: 'Проигрышей с фанфарами',
  nearMiss: 'Почти-выигрышей показано',
  debts: 'ДОЛГИ И ВЕЩИ',
  interest: 'Уплачено процентов',
  penalties: 'Штрафы (счета, темки)',
  bills: 'Счетов оплачено',
  pawned: 'Вещей заложено / выкуплено',
  lost: 'Потеряно вещей',
  tiltDays: 'Дней с тильтом ≥ 70',
  nights: 'Ночей в казино',
  rep: '❤️ на конец периода',
  fullCost: 'ПОЛНАЯ ЦЕНА РАНА',
  netNegative: (net: number) => `Итог: ${money(net)}₽.`,
  netPositive: (net: number) => `Итог: +${money(net)}₽. Редкость. Не стратегия: ожидаемо −10% оборота.`,
  netZero: 'Итог: 0₽. Казино заработало на тебе только время.',
  emptyCasino: 'Операций в казино: 0. Самая короткая строка в истории Выписок.',
  equivalentsTitle: 'Это примерно:',
  lifetimeTitle: 'ЗА ВСЁ ВРЕМЯ',
  lifetimeLost: (lost: number) => `Проиграно ненастоящих денег: ${money(lost)}₽. Настоящих: 0₽. Давай так и оставим.`,
  lifetimeRuns: (runs: number) => `Ранов завершено: ${runs}.`,
  newAchievements: 'Новое:',
  closing: [
    'Документ сформирован автоматически. Подпись не требуется. Выводы — на усмотрение держателя счёта.',
    'Фанфар в этом документе нет. Не ищите.',
    'Казино этот документ не пришлёт. Поэтому его прислали мы.'
  ],
  helpFooter: 'Если цифры выше напоминают тебе не игру —',
  oneMore: 'Ещё ран?',
  oneMoreFine: 'Мы тоже используем приём «ещё один раз». Разница: здесь это стоит 0₽.',
  toMenu: 'В меню'
} as const

/** Эквиваленты Выписки (id из config.stats.EQUIVALENTS). */
export const EQUIVALENT_FORMS: Record<string, readonly [string, string, string]> = {
  EQ_SHAWARMA: ['шаурма', 'шаурмы', 'шаурм'],
  EQ_UTILITIES: ['месяц коммуналки', 'месяца коммуналки', 'месяцев коммуналки'],
  EQ_GIFT_MOM: ['подарок маме', 'подарка маме', 'подарков маме'],
  EQ_SHIFTS: ['смена', 'смены', 'смен'],
  EQ_DAYS_OF_LIFE: ['день жизни', 'дня жизни', 'дней жизни'],
  EQ_FISHING: ['рыбалка с отцом', 'рыбалки с отцом', 'рыбалок с отцом']
}

// ─── Пауза, настройки, клавиши (S06, S07, S08) ─────────────────────────────

export const PAUSE = {
  title: (day: number) => `ПАУЗА · День ${day}`,
  resume: 'Продолжить',
  settings: 'Настройки',
  howTo: 'Как играть',
  toMenu: 'В главное меню',
  playTime: (t: string) => `В игре за ран: ${t}`
} as const

export const SETTINGS = {
  title: 'НАСТРОЙКИ',
  sound: 'ЗВУК',
  soundAll: 'Звук целиком',
  volume: 'Громкость',
  music: 'Фоновая музыка',
  screen: 'ЭКРАН И ДВИЖЕНИЕ',
  calm: 'Меньше мигания',
  calmHint: 'Гасит пульсы, тряску, лампочки, частицы и бегущие строки. Звук и 👓 не трогает.',
  calmSystem: 'как в системе',
  calmSystemOn: '(в системе включено «уменьшить движение»)',
  quickSpin: 'Быстрый спин (0.4 с)',
  theme: 'Тема Витрины',
  keys: 'ГОРЯЧИЕ КЛАВИШИ',
  on: 'вкл',
  off: 'выкл'
} as const

export const HOTKEYS: readonly [string, string][] = [
  ['Пробел', 'Спин (если фокус в слоте или ни на чём)'],
  ['− / =', 'Ставка ½ / ×2'],
  ['0', 'Минимальная ставка'],
  ['D', 'Касса'],
  ['I', '👓 Витрина ↔ Изнанка'],
  ['L / C', 'К Жизни / к Казино'],
  ['N', 'Лечь спать'],
  ['← → / 1 2', 'Вариант A / B в карточке и на развилке'],
  ['M', 'Звук вкл/выкл'],
  ['? / F1', 'Как играть'],
  ['F6', 'Регионы: шапка → казино → жизнь → хроника'],
  ['Esc', 'Закрыть слой / пауза']
]

export const HOW_TO = {
  back: '← Как играть',
  keysTitle: 'Клавиши',
  keysLine: 'Пробел — спин · I — Изнанка · N — сон · D — касса · M — звук · Esc — пауза',
  helpTitle: 'Помощь'
} as const

// ─── Мобильный таб-бар и статус ───────────────────────────────────────────

export const TABS = {
  casino: '🎰 Казино',
  life: '📋 Жизнь',
  iznanka: '👓 Изнанка',
  aria: 'Разделы игрового экрана'
} as const

export const STATUS_LINE = {
  aria: 'Статус выживания — открыть Жизнь',
  bill: (total: number, days: number) => (days === 0 ? `📄 ${money(total)}₽ сегодня` : `📄 ${money(total)}₽ ч/з ${days}д`)
} as const

// ─── Тосты ─────────────────────────────────────────────────────────────────

export const TOASTS = {
  /** Префикс озвучки тоста ачивки для скринридера (CD-21). */
  srAchievement: 'Достижение',
  rejectedTitle: 'Не вышло',
  withdrawPaid: (net: number) => `Вывод пришёл: +${money(net)}₽ в кошелёк`,
  withdrawPaidHonest: 'Минус комиссия и сутки ожидания.',
  bonusBusted: 'Бонус сгорел вместе с депозитом',
  bonusCleared: (n: number) => `Отыгрыш пройден! ${money(n)}₽ можно вывести`,
  friendsBlocked: 'Друзья заблокировали твой номер',
  forcedMfo: (n: number) => `Недостача ${money(n)}₽ оформлена в МФО`,
  achievementTitle: 'ДОСТИЖЕНИЕ!',
  toWardrobe: 'В гардероб →',
  moreRewards: (n: number) => `и ещё ${n}`
} as const
