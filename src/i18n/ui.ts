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
  menuFooter: 'Сатира, 18+. Все деньги здесь нарисованные, включая долги.',
  help: 'Если ты читаешь это в три ночи и на карте минус — вот люди, которые через это прошли:',
  underside:
    'Если ты узнал здесь свой вечер — поговори с теми, кто тоже досиживал до утра. Фамилию там не спрашивают, денег не просят:',
  firstLaunch:
    '«Симулятор Додепа» — пародия. Казино, бонусы, зеркала и менеджер Анжелика выдуманы, деньги ненастоящие. ' +
    'А вейджер, «почти-выигрыш», фанфары за проигрыш и таймер, который никак не кончится, взяты из жизни. ' +
    'Как и знакомый, который третий год «почти отыгрался».'
} as const

// ─── Главное меню (S01, S02) ───────────────────────────────────────────────

export const MENU = {
  title: 'Симулятор Додепа',
  taglines: [
    '4 недели. 1 слот. 0 настоящих рублей.',
    'Симулятор человека, который вот-вот отыграется.',
    '«Ещё один деп — и завязываю». Пятый раз за вечер, и каждый раз всерьёз.'
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
        ? `Изнанка · за всё время: ${spins} ${plural(spins, ['спин', 'спина', 'спинов'])}, казино на тебе ещё не заработало · ${time}`
        : 'Изнанка · за всё время: 0 спинов, 0₽. Слот даже не знает, как тебя зовут.',
  confirmTitle: 'Начать новый ран?',
  confirmBody: (day: number, runDays: number, endlessWeek?: number) =>
    `Текущий ран (${dayOfRun(day, runDays, endlessWeek).toLowerCase()}) будет удалён.`,
  confirmKeep: 'Достижения, концовки и гардероб останутся.',
  confirmYes: 'Начать заново',
  confirmNo: 'Отмена',
  /** QA-05: сейв старой версии мигрирован, забег закрыт (TD-07). Показывается один раз. */
  legacyResetTitle: '🔧 Игра обновилась',
  legacyResetBody:
    'Старый забег закрыт: в новой версии другие правила, и прошлые деньги в них не влезают. ' +
    'Настройки на месте, ненастоящих денег не пострадало.',
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
  empty: 'Пусто. Первое достижение выдают за первый депозит. Казино умеет поздравить.',
  filters: { all: 'Все', open: 'Открытые', locked: 'Закрытые' },
  filtersAria: 'Фильтр достижений',
  honest: 'Изнанка:',
  secretHint: (hint: string) => `«${hint}»`,
  secretReward: '🎁 награда: ???',
  unlockedOn: (date: string) => `✓ ${date}`,
  progress: (cur: number, target: number) => `${money(cur)} / ${money(target)}`,
  scope: { run: 'за ран', lifetime: 'за всё время' },
  noneInFilter: 'В этом фильтре ничего.',
  foot: 'Награды — только косметика. В золотой рамке слот платит те же 90%.'
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
  intro: 'Семь концовок. Маме понравится одна.',
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
  footerLicense: 'Лицензия №000000, выдана на острове. Название острова уточняется.',
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
    honest: 'Начинал отыгрывать минус две тысячи. Сейчас отыгрываешь девять.',
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
    honest: 'Депнул за три секунды в маршрутке. Для вывода: паспорт, селфи с паспортом и ещё одно селфи, потому что на первом моргнул. Придёт утром, минус 5%.',
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
    fine: '*В отдельные периоды, на отдельных слотах, для отдельных игроков.',
    honest: '«Счастливый час» идёт с 22:00 до 06:00 — ровно когда ты и так здесь. RTP всё те же 90%.',
    emoji: '🍀',
    tone: 'gold'
  }
}

// ─── Тикеры (content-pack §4): honest[i] — зеркало showcase[i] ─────────────

