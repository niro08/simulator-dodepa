# Архитектура — «Симулятор Додепа»

- **Автор:** Technical Director
- **Дата:** 2026-09-25
- **Статус:** Предложено (ADR-001…ADR-010). Решения, помеченные **[решение владельца]**, требуют подтверждения.
- **Основание:** `production/technical-audit.md`; цели владельца: Steam, мета-прогрессия, ревизия механик, сатирический редизайн «под онлайн-казино», косметика за достижения.
- **Правило:** расчёт исходов и изменение состояния — только в `src/game/**`. UI это состояние показывает и анимирует, но ничего не решает.

---

## 1. Целевая структура слоёв

```
src/
├─ game/                       # ЧИСТОЕ ЯДРО: без Vue, без DOM, без localStorage, без Math.random
│  ├─ rng.ts                   # интерфейс Rng + seeded PRNG
│  ├─ config/
│  │  ├─ balance.ts            # все числа баланса (стоимости, награды, лимиты, стартовое состояние)
│  │  ├─ slot.ts               # таблица исходов слота (веса, множители), тайминги — не визуал
│  │  ├─ achievements.ts       # определения достижений (data)
│  │  └─ cosmetics.ts          # каталог косметики: темы, скины слотов (data, без CSS)
│  ├─ types.ts                 # RunState, Profile, GameEvent, Command, ActionResult
│  ├─ commands/                # чистые обработчики команд: (state, cmd, ctx) → ActionResult
│  │  ├─ slot.ts  work.ts  bank.ts  friends.ts
│  ├─ reducer.ts               # dispatch(state, command, ctx) + applyInvariants
│  ├─ stats.ts                 # reduceStats(stats, event) — статистика из событий
│  ├─ achievements.ts          # evaluateAchievements(profile, events) → unlocked ids
│  ├─ progression.ts           # мета-прогрессия (конец забега, наследуемые бонусы)
│  └─ save/
│     ├─ schema.ts             # SaveFile vN, типы
│     ├─ migrations.ts         # v0(legacy) → v1 → v2 …
│     └─ validate.ts           # парсинг unknown → SaveFile | ошибка
├─ platform/                   # ВСЁ, что зависит от окружения (веб / Electron / Steam)
│  ├─ storage.ts               # StorageAdapter: localStorage (web) / файл через IPC (desktop)
│  ├─ achievementsSink.ts      # AchievementSink: noop (web) / Steam (desktop)
│  └─ index.ts                 # выбор реализации по import.meta.env.VITE_PLATFORM
├─ stores/
│  ├─ game.ts                  # Pinia: держит RunState+Profile, вызывает dispatch, сохраняет
│  └─ ui.ts                    # экраны, модалки, очередь тостов (не сохраняется в сейв игры)
├─ composables/                # useSlotAnimation, useAudio, useTheme
├─ components/                 # презентационные компоненты; числа — только из config
├─ i18n/                       # ru.ts, en.ts; события → строки
└─ styles/
   ├─ tokens.css               # базовые CSS-переменные (дизайн-токены)
   └─ themes/*.css             # [data-theme="…"] переопределяют токены
```

**Правила зависимостей** (проверяются ESLint `no-restricted-imports` в TD-18):
- `game/**` не импортирует `vue`, `pinia`, `platform/**`, `components/**` и не обращается к `window`, `localStorage`, `Math.random`.
- `components/**` не импортирует `game/commands/**` напрямую: только стор и `game/config` для отображения.
- `platform/**` — единственное место, где разрешены `localStorage`, `window.electron*` и Steam.

---

## ADR-001. Единый источник правды для исхода спина

**Проблема.** Сейчас исход считает `SlotMachine.vue:175-176`, стор слепо зачисляет `amount` (`stores/casino.ts:124-139`), а ядро `playCasino` мертво. Спин не атомарен (аудит B-02…B-04).