export const TICKER_SHOWCASE = [
  'Гр***й поднял 200 000₽ с фрибета на 2 000! 🔥',
  'Ми***л вернулся! Бонус +100% на возвращение 🎁',
  'ЗАНОС НЕДЕЛИ 🔥 Ол***г — x500 на ставке 20₽!',
  'Ар***м: краш x40, пока препод отвернулся 🚀',
  'Ве***а подняла 4 400₽, пока варила пельмени 🥟',
  'Ва***н: «Собрал сорокет на долг — щас раскручу и отдам с плюсом» 😎',
  'Ти***р: серия из 5 выигрышей подряд! 🎺🎺🎺',
  'Де***с поднял 40 000₽ за вечер!',
  'Он***н: +50₽!!! 🎉🎉🎉',
  'Ки***л забрал бонус 200% и уже на полпути к отыгрышу! 🎯',
  'Ек***на: «Сама заварила — сама разгребу!» x25 на последнем депе 💪',
  'Ан***я: 3 000₽ на кофе с одного спина ☕',
  'Па***л вывел 15 000₽ на карту жены! 💳',
  'Ст***в: «12 лет в игре — и наконец понял систему!» 🧠',
  'Эд***д: +3 000₽ за вечер, и ни одного спина! 💼',
  'Юл***я подняла x20 и откладывает на машину! 🚗',
  'Бо***с поднял 18 000₽ через рабочее зеркало №47 🔗',
  'Ма***м: «Думал завязать — и тут 777!» 😎',
  'Ро***н: ДОДЕП ВСЁ → x10 → 50 000₽! Ты следующий?',
  'Ол***а: +8 000₽ за вечер. Муж даже не заметил! 😉',
  'Ни***й: «Поднял с фрибета — теперь только так!» 🍀',
  'Ди***н вывел 30 000₽ за 5 минут!*',
  'Ли***я: первый деп — и сразу x5! Новичкам везёт! 🍀',
  'Се***й в VIP-зале! Личный менеджер уже на связи 🥂',
  'Ва***й: «Отбил минус — и сразу завязал!» 💪',
  'Ма***а сорвала x25 — 12 500₽ за один спин!',
  'Св***на крутит уже 3 часа и В ПЛЮСЕ!* 🔥',
  'Ко***н закрыл ипотеку?! Подробности по ссылке в описании*',
  'Ле***д получил кэшбэк 400₽! Казино заботится! ❤️',
  'Ал***а выиграла 60 000₽ и уволилась! 🏖️',
  'Фё***р: «Всё, почти отыгрался!» 🔥',
  'Им***н: 777 в 3:12 ночи! Ночью слот ДАЁТ!*',
  'Дм***й вернул долг другу с одного спина! Друг в шоке 😱',
  'Ас***я: x10 с первой ставки! Бонус ещё активен! ⏰',
  'Ев***й: «Слот ДАЁТ, я чувствую!» 11 заносов за час! 🔥',
  'Ва***ра, 67 лет: «Внук поставил приложение — теперь кручу сама!» 👵',
  'Жа***а: «Только зарегалась — уже в плюсе!» 🤑',
  'Се***а: промокод ЛОВИФРИБЕТ — 50 FS уже ждут тебя! 🎁',
  'Ар***й, VIP-Бриллиант: «Казино — мой второй дом!» 👑',
  'Т***: следующий занос — твой! ДЕПОЗИТ →'
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
  'Гр***й: это было три года назад. Жена до сих пор думает, что кредиты брали на машину.',
  'Ми***л: вчера у него был день #1 без ставок. Сорок третий первый день.',
  'Ол***г: скрин заноса до сих пор стоит у него на заставке. Телефон с этой заставкой вчера ушёл в ломбард.',
  'Ар***м: второй курс, пять микрозаймов. Коллекторы звонят его папе, и папа берёт с первого гудка.',
  'Ве***а: вода выкипела, пельмени приварились ко дну. В два ночи ела хлеб над раковиной.',
  'Ва***н: раскручивал с девяти до половины одиннадцатого. Долг отдавать завтра.',
  'Ти***р: из пяти «выигрышей» три были меньше ставки. Фанфары играли одинаково.',
  'Де***с: мама проходит банкротство по его займам. На день рождения подарила ему зимние сапоги.',
  'Он***н: ставка была 100₽. Скрин с салютом он отправил в общий чат.',
  'Ки***л: не отыграл бонус. Как ~{bonus_fail_pct}% игроков.',
  'Ек***на: разгребает третий год. Муж узнал из СМС банка, пока она была в душе.',
  'Ан***я: кофе так и не купила. К утру от этих 3 000₽ осталось ровно на кофе.',
  'Па***л: жена спросила, что за 15 000. Он сказал: «Серёга долг вернул». Серёге он должен сам.',
  'Ст***в: неделю назад написал на форуме: «12 лет играл, неделю не играю — разве так бывает?» Бывает. Неделю.',
  'Эд***д: единственный в этой ленте, кто в плюсе. По работе.',
  'Юл***я: мама думает, что она копит на машину, и скинула ещё 5 000₽ «на машину».',
  'Бо***с: сам попросил казино его заблокировать. Через час нашёл зеркало №47.',
  'Ма***м: завязать думал в феврале. 777 было в марте. Сейчас ноябрь.',
  'Ро***н: через десять минут нажал ДОДЕП ВСЁ ещё раз. Второй скрин он никому не показывал.',
  'Ол***а: муж заметил. Через полгода, в банке, когда им отказали в ипотеке.',
  'Ни***й: «Вот так всё и началось», — рассказывает он теперь по четвергам в группе поддержки.',
  'Ди***н: пять минут шли до утра. В два ночи он сам отменил вывод и докрутил.',
  'Ли***я: с тех пор ждёт, что повезёт как в первый раз. Восьмой месяц.',
  'Се***й: из всех контактов ему теперь пишет только личный менеджер. Менеджер — бот.',
  'Ва***й: завязал в понедельник, во вторник отмечал. Отмечал здесь.',
  'Ма***а: за следующие сорок минут вернула слоту 15 500₽. Помнит только x25.',
  'Св***на: четвёртый час в плюсе на сто рублей. Детей из сада забрала бабушка.',
  'Ко***н: закрыл платёж по ипотеке кредиткой, кредитку — займом, займ — ещё одним. Называет это «рефинансирование».',
  'Ле***д: кэшбэк 400₽ с проигранных 40 000₽. Сказал маме, что казино «вернуло часть».',
  'Ал***а: уволилась в пятницу. В понедельник попросилась обратно. Взяли на полставки.',
  'Фё***р: «почти отыгрался» — одиннадцатый вечер подряд. Каждый раз на другую сумму.',
  'Им***н: к шести утра всё отдал обратно. В 8:10 ушёл на смену, не ложившись.',
  'Дм***й: через два дня занял у того же друга снова. Друг больше не в шоке.',
  'Ас***я: бонус активен до сих пор. Сайт напоминает о нём каждое утро, раньше будильника.',
  'Ев***й: за тот же час слот 49 раз не дал. Этого Ев***й не почувствовал.',
  'Ва***ра: внук поставил приложение, чтобы она не скучала. Пенсия теперь кончается к двенадцатому.',
  'Жа***а: плюс продержался до первого спина «на побольше».',
  'Се***а: за каждого, кто введёт её промокод, ей платят 300₽. Вчера ввела мама.',
  'Ар***й: первый дом забрал банк. Прописан теперь у мамы.',
  'Т***: в этой ленте для тебя тоже найдётся строчка.'
] as const

export const TICKER = {
  winnersLabel: '🔥 LIVE-ВЫИГРЫШИ',
  winnersHonestLabel: 'ЛЕНТА «ПОБЕД»',
  meanwhileLabel: 'А тем временем:',
  honestMeta: (shown: number) =>
    `В ленте «побед» ${shown} ${plural(shown, ['имя', 'имени', 'имён'])}. Ниже — что с ними было дальше.`
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
  betLimitBonus: (max: number) => `Бонус не отыгран: ставка не выше ${money(max)}₽. Мелким шрифтом, как положено`,
  betLimitCasino: (casino: number) => `Больше ${money(casino)}₽ не поставить: это весь баланс казино`,
  betLimitWallet: (wallet: number) => `Больше ${money(wallet)}₽ не поставить: это весь кошелёк`,
  spin: 'КРУТИТЬ',
  spinBusy: 'КРУТИМ…',
  spinBusyHonest: 'Исход уже известен',
  spinHonest: (bet: number, expected: number) => `Ставка ${money(bet)}₽ · в среднем −${money(expected)}₽`,
  spinCost: (energy: number) => (energy > 0 ? `${energy}⚡` : '0⚡ 🔥'),
  depositToPlay: 'ДЕПОЗИТ, чтобы играть',
  depositToPlayHonest: 'На месте КРУТИТЬ теперь ДЕПОЗИТ. Палец даже не пришлось переносить.',
  hotkey: 'Пробел',
  placeholder: 'Жми КРУТИТЬ — слот сегодня ДАЁТ!*',
  wager: (done: number, total: number) => `Бонус: отыграно ${money(done)} из ${money(total)}₽`,
  wagerHonest: (expected: number) => `Ожидаемый остаток после отыгрыша ≈ ${money(expected)}₽`,
  rtpBadge: 'RTP 90%',
  lampsNote: 'Лампочки',
  freeSpinHonest: 'Спины при тильте ≥70 не тратят ⚡. В туалет хочется уже час. Ещё спин.',
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
  honestDeposit: 'Депнуть можно одной рукой, стоя в маршрутке. Вывод придёт завтра, с комиссией, если ты сам не отменишь его ночью.',
  honestAfter: 'Касса закрылась сама, курсор уже на КРУТИТЬ. Подумать «может, не надо» ты не успел.'
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
  honest: 'Деп запрут вместе с бонусом. До конца отыгрыша обычно доезжают с балансом около нуля и чувством, что было почти.'
} as const