**Решение: «результат сначала, анимация потом».**
1. UI вызывает `store.spin()`.
2. Стор выполняет `dispatch(state, { type: 'slot/spin', bet }, ctx)`. Ядро **за одну транзакцию** списывает ставку, определяет исход, считает выплату, генерирует раскладку барабанов для отображения и возвращает события.
3. Стор применяет новое состояние, **сразу сохраняет** и возвращает `SpinResult`.
4. Компонент анимирует барабаны к `result.reels`. Отображаемый баланс (`displayedMoney`) и тост появляются после окончания анимации (`store.ui.revealPending()`). Это чисто презентационная задержка.

```ts
// game/types.ts (эскиз)
export type SlotOutcomeId = 'lose' | 'triple' | 'jackpot' // расширяется данными
export interface SpinResult {
  bet: number
  outcomeId: SlotOutcomeId
  multiplier: number          // 0 для проигрыша
  payout: number              // целое, ₽
  reels: [string, string, string] // id символов (не эмодзи!) — скин решает, как рисовать
}
```

- Перезагрузка во время анимации ничего не теряет: результат уже в сейве, игрок увидит его в хронике.
- Раскладка барабанов берётся из `rng` в ядре, поэтому её тоже можно тестировать (инвариант: проигрыш никогда не даёт три одинаковых символа).
- Символы — это **id** (`cherry`, `seven`, `clown`), а скин маппит id → ассет. Логика не знает про эмодзи.

**Модель исходов — таблица весов, а не виртуальные ленты** (`config/slot.ts`):

```ts
export const SLOT_OUTCOMES = [
  { id: 'lose',    weight: 900, multiplier: [0, 0] },
  { id: 'triple',  weight: 90,  multiplier: [1.5, 4.5], symbols: ['cherry','lemon','orange','melon','star','diamond','clown'] },
  { id: 'jackpot', weight: 10,  multiplier: [7, 7],     symbols: ['seven'] },
] as const satisfies readonly SlotOutcomeDef[]
```

Почему не ленты: RTP считается аналитически одной функцией (`expectedRtp(config)`), и тест проверяет его точно, а не статистически. Гейм-дизайнер правит веса без пересчёта лент. Если Creative захочет «near-miss» (сатира: 7-7-🤡), это визуальный генератор раскладки поверх исхода, и распределение исходов он не меняет.

**Отвергнуто:** оставить расчёт в компоненте и валидировать в сторе. Два места всё равно разъедутся, а тестировать компонент дороже.

---

## ADR-002. Команды, события и единый pipeline экшенов

**Проблема.** `runAction` и `repayDebtAmount` скопированы друг с друга; результат экшена — `string | void`, где ошибка неотличима от успеха; логи — готовые русские строки (D-04, D-08).

**Решение.**

```ts
export type Command =
  | { type: 'slot/spin' }
  | { type: 'work/job' } | { type: 'work/shady' }
  | { type: 'friends/borrow' } | { type: 'friends/help' }
  | { type: 'bank/credit' } | { type: 'bank/repay'; amount: number }
  | { type: 'bet/set'; value: number }
  | { type: 'run/new' }

export type GameEvent =
  | { type: 'spin'; bet: number; outcomeId: SlotOutcomeId; payout: number }
  | { type: 'moneyEarned'; source: 'job' | 'shady' | 'borrow' | 'credit'; amount: number }
  | { type: 'debtChanged'; delta: number }
  | { type: 'reputationChanged'; delta: number }
  | { type: 'rejected'; command: Command['type']; reason: RejectReason }
  | { type: 'runEnded'; reason: 'bankrupt' | 'retired' }
  // …

export interface ActionResult { state: RunState; events: GameEvent[]; ok: boolean }
export interface GameContext { rng: Rng; config: GameConfig; now: number }

export function dispatch(state: RunState, cmd: Command, ctx: GameContext): ActionResult
```