// ─── Выход из казино при тильте ≥70 (content-pack §6.1) ────────────────────

export const EXIT_CONFIRM = {
  title: 'Уже уходишь?',
  /** Внутренний голос героя. Модалка — один раз за игровой день при 🔥 ≥ 70: lines[day % lines.length]. */
  lines: [
    'Уйдёшь сейчас — минус так и останется. А пока сидишь, он ещё временный.',
    'Ещё пять спинов. Не зайдёт — ухожу. Честно.',
    'Сейчас встанешь, а кто-нибудь сядет на твой прогретый слот и заберёт твой занос.',
    'Отобью хотя бы то, что слил после обеда, — и всё.',
    'Он уже три раза показал две семёрки. Он же намекает.',
    'До зарплаты всё равно ничего не изменится. А тут может.',
    'Ладно, не пять. Три спина. На минималке. Это почти как уйти.',
    'Выйдешь — и весь вечер будешь думать, что было бы на следующем спине.'
  ],
  stay: '▶ ЕЩЁ ПАРУ СПИНОВ ◀',
  leave: 'Уйти',
  /** Серая строка под кнопками: honest[i] отвечает на lines[i]. */
  honest: [
    'Этот «временный» минус ты сторожишь с восьми вечера. Он подрос.',
    'Пятый спин был сорок минут назад. С тех пор ты считаешь заново.',
    'Завтра на смене закроешь глаза — а там вишенки.',
    '«После обеда» было четыре часа назад. Обедал ты чипсами.',
    'После каждой пары семёрок ставка у тебя почему-то росла.',
    'Тут уже изменилось: когда ты садился, на карте было больше.',
    'Три спина на минималке заняли сорок минут и закончились на максималке.',
    'На следующем было бы то же, что на прошлых двухстах.'
  ]
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
  noDebt: '💳 Долгов нет. Эдуард о тебе не знает.',
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
  friendNote: 'С каждым звонком Серёга переводит меньше и берёт трубку позже.',
  bank: { title: '🏦 Банк «Надёжный»', verb: 'Взять кредит' },
  bankGain: (amount: number, rate: string) => `кредит ${money(amount)}₽ · ${rate} в день`,
  bankNote: (repMin: number, rep: number) => `Нужна репутация ❤️ ≥ ${repMin} (у тебя ${rep})`,
  mfo: { title: '💸 МФО «БЕСПЛАТНЫЕ ДЕНЬГИ… НУ ПОЧТИ»', verb: '▶ ПОЛУЧИТЬ ДЕНЬГИ ◀' },
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
  teaset: { desc: 'Бабушка доставала его на Новый год и ставила только на скатерть.' },
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
  nearMissNote: 'третья семёрка прийти не могла: исход был известен до вращения',
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
    luck > 0 ? `Тебе везло больше среднего на ${money(luck)}₽. Обычно с этого всё и начинается.` : luck < 0 ? `Невезение: −${money(-luck)}₽ к ожидаемому.` : 'Ровно по таблице.',
  withdrawable: (n: number) => `Можно вывести сейчас: ${money(n)}₽`,
  empty: 'Ты ещё не играл. Казино пока ничего не заработало.',
  lifetimeLost: (lost: number) => `За всё время ты проиграл ${money(lost)}₽ ненастоящих денег.`,
  recent: 'Последние операции'
} as const