- Обработчики чистые: получают копию состояния и возвращают новое. Стор хранит **один** `reactive`/`ref` объект `run`, а не 5 разрозненных refs.
- После каждой команды выполняется `applyInvariants(state, config)`: целые числа, `money ≥ 0`, `energy ∈ [0, maxEnergy]`, `reputation ∈ [min, max]`, `bet ∈ [minBet, …]`. Те же инварианты применяются при загрузке. Так закрываются B-05, B-07 и B-09.
- **Хроника** хранит события (`{ id, t, event }`, лимит 50), а текст формирует `i18n/formatEvent(event, locale)`. Это даёт локализацию и стабильные `:key`.
- Статистика, достижения, тосты и звук подписываются на `events`. Стор после `dispatch` прогоняет события через `reduceStats` → `evaluateAchievements` → `platform.achievementsSink`.

---

## ADR-003. Инжектируемый RNG

```ts
export interface Rng { next(): number /* [0,1) */; int(minIncl: number, maxIncl: number): number; state(): number }
export function createRng(seed: number): Rng       // sfc32 или mulberry32 — ~15 строк, без зависимостей
export function randomSeed(): number               // crypto.getRandomValues — только в platform/ или store
```

- Все функции ядра получают `ctx.rng`. `Math.random` в `src/game/**` запрещён линтером и тестом-grep'ом.
- **Сохраняем ли состояние RNG в сейв?** Рекомендую **да**: `run.rngState`. Это защищает от save-scumming и даёт воспроизводимые баг-репорты («пришлите сейв»). Стоимость — одно число. **[решение владельца]:** если сатира требует «перезагрузи и выиграй», можно не сохранять.
- Честная статистика: `stats.totalWagered`, `stats.totalPaidOut` → фактический RTP игрока рядом с заявленным `expectedRtp(config)`. Технически это открывает дизайну сатирический экран «Казино забрало у тебя 66 %».
- Тесты используют фиксированный seed. Монте-Карло тест баланса на 10⁵ спинов даёт детерминированный результат, без флаков.

---

## ADR-004. Data-driven конфиг

- `src/game/config/*.ts` — **TypeScript-модули с `as const satisfies Type`**, не JSON. Это даёт типобезопасность и tree-shaking, а для правки чисел не нужна сборка схемы. Если позже понадобится моддинг или Steam Workshop, конфиг сериализуется в JSON без изменения формы.
- `GameConfig = { balance, slot, achievements, cosmetics, progression }` передаётся в ядро через `ctx.config`. В тестах подменяется.
- UI берёт подписи («-10⚡, +1❤️») и условия `disabled` **из конфига и функций-предикатов ядра** (`canExecute(state, cmd, config): RejectReason | null`), а не из своих констант. Одна функция используется и для кнопки, и для ядра. «Как играть» (`HowToPlay.vue`) генерирует диапазоны из конфига (`rewardRange(base, reputation)`), так что гайд не может соврать.
- Числа баланса утверждает economy-designer, технически они живут только в `config/balance.ts`.

---

## ADR-005. Модель данных: забег, профиль, настройки

Мета-прогрессия требует разделять **забег** (текущая «жизнь» лудомана: деньги, долг, энергия; сбрасывается при банкротстве или новой игре) и **профиль** (переживает забеги: статистика, достижения, косметика, мета-валюта).

```ts
export interface RunState {
  id: string; startedAt: number
  money: number; energy: number; reputation: number; debt: number; bet: number
  rngState: number
  day?: number                      // если дизайн введёт время/дни
  flags: Record<string, boolean>    // разовые события забега
  log: LogEntry[]                   // события, не строки
}

export interface PlayerStats {           // только монотонные счётчики и максимумы → легко маппить на Steam Stats
  spins: number; wins: number; jackpots: number
  totalWagered: number; totalPaidOut: number
  biggestWin: number; longestLoseStreak: number; currentLoseStreak: number
  creditsTaken: number; debtRepaid: number; maxDebt: number
  jobsDone: number; shadyDeals: number; friendsBorrowed: number; friendsHelped: number
  runsStarted: number; runsBankrupt: number
}

export interface Profile {
  stats: PlayerStats                              // lifetime
  achievements: Record<AchievementId, { unlockedAt: number }>
  cosmetics: { owned: CosmeticId[]; equipped: { theme: ThemeId; slotSkin: SlotSkinId } }
  meta: { currency: number; upgrades: Record<string, number> }  // форма — после дизайна Creative
}

export interface Settings { locale: 'ru' | 'en'; musicVolume: number; sfxVolume: number; reducedMotion: boolean; skipSpinAnimation: boolean }
```

Статистика забега (`run.stats`) и lifetime (`profile.stats`) обновляются одним `reduceStats`. Достижения вида «за один забег» смотрят на `run.stats`.

---

## ADR-006. Достижения (с прицелом на Steam)

```ts
export interface AchievementDef {
  id: AchievementId              // 'FIRST_JACKPOT' — UPPER_SNAKE, НЕИЗМЕНЯЕМЫЙ после релиза; = Steam API Name
  hidden: boolean                // секретное (Steam: "Hidden")
  // условие — декларативно, чтобы работали прогресс-бары и маппинг на Steam Stats
  condition:
    | { kind: 'stat'; stat: keyof PlayerStats; scope: 'lifetime' | 'run'; gte: number }
    | { kind: 'event'; match: (e: GameEvent, run: RunState) => boolean }  // редкие «моментальные»
  reward?: { cosmetic?: CosmeticId; metaCurrency?: number }
  steam?: { apiName?: string; progressStat?: string } // по умолчанию apiName = id
  // тексты — через i18n по ключу `ach.${id}.title/desc`
}
```

- `evaluateAchievements(profile, run, events, defs)` — чистая функция, возвращает новые id. Идемпотентна: уже открытые не возвращаются.
- Стор после разблокировки: (1) пишет в `profile.achievements`, (2) выдаёт награду (косметика), (3) кладёт тост в `ui` очередь, (4) вызывает `platform.achievementsSink.unlock(id)` (в вебе noop, в Steam `steamworks.js achievement.activate`). При старте десктоп-билда sink делает **reconcile**: все локально открытые достижения повторно активируются в Steam (идемпотентно), потому что игрок мог открыть их в офлайне или в веб-версии.
- Декларативные `stat`-условия маппятся на Steam Stats + «progress achievements» (Steam показывает полоску прогресса). Поэтому в `PlayerStats` только числа.
- Лимиты Steam: API Name — латиница/цифры/подчёркивание; иконки 256×256 (открытая и серая версии). Иконки закладываем в пайплайн арта сразу.
- **Контракт с Creative Director:** они дают список достижений (id, условие на человеческом языке, награда), программисты переводят его в `config/achievements.ts`. Добавление достижения не требует кода, если хватает существующих статов.

---

## ADR-007. Косметика: темы и скины слотов

**Два уровня:**
1. **Тема (theme)** — глобальная палитра, фоны, шрифты, радиусы, свечения. Реализация: CSS-переменные.
2. **Скин слота (slotSkin)** — набор ассетов символов (по id), рамка автомата, фон барабанов, звуки спина и выигрыша, опционально параметры анимации (easing, длительность в допустимых пределах).

```css
/* styles/tokens.css — базовые токены; компоненты используют ТОЛЬКО var(--…) */
:root {
  --c-bg: #0f0f1a; --c-surface: rgba(20,20,30,.9); --c-accent: #7c3aed; --c-gold: #ffd700;
  --c-win: #10b981; --c-lose: #f59e0b; --c-danger: #e53e3e;
  --radius-card: 1rem; --glow-accent: 0 0 20px rgb(124 58 237 / .6);
  --font-display: 'Onest', system-ui, sans-serif;
  --reel-size: 80px;            /* геометрия барабана тоже токен → JS читает её, а не хардкодит 70/80 */
}
/* styles/themes/neon-vegas.css */
[data-theme='neon-vegas'] { --c-accent: #ff00aa; --c-gold: #fff200; /* … */ }
```