// ─── Фазы дня ──────────────────────────────────────────────────────────────

export const MORNING = {
  title: (day: number) => `Утро. День ${day}`,
  body: 'Будильник. На экране уже три пуша: «Мы скучаем», «Мы очень скучаем» и «Твой слот остыл?»',
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
  sign: 'Сохраняйте чек до конца рана.'
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
  moreSub: (growth: number) => `Одна неделя — и точно отобьёшься, бро! 🔥 Счета ×${growth}*`,
  footnote: '* То же самое ты говорил себе в первый день.',
  back: '← Назад в день',
  locked: (debt: number) => `Долг ${money(debt)}₽. Завязать можно только с нулём: коллекторы не завязывают.`
} as const

/** Предупреждение «ЗАВЯЗАТЬ» при деньгах на сайте / выводе в очереди (GDD §3.7, E24; QA-01). */
export const QUIT_CONFIRM = {
  title: 'Завязать? На сайте остались деньги',
  casino: (casino: number) => `На сайте осталось ${money(casino)}₽. Вывод придёт завтра. Завтра не будет.`,
  withdrawals: (net: number) => `Заявка на вывод ${money(net)}₽ «на рассмотрении». Придёт завтра. Завтра не будет.`,
  total: (total: number) => `Итого останется у казино: ${money(total)}₽ — строкой «Осталось у казино» в Выписке.`,
  honest: 'Ради этих денег очень хочется остаться «ещё на день». Этот день обычно обходится дороже, чем они.',
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
  netPositive: (net: number) => `Итог: +${money(net)}₽. Именно этот скрин люди потом годами показывают друзьям.`,
  netZero: 'Итог: 0₽. Ушли только вечера.',
  emptyCasino: 'Операций в казино: 0. Самая короткая строка в истории Выписок.',
  equivalentsTitle: 'Это примерно:',
  lifetimeTitle: 'ЗА ВСЁ ВРЕМЯ',
  lifetimeLost: (lost: number) => `Проиграно ненастоящих денег: ${money(lost)}₽. Настоящих: 0₽.`,
  lifetimeRuns: (runs: number) => `Ранов завершено: ${runs}.`,
  newAchievements: 'Новое:',
  closing: [
    'Документ сформирован автоматически. Подпись не требуется. Выводы — на усмотрение держателя счёта.',
    'Копия документа маме не направлялась. В этот раз.',
    'Приложение: скриншот «почти 777», 1 шт.'
  ],
  helpFooter: 'Если эти цифры похожи на твою настоящую выписку — вот люди, которые через это прошли:',
  oneMore: 'Ещё ран?',
  oneMoreFine: 'Новый ран начнётся с нуля. Серёга забудет, что ты ему должен.',
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