```ts
// game/config/cosmetics.ts — ДАННЫЕ, без путей к CSS-файлам внутри ядра
export const THEMES = [
  { id: 'default', unlock: { kind: 'default' } },
  { id: 'neon-vegas', unlock: { kind: 'achievement', id: 'FIRST_JACKPOT' } },
] as const
export const SLOT_SKINS = [
  { id: 'classic', unlock: { kind: 'default' },
    symbols: { cherry: 'classic/cherry.svg', seven: 'classic/seven.svg', clown: 'classic/clown.svg' /* … */ },
    frame: 'classic/frame.svg', sfx: { spin: 'sfx/spin.ogg', win: 'sfx/win.ogg' } },
] as const
```

- `useTheme()` ставит `document.documentElement.dataset.theme = equipped.theme`. CSS тем подключается статически (они маленькие) или лениво через `import()`, если тем станет больше 10.
- Каждый скин обязан покрыть все `SymbolId` из `config/slot.ts`. Это проверяет тест: для каждого скина множество ключей `symbols` совпадает с множеством символов слота.
- **Только за достижения и мета-прогресс. Никаких покупок за реальные деньги, лутбоксов и случайных «кейсов» с косметикой.** Это одновременно позиция сатиры и защита рейтинга (§10.5).
- Ассеты: собственные SVG или спрайты вместо эмодзи (аудит D-11), каталог `public/skins/<skinId>/…` или `src/assets/skins` (через Vite с хешами). Рекомендую `src/assets` + `import.meta.glob`: хеши в именах, и ошибка в пути ловится на сборке.

---

## ADR-008. Сохранение: версия, миграции, адаптер хранилища

```ts
export interface SaveFileV1 {
  version: 1
  savedAt: number
  build: string          // версия игры из package.json (через define в vite)
  run: RunState | null   // null = нет активного забега (меню → «Новая игра»)
  profile: Profile
  settings: Settings
}
export type SaveFile = SaveFileV1  // при изменениях: V2, миграция v1→v2
```

- **Один ключ** `dodepa.save` (веб) или файл `save.json` (десктоп). Legacy-ключ `dodepaSave` читается один раз: миграция `v0 → v1` превращает плоский `{money, energy, reputation, debt, bet, logs}` в `run`, создаёт пустой `profile`. **Старый ключ удаляется только после успешной записи v1.** Старые строковые логи переносятся как `{ type: 'legacyText', text }`.
- `migrations: Record<number, (s: unknown) => unknown>` применяются последовательно до `CURRENT_VERSION`, затем `validate()`.
- **Валидация без новой зависимости:** ручные guard-функции (`num(x, def, min, max)`, `int`, `oneOf`) в `save/validate.ts`. Поле, которое не прошло проверку, берёт дефолт, а не сбрасывает весь сейв. zod (~60 КБ) не тащим, пока схема такая маленькая. **[пересмотреть]**, если схема вырастет вдвое.
- Сейв из будущей версии (`version > CURRENT`) не перезаписываем: игра работает в режиме «только чтение» с предупреждением. Это важно при откате билда в Steam.
- **Бэкап:** перед записью предыдущий валидный сейв копируется в `dodepa.save.bak` / `save.bak.json`. Если основной не парсится, загружается бэкап.
- **Когда писать:** после каждой команды (как сейчас), с debounce 250 мс для частых действий плюс принудительно на `visibilitychange`/`beforeunload` (веб) и на `before-quit` (Electron).

```ts
export interface StorageAdapter {
  read(): Promise<string | null>
  write(data: string): Promise<void>     // атомарно: tmp-файл + rename на десктопе
  readBackup(): Promise<string | null>
}
```

Веб-адаптер синхронный по сути, но интерфейс асинхронный ради файлового IPC в Electron. Это решаем сейчас, чтобы при переходе на десктоп не переписывать стор.

---

## ADR-009. Тестирование

- **Vitest** (нативно для Vite, та же конфигурация алиасов). Для компонентов позже `@vue/test-utils` + `happy-dom`, в P0 только ядро.
- **Покрытие:** `src/game/**` ≥ 90 % строк (порог в `vitest.config.ts`); UI в P0 не покрываем.
- **Базовый набор P0:**
  1. `rng`: одинаковый seed даёт одинаковую последовательность; `int` в границах.
  2. `slot`: `expectedRtp(config)` равен аналитическому значению; Монте-Карло 10⁵ спинов с seed попадает в ±1 % от него; проигрыш никогда не даёт трёх одинаковых на барабанах; выплата — целое ≥ 0; ставка < minBet или > money отклоняется **без** изменения состояния.
  3. Инварианты: для случайных последовательностей из 10⁴ команд (seed) `money, energy, debt ≥ 0`, всё целое, награды ≥ 0 (регресс B-05).
  4. Экономика: регресс B-06 — цикл «мин. ставка → темка» не растёт неограниченно (порог задаёт economy-designer).
  5. Сейв: фикстуры legacy v0 (нормальный, с `NaN`, со строками, битый JSON, пустой), миграция в v1, round-trip `serialize → parse`, сейв «из будущего».
  6. Банк: погашение остатка < 1000 (регресс B-08).
  7. Достижения: идемпотентность, открытие по статам и событиям, выдача награды.
  8. Косметика: каждый скин покрывает все символы.
- **CI:** новый `.github/workflows/ci.yml` на `pull_request` и `push`: `npm ci → type-check → test → build-only`. `deploy.yml` добавляет шаг `npm test` перед build.

---

## ADR-010. Упаковка для Steam

### 10.1 Сравнение

| Критерий | **Electron** | **Tauri 2** | **NW.js** |
|---|---|---|---|
| Движок рендеринга | Встроенный Chromium: **одинаково на Win/Mac/Linux/Deck** | Системный WebView: WebView2 (Win), WKWebView (Mac), **WebKitGTK (Linux/Deck)** — разные движки, разные баги CSS/анимаций/аудио | Встроенный Chromium |
| Размер дистрибутива | ~90–120 МБ (распаковано ~250 МБ) | ~5–15 МБ | ~100+ МБ |
| Steamworks | **steamworks.js** (Rust/napi, активный; achievements, stats, cloud, overlay-хелпер) или steamworks-ffi-node; исторически greenworks | Нет официального плагина: самостоятельная интеграция через `steamworks-rs` в Rust + команды Tauri | greenworks / steamworks.js |
| Steam Overlay | Работает (нужны флаги, у steamworks.js есть `electronEnableSteamOverlay()`) | Известные проблемы с WebView2 (issue tauri#6196) | Работает |
| Steam Deck / Linux | Нативный Linux-билд или Windows-билд через Proton — оба рабочие | WebKitGTK на Deck — главный риск производительности и совместимости | Как Electron |
| Экосистема и прецеденты | Крупнейшая: множество HTML5-игр в Steam на Electron | Растёт, игровых прецедентов мало | Нишевый, сообщество меньше |
| Трудоёмкость для нас | Низкая: Vite-билд + main/preload на TS | Средняя/высокая: Rust-тулчейн, своя Steam-интеграция | Низкая, но устаревающий стек |
| Безопасность | Нужно настроить `contextIsolation`, preload, CSP | Лучше из коробки | Слабее по умолчанию (node в рендерере) |

### 10.2 Рекомендация

**Electron + steamworks.js; Steam-вызовы только в main-процессе, в рендерер через preload/IPC.**

Главная причина — одинаковый рендеринг на всех платформах. Игра с тяжёлыми CSS-анимациями, неоном и эмодзи-подобной графикой на WebKitGTK (Tauri на Linux/Deck) почти наверняка потребует отдельной отладки. Размер 100 МБ для Steam-игры не проблема. Tauri выигрывает только размером, а платит за него рисками overlay и Steam-интеграции. NW.js не даёт преимуществ перед Electron.

**Отвергнутые варианты:**
- Tauri. Вернуться к нему стоит, если появится официальный Steamworks-плагин и Deck-совместимость WebKitGTK будет подтверждена.
- greenworks. Проект фактически не развивается, сборки под новые Electron нужно собирать самим.

Решение обратимо: ядро и UI не знают о платформе (`platform/`), так что замена оболочки затрагивает только `desktop/` и `platform/`.

**Схема:**
```
desktop/                       # отдельный пакет или папка, не часть веб-сборки
├─ main.ts                     # BrowserWindow(contextIsolation: true, nodeIntegration: false, sandbox: true)
│                              # steamworks.init(APP_ID); ipcMain.handle('steam:unlock', …); ipcMain.handle('save:write', …)
├─ preload.ts                  # contextBridge.exposeInMainWorld('dodepaNative', { unlock, readSave, writeSave, … })
└─ steam_appid.txt             # только для dev (480 = Spacewar для экспериментов)
```
- Официальный README steamworks.js показывает `nodeIntegration: true` в рендерере. **Мы так не делаем**: только main + IPC, иначе открывается XSS → RCE.
- Vite: `base` берётся из env (`VITE_BASE=./` для десктопа, `/simulator-dodepa/` для Pages). Рендерер грузится через `file://` или custom protocol `app://`.
- `VITE_PLATFORM=web|desktop` выбирает `platform/*`. Веб-сборка не тянет ничего из Electron.
- Сборка установщиков: electron-builder (win nsis/dir, linux AppImage/dir, mac dmg), Steam depot заливается через SteamPipe (`steamcmd` + `app_build.vdf`) в CI как ручной workflow.

### 10.3 Облачные сохранения

- **Steam Auto-Cloud** (настройка в Steamworks, без кода): путь `%APPDATA%/SimulatorDodepa/save*.json` (Win), `~/.config/SimulatorDodepa/` (Linux), `~/Library/Application Support/SimulatorDodepa/` (Mac) через root overrides. Нужен **файловый** сейв (ADR-008, файловый `StorageAdapter`). LevelDB-хранилище `localStorage` Electron для облака не годится.
- Разрешение конфликтов берёт на себя Steam (диалог выбора). Поле `savedAt` и `version` помогает при ручном выборе.
- Вариант с кодом (ISteamRemoteStorage через steamworks.js) нужен только если понадобится своя логика мержа. Пока не требуется.

### 10.4 Достижения и статистика в Steam

- API Name = `AchievementDef.id` (ADR-006). Список заводится в Steamworks → Stats & Achievements. Генерируем его из `config/achievements.ts` скриптом (`tools/export-steam-achievements.ts`, P2), чтобы не было ручных расхождений.
- Progress-достижения через Steam Stats (INT), имена статов = ключи `PlayerStats`.
- Офлайн: клиент Steam кеширует и досылает. Плюс наш reconcile при старте.

---

### 10.5 Контент с гэмблингом: требования и позиция

> Точные формулировки анкеты доступны только в Steamworks-партнёрке, проверить их нужно при заполнении (задача TD-25). Ниже — то, что известно и что закладываем архитектурно.

1. **Steam Content Survey** (обязателен перед ревью билда и страницы). Первая часть генерирует возрастные рейтинги ряда региональных органов, вторая — раскрытие mature-контента, третья — использование генеративного ИИ. Описываем честно: *«Симуляция азартных игр (слот-машина, кредиты) на вымышленную внутриигровую валюту. Реальные деньги нельзя ни внести, ни вывести; внутриигровую валюту нельзя купить; никаких лутбоксов и платной случайности. Игра — сатира на лудоманию и содержит социальный посыл против азартных игр»*. Если при разработке использовался генеративный ИИ для контента, который видит игрок (тексты, арт), это нужно раскрыть в разделе AI. Вести учёт с первого дня.
2. **Правила Valve:** реальный гэмблинг, выплаты или «намёки на выплаты», ставки Steam-предметами запрещены. Нельзя ссылаться на реальные казино, давать промокоды или партнёрские ссылки. Симулированный гэмблинг на фейковую валюту в Steam присутствует (например, CloverPit, KEEP GAMBLING).
3. **Рейтинги:**
   - **PEGI:** с 2020 года симуляция игр, в которые играют в казино, даёт **PEGI 18**. После пересмотра Balatro в 2025 PEGI разрабатывает более гранулярные критерии, но реалистичная симуляция казино остаётся 18.
   - **Австралия:** с 22.09.2024 симулированный гэмблинг — минимум R18+.
   - **Южная Корея (GRAC):** исторически жёсткая позиция к симуляции гэмблинга, возможен отказ в рейтинге. Держим в уме исключение региона.
   - **Вывод для владельца:** планируем аудиторию 18+, это согласуется с сатирическим тоном.
4. **Архитектурные гарантии, которые защищают рейтинг:**
   - в коде нет платёжных интеграций и Steam Microtransactions API;
   - косметика только за достижения;
   - нет «гачи» за реальные деньги;
   - DLC, если появится, не продаёт валюту и шансы.
   Всё это фиксируем как **технический запрет** в CLAUDE.md после утверждения.
5. **Редизайн «под сайт онлайн-казино»:** не имитировать реальные бренды, логотипы и названия (риск товарных знаков и отказа Valve по «impersonation»). Только вымышленные пародийные бренды. Это ограничение для Creative и art-director, повторяю его в задачах.

---

## 11. Совместная работа с редизайном (Creative Director)

- Контракт стора (ADR-001/002) фиксируется **первым**, до переделки компонентов. Иначе редизайн будет рефакторить код, который тут же поменяется.
- Токены (ADR-007) вводятся **параллельно**: ui-programmer и technical-artist переводят литералы цветов в `var(--…)` без изменения вида. Редизайн после этого — в основном новая тема плюс новая вёрстка.
- Все числа на экране (стоимости, диапазоны, RTP) берутся из `config` и функций ядра.

## 12. Метрики успеха архитектуры

«Решение было правильным», если:
- новое достижение на существующих статах добавляется **одной записью в конфиге** без правок стора и компонентов;
- новая тема добавляется одним CSS-файлом и одной записью в `cosmetics.ts`;
- правка шанса выигрыша или стоимости действия — **одно место**, и все подписи в UI и гайде обновляются сами;
- в `src/game/**` нет `Math.random`, `window`, `localStorage` (проверяется в CI);
- сейв веб-игрока с версии `eb138e2` загружается без потерь после рефакторинга;
- перенос в Electron затрагивает только `desktop/`, `platform/` и `vite.config.ts`.

---

**Источники (Steam/рейтинги/упаковка):**
[Steamworks: Content Survey](https://partner.steamgames.com/doc/gettingstarted/contentsurvey) ·
[Skala: Age Ratings guide](https://www.skala.io/blog/age-ratings-for-games-a-practical-guide-for-game-development-startups) ·
[PEGI: Gambling](https://pegi.info/gambling) ·
[Game Developer: gambling → PEGI 18](https://www.gamedeveloper.com/business/gambling-in-your-game-will-now-automatically-land-it-a-pegi-18-rating) ·
[PEGI: Balatro reclassification](https://pegi.info/news/pegi-complaints-board-amends-classifications-balatro-and-luck-be-landlord-pegi-12) ·
[Reed Smith: PEGI interactive risk categories](https://www.reedsmith.com/articles/pegi-launches-interactive-risk-categories-overhauls-age-ratings-for-loot-boxes-in-game-spending-and-communication-features/) ·
[Game Developer: Steam bans gambling (Code of Conduct)](https://www.gamedeveloper.com/business/steam-bans-gambling-with-new-conduct-changes) ·
[CloverPit (Wikipedia)](https://en.wikipedia.org/wiki/CloverPit) ·
[KEEP GAMBLING (Steam)](https://store.steampowered.com/app/3720460/KEEP_GAMBLING/) ·
[ceifa/steamworks.js](https://github.com/ceifa/steamworks.js/) ·
[steamworks-ffi-node](https://dev.to/arty_prof/steamworks-ffi-node-a-steamworks-sdk-library-for-javascript-game-frameworks-15h1) ·
[greenworks](https://github.com/greenheartgames/greenworks) ·
[Tauri issue #6196: Steam Overlay](https://github.com/tauri-apps/tauri/issues/6196) ·
[Narrat: Steam publishing](https://docs.narrat.dev/guides/steam-publishing.html)
