# Технический backlog — «Симулятор Додепа»

- **Автор:** Technical Director · **Дата:** 2026-09-25
- **Основание:** `production/technical-audit.md` (баги B-xx, долг D-xx, риски R-xx), `production/architecture.md` (ADR-001…010)
- **Приоритеты:**
  - **P0** — эта итерация, фундамент до или одновременно с геймплеем и редизайном;
  - **P1** — следующая итерация или перед Steam-демо;
  - **P2** — Steam-порт.
- **Общие правила для всех задач:**
  - PR проходит `npm run type-check` и `npm test` (после TD-02);
  - в `src/game/**` запрещены `Math.random`, `window`, `localStorage`, импорты `vue`;
  - числа баланса — только в `src/game/config/`;
  - изменения формы сейва — только через миграцию (TD-07).

---

## Порядок P0 (критический путь)

```
TD-01 ─┐
TD-02 ─┼─► TD-03 ─► TD-04 ─► TD-06 ─► TD-05 ─► TD-14
       │                        │         └──► TD-10 ─► TD-11 ─► TD-12
       │                        └──► TD-07 ◄───────────────┘ (profile-секции)
       │                        └──► TD-15 (значения — economy-designer)
TD-08 (сразу, независимо)   TD-09 (после TD-06)   TD-13 (сразу, параллельно)   TD-28 (сразу)
```

Параллелизация:
- **ui-programmer** стартует с TD-08 и TD-13;
- **tools-programmer** — с TD-02;
- **gameplay-programmer** — с TD-03 и TD-04;
- **lead-programmer** — с TD-01, ревью контракта TD-06;
- **qa-lead** — с TD-28.

---

## P0 — эта итерация

### TD-01 · Удалить мёртвый код и устаревшие ссылки
- **Исполнитель:** lead-programmer · **Приоритет:** P0 · **Зависимости:** —
- **Цель:** убрать шум перед рефакторингом (D-01, D-02).
- **Критерии приёмки:**
  - удалены `src/stores/counter.ts` и `src/components/BetPanel.vue`;
  - `grep -rn "useCounterStore\|BetPanel" src` пуст;
  - мёртвые экшены стора `playCasino`/`repayDebt` помечены на удаление в TD-05/TD-06 (не удалять раньше, чем появится замена);
  - type-check и build проходят.

### TD-02 · Vitest + CI для PR
- **Исполнитель:** tools-programmer (Vitest), devops-engineer (CI) · **Приоритет:** P0 · **Зависимости:** —
- **Цель:** тестовая инфраструктура и проверки до мержа (D-12, ADR-009).
- **Критерии приёмки:**
  - devDependencies: `vitest`, `@vitest/coverage-v8`; `vitest.config.ts` переиспользует алиас `@` из `vite.config.ts` (`mergeConfig`);
  - скрипты `test` (`vitest run`), `test:watch`, `coverage`;
  - порог покрытия для `src/game/**` — 90 % строк; пока файлов мало, порог включается флагом после TD-05;
  - `tsconfig.vitest.json` (или include в `tsconfig.app.json`) — тесты типизированы, `npm run type-check` их проверяет. Сейчас `tsconfig.app.json` исключает `src/**/__tests__/*` — принять решение и задокументировать; рекомендация — `*.test.ts` рядом с модулем;
  - есть хотя бы один smoke-тест на текущий `casinoGame.ts` (например `createDefaultState`);
  - `.github/workflows/ci.yml` на `pull_request` и `push`: `npm ci → type-check → test → build-only`, Node 22;
  - `deploy.yml` запускает `npm test` перед `npm run build`; красные тесты блокируют деплой.

### TD-03 · Инжектируемый seeded RNG
- **Исполнитель:** gameplay-programmer · **Приоритет:** P0 · **Зависимости:** TD-02
- **Цель:** детерминированная логика для тестов, воспроизводимость, честная статистика (D-06, ADR-003).
- **Критерии приёмки:**
  - `src/game/rng.ts`:
    - `interface Rng { next(); int(min,max); state() }`;
    - `createRng(seed)` (sfc32 или mulberry32, без зависимостей);
    - `randomSeed()` на `crypto.getRandomValues`;
  - все функции `casinoGame.ts` принимают `rng` (через `GameContext`); `grep -rn "Math.random" src/game` пуст;
  - тесты: одинаковый seed → одинаковая последовательность; `int` в границах; распределение `next()` в 10 бакетах в пределах ±2 % на 10⁵ выборках.

### TD-04 · Data-driven конфиг баланса и слота
- **Исполнитель:** gameplay-programmer (config + ядро), ui-programmer (перевод компонентов и HowToPlay) · **Приоритет:** P0 · **Зависимости:** TD-03
- **Цель:** одно место для всех чисел; UI и гайд не могут разойтись с логикой (D-05, B-13, ADR-004).
- **Критерии приёмки:**
  - `src/game/config/balance.ts`: стартовое состояние, стоимости, базы наград, репутационные коэффициенты, лимиты, минимальная ставка, погашение;
  - `src/game/config/slot.ts`: таблица исходов с весами (ADR-001), список `SymbolId`, `expectedRtp(config)`;
  - всё типизировано `as const satisfies`;
  - в `WorkPanel/FriendPanel/BankPanel/SlotMachine.vue` нет числовых литералов баланса (проверить grep `= 5$|= 10$|= 15$|1000|min="50"`);
  - подписи кнопок и `disabled` строятся через `canExecute(state, cmd, config)` из ядра;
  - `HowToPlay.vue` выводит диапазоны наград, RTP и шанс джекпота из конфига через функции ядра (`rewardRange`);
  - тест: `expectedRtp(defaultConfig)` = 0.34 (текущий баланс, до правок economy-designer).

### TD-05 · Единый источник правды для спина (атомарный спин)
- **Исполнитель:** gameplay-programmer (ядро и стор), ui-programmer (SlotMachine) · **Приоритет:** P0 · **Зависимости:** TD-04, TD-06
- **Цель:** исход считает только ядро, стор применяет его атомарно, UI только анимирует (B-02, B-03, B-04, ADR-001).
- **Критерии приёмки:**
  - команда `slot/spin` в ядре возвращает `SpinResult { bet, outcomeId, multiplier, payout, reels: SymbolId[3] }` и события;
  - списание ставки и начисление выплаты происходят в одном `dispatch`;
  - `store.spin()` применяет состояние и **сохраняет до начала анимации**;
  - удалены `placeBet`, `handleSlotResult`, эмиты `bet-placed`/`spin-result`, импорт `calculateSlotWinAmount` и `SLOT_WIN_CHANCE` в `SlotMachine.vue`; в компоненте нет `Math.random` для исхода;
  - баланс и тост в UI обновляются после окончания анимации (`displayedMoney`/`revealPending` в ui-сторе);
  - F5 во время вращения → после загрузки деньги соответствуют результату, событие есть в хронике;
  - тесты:
    - ставка < minBet или > money отклоняется без изменения состояния;
    - payout — целое ≥ 0;
    - при `lose` на барабанах не три одинаковых;
    - при `jackpot` три `seven`;
    - Монте-Карло 10⁵ (seed) в ±1 % от `expectedRtp`.

### TD-06 · Command/Event pipeline и единое состояние стора
- **Исполнитель:** lead-programmer (контракт типов, ревью), gameplay-programmer (реализация) · **Приоритет:** P0 · **Зависимости:** TD-03
- **Цель:** убрать дублирование `runAction`/`repayDebtAmount`, различать успех и отказ, дать события для статистики и достижений (D-03, D-04, D-08, D-09, ADR-002).
- **Критерии приёмки:**
  - `src/game/types.ts`: `RunState`, `Command`, `GameEvent`, `ActionResult`, `GameContext`; `dispatch(state, cmd, ctx)` — единственная точка входа;
  - стор `src/stores/game.ts` хранит `run` одним объектом, **один** метод `execute(cmd)`; `runAction`/`repayDebtAmount`/5 отдельных refs удалены;
  - `CasinoUI.vue`: типизированные `defineEmits` или прямой доступ к стору через composable, дубль `interface Stats` удалён;
  - отказ (`rejected` с `reason`) визуально отличается от успеха (класс или тон в хронике), тексты через форматтер;
  - контракт стора описан в JSDoc; ui-programmer и Creative-треки работают поверх него (риск R-01).

### TD-07 · Сейв v1: версия, миграции, валидация, StorageAdapter
- **Исполнитель:** lead-programmer; ревью валидации — security-engineer · **Приоритет:** P0 · **Зависимости:** TD-06 (форма RunState); секции `profile` — пустые заготовки под TD-11/12/13
- **Цель:** безопасная эволюция сейва и подготовка к файловому хранилищу и Steam Cloud (D-07, B-07, B-09, B-11, R-02, ADR-005, ADR-008).
- **Критерии приёмки:**
  - `SaveFileV1 { version, savedAt, build, run, profile, settings }`; ключ `dodepa.save` + `dodepa.save.bak`;
  - миграция legacy `dodepaSave` → v1; старый ключ удаляется только после успешной записи v1;
  - `validate()` на ручных guard'ах: невалидное поле → дефолт (не сброс всего сейва); `NaN`, строки, дроби, отрицательные числа нормализуются через `applyInvariants`;
  - сейв с `version > CURRENT` не перезаписывается, показывается предупреждение;
  - `src/platform/storage.ts`: `StorageAdapter` (async read/write/readBackup), веб-реализация на localStorage с try/catch (QuotaExceeded, приватный режим);
  - `App.vue` не обращается к `localStorage` напрямую; `hasSave` — реактивный геттер стора;
  - в сборку прокинута версия: `define: { __APP_VERSION__ }` из `package.json`;
  - тесты на фикстурах:
    - legacy нормальный;
    - legacy с `"money":"abc"`;
    - legacy с `NaN`/`null`;
    - битый JSON (→ бэкап → дефолт);
    - пустой;
    - v1 round-trip;
    - «будущая» версия.

### TD-08 · Исправить «Выйти в меню» (потеря прогресса) и двойной старт
- **Исполнитель:** ui-programmer · **Приоритет:** P0 (S1, делать сразу) · **Зависимости:** — (сначала hotfix в текущем коде, затем перенос на новый стор в TD-06)
- **Цель:** B-01, B-12.
- **Критерии приёмки:**
  - «🏠 Выйти в меню» только меняет экран, состояние и сейв не трогает;
  - сброс прогресса — отдельное действие («Новая игра» в меню) с подтверждением;
  - «Продолжить» после выхода в меню восстанавливает деньги, энергию, репутацию и долг;
  - повторный клик во время перехода игнорируется (флаг `isTransitioning` проверяется в `startTransition` и `handleStartGame`);
  - один звук перехода.
- **Примечание:** hotfix можно выкатить на GitHub Pages отдельным PR до остального P0.

### TD-09 · Банк: погашение остатка долга и валидация ввода
- **Исполнитель:** gameplay-programmer (правило), ui-programmer (инпут) · **Приоритет:** P0 · **Зависимости:** TD-06
- **Цель:** B-08, B-09.
- **Критерии приёмки:**
  - если `debt < minRepay`, можно погасить остаток целиком, и для этого нужно `money ≥ debt`, а не ≥ 1000;
  - сумма погашения нормализуется ядром (`floor`, `clamp` к `[min(minRepay, debt), min(debt, money)]`);
  - инпуты ставки и погашения не допускают дробей и пустых значений (при blur ставится валидное значение);
  - дробные деньги в состоянии невозможны (инвариант TD-15);
  - тесты: остаток 234 при деньгах 300 погашается полностью; 1000.5 → 1000; пустой инпут → отказ без изменения состояния.

### TD-10 · Доменные события и структурированная хроника
- **Исполнитель:** gameplay-programmer · **Приоритет:** P0 · **Зависимости:** TD-06
- **Цель:** хроника и будущие статистика, достижения, звук и тосты строятся из событий (D-08, D-16).
- **Критерии приёмки:**
  - `LogEntry { id, t, event: GameEvent }`, лимит 50;
  - `formatEvent(event, locale)` в `src/i18n/`; пока только `ru`, но все строки хроники проходят через него;
  - `LogsList.vue` использует `:key="entry.id"`;
  - legacy-строки из старого сейва отображаются через `{ type: 'legacyText' }`;
  - тест: каждый тип события форматируется без `undefined` в строке.

### TD-11 · Модуль статистики игрока (run + lifetime)
- **Исполнитель:** gameplay-programmer · **Приоритет:** P0 · **Зависимости:** TD-10, TD-07
- **Цель:** фундамент для достижений, мета-прогрессии и «честного» сатирического экрана RTP (ADR-003, ADR-005).
- **Критерии приёмки:**
  - `PlayerStats` (список в `architecture.md` ADR-005), только числа;
  - `reduceStats(stats, event)` — чистая функция, обновляет `run.stats` и `profile.stats`;
  - `totalWagered`/`totalPaidOut` дают фактический RTP игрока;
  - на первой загрузке legacy-сейва статистика начинается с нуля (задокументировать);
  - тесты: последовательность событий → ожидаемые счётчики; `longestLoseStreak` корректно сбрасывается выигрышем.
  - UI экрана статистики — в треке Creative/ui, здесь только данные и геттеры.

### TD-12 · Движок достижений (data-driven, Steam-ready)
- **Исполнитель:** gameplay-programmer (движок), ui-programmer (тост и экран-заглушка) · **Приоритет:** P0 · **Зависимости:** TD-11
- **Цель:** достижения добавляются записью в конфиге; id напрямую маппятся на Steam API Names (ADR-006).
- **Критерии приёмки:**
  - `src/game/config/achievements.ts` с типом `AchievementDef`:
    - `id` UPPER_SNAKE, проверяется тестом регуляркой `^[A-Z0-9_]+$`, уникальность тоже проверяется тестом;
    - поля `hidden`, `condition` (stat | event), `reward`, `steam?`;
  - `evaluateAchievements()` — чистая и идемпотентная;
  - стор: запись в `profile.achievements`, выдача награды, очередь тостов, вызов `platform.achievementsSink.unlock(id)` (веб — noop);
  - 3–5 технических достижений-примеров (например `FIRST_SPIN`, `FIRST_JACKPOT`, `DEBT_10K`); финальный список, тексты и награды даёт Creative;
  - прогресс для stat-условий доступен геттером `achievementProgress(id)` → 0..1.

### TD-13 · Дизайн-токены и система тем и скинов (инфраструктура)
- **Исполнитель:** ui-programmer; technical-artist (токены, ассеты-заглушки) · **Приоритет:** P0 (параллельно с редизайном) · **Зависимости:** — (данные unlock/equip подключаются после TD-07/TD-12)
- **Цель:** редизайн и косметика строятся на CSS-переменных и конфиге (D-10, ADR-007).
- **Критерии приёмки:**
  - `src/styles/tokens.css` — полный набор токенов (цвета, градиенты, свечения, радиусы, шрифты, `--reel-size`);
  - в scoped-стилях компонентов нет hex/rgba литералов цветов: `grep -rnE "#[0-9a-fA-F]{3,6}|rgba?\(" src/components` → только внутри `var()` fallback или 0 результатов;
  - вид при этом не меняется (скриншот до/после);
  - `[data-theme]` на `<html>`, `useTheme()`; одна демо-тема помимо default;
  - `src/game/config/cosmetics.ts`: `THEMES`, `SLOT_SKINS` (скин маппит `SymbolId` → ассет); тест «каждый скин покрывает все символы слота»;
  - `profile.cosmetics.owned/equipped`, экшен `equip` с проверкой владения;
  - разблокировка через `reward.cosmetic` достижения.

### TD-14 · SlotMachine: анимация без спойлера и хардкода
- **Исполнитель:** ui-programmer · **Приоритет:** P0 · **Зависимости:** TD-05, TD-13
- **Цель:** B-10, перф-замечания аудита §3.
- **Критерии приёмки:**
  - в первый кадр вращения итоговые символы не видны: лента начинается с символа, показанного до спина, итог только в конце;
  - высота символа берётся из `--reel-size` (computed style или ResizeObserver), а не из `window.innerWidth <= 640 ? 70 : 80`;
  - анимация через WAAPI или CSS transition на `transform`, без реактивного обновления каждый rAF; лента символов вычисляется один раз на спин;
  - поддержка `prefers-reduced-motion` и настройки `skipSpinAnimation` (мгновенный результат);
  - символы рисуются по `SymbolId` через активный скин;
  - 60 fps во время спина в Chrome DevTools (4× CPU throttle) без long tasks > 50 мс.

### TD-15 · Инварианты состояния и защита экономики
- **Исполнитель:** gameplay-programmer; значения — economy-designer · **Приоритет:** P0 · **Зависимости:** TD-06; значения ждут дизайна Creative/economy
- **Цель:** B-05, B-06, B-07.
- **Критерии приёмки:**
  - `applyInvariants(state, config)` после каждой команды и при загрузке: целые числа; `money, debt ≥ 0`; `energy ∈ [0, maxEnergy]`; `reputation ∈ [repMin, repMax]`; `bet ≥ minBet`;
  - `calculateReward` никогда не < 0 (`guaranteedPercent` зажат в диапазон из конфига);
  - «темка» имеет условие доступности или убывающую отдачу — по решению economy-designer;
  - F5 не меняет состояние (тест: `load(save(state))` ≡ `state`);
  - регресс-тест B-06: цикл «мин. ставка → темка» на seed за 1000 итераций не превышает порог, заданный economy-designer.

### TD-28 · QA: план регресса рефакторинга P0
- **Исполнитель:** qa-lead (план), qa-tester (прогон) · **Приоритет:** P0 · **Зависимости:** план — сразу; прогон — после TD-05/06/07/08
- **Цель:** рефакторинг ядра не ломает игру и сейвы веб-игроков (R-01, R-02).
- **Критерии приёмки:**
  - `production/qa/regression-p0.md`: чек-лист (меню, новая игра, продолжить, выход в меню, спин/выигрыш/джекпот/проигрыш, F5 во время спина, все действия панелей, банк с остатком < 1000, мобильный 375 px, Safari iOS, Firefox);
  - набор реальных legacy-сейвов (JSON-фикстуры) передан в TD-07;
  - прогон на превью-сборке до мержа P0 в `main`; баги заведены с ссылкой на TD.

---

## P1 — следующая итерация / перед Steam-демо

| ID | Задача | Исполнитель | Зависимости | Критерии приёмки (кратко) |
|---|---|---|---|---|
| TD-16 | **Симулятор экономики (CLI)**. Желательно начать сразу после TD-06 — нужен economy-designer для ребаланса. | tools-programmer | TD-05, TD-06, TD-15 | `npm run sim -- --seed 1 --strategy greedy --steps 10000` на ядре. Выводит RTP, траекторию денег/долга, найденные циклы-эксплойты. 3+ стратегии бота (осторожный, лудоман, эксплойтер). CSV-вывод для таблиц economy-designer. |
| TD-17 | Обновить README_RU/README под реальную игру и архитектуру, удалить ссылки на несуществующие документы (B-13) | lead-programmer | P0 | Описание механик генерируется или сверено с конфигом. Есть раздел «Архитектура» со ссылкой на `production/architecture.md`. |
| TD-18 | ESLint (flat config, `eslint-plugin-vue`, `typescript-eslint`) + Prettier + архитектурные правила | tools-programmer | TD-02 | `no-restricted-properties` для `Math.random` в `src/game`. `no-restricted-imports`: game ↛ vue/platform/components. `no-restricted-globals` для `localStorage` вне `src/platform`. Проверка в CI. |
| TD-19 | Аудио-менеджер: музыка и SFX, настройки громкости в `settings`, очистка `useBackgroundMusic` (B-14) | ui-programmer (+ sound-designer по ассетам) | TD-07 | Нет лишнего `AudioContext`. Слушатели снимаются в `onUnmounted`. Громкость и mute сохраняются. SFX спина/выигрыша/джекпота привязаны к событиям (TD-10) и берутся из скина. Ассеты `.ogg`/`.mp3` ≤ 300 КБ каждый, кроме музыки. |
| TD-20 | i18n: ru + en | localization-lead (процесс), ui-programmer (внедрение) | TD-10 | Все строки UI в `src/i18n/{ru,en}.ts` с типизированными ключами. Проверка «нет кириллицы в шаблонах вне i18n» (скрипт или lint). Переключение языка в настройках. Выбор: собственный словарь или `vue-i18n` — решает lead-programmer, рекомендация: vue-i18n ради плюрализации («1 спин / 5 спинов»). |
| TD-21 | Заменить эмодзи-символы собственными SVG/спрайтами (D-11, R-05) | technical-artist + ui-programmer | TD-13, TD-14 | Слот и меню не зависят от системного emoji-шрифта. Одинаковый вид на Win/Linux/Deck. Ассеты через `import.meta.glob`. Если используются сторонние (Twemoji, CC-BY 4.0) — атрибуция в титрах. |
| TD-22 | Конфигурируемый `base` и платформа сборки | devops-engineer | — | `VITE_BASE`, `VITE_PLATFORM` в `vite.config.ts`. `npm run build:web` (Pages, как сейчас) и `npm run build:desktop` (`base: './'`). Сборка desktop открывается через `file://` без 404. |
| TD-25 | Чек-лист соответствия Steam и рейтингам: content survey, раскрытие симулированного гэмблинга, AI-disclosure, PEGI 18 / AU R18+ / Корея, запрет реальных брендов и платной случайности (architecture.md §10.5) | release-manager (+ producer, консультация security-engineer) | — | `production/steam-compliance.md` с черновиком ответов анкеты. Решение по регионам. Правило «нет платежей, лутбоксов и реальных брендов» внесено в CLAUDE.md после одобрения владельца. |
| TD-26 | Перф-аудит и бюджет | performance-analyst | TD-14 | Замеры по бюджету (audit §3): fps спина, переход (`font-size` → `transform: scale`), меню с «снегопадом» на слабом ноутбуке и Deck (браузер), размер бандла. Отчёт с регрессионными порогами. `rollup-plugin-visualizer` в dev-зависимостях. |
| TD-29 | Доступность: клавиатура (Space — спин), `aria-live` для результата, контраст токенов, reduced-motion | accessibility-specialist (аудит) + ui-programmer | TD-13, TD-14 | Спин, модалки и панели доступны без мыши. Фокус-ловушка в модалке. Контраст текста ≥ 4.5:1 во всех темах. |
| TD-31 | Версионирование и релизы | release-manager + devops-engineer | TD-07 | SemVer в `package.json` (старт 0.1.0). Версия в меню и в сейве (`build`). `CHANGELOG.md`. Git-тег на каждый деплой. |
| TD-32 | Мета-прогрессия: конец забега (банкротство или «выход»), перенос в профиль, мета-валюта и апгрейды — по дизайну Creative | gameplay-programmer | TD-11, TD-12, дизайн Creative | `runEnded`-событие. Профиль переживает новую игру. «Новая игра» сбрасывает только `run`, а «Сброс всего» — профиль (с двойным подтверждением). Тесты перехода. |

---

## P2 — Steam-порт

| ID | Задача | Исполнитель | Зависимости | Критерии приёмки (кратко) |
|---|---|---|---|---|
| TD-23 | **Spike:** Electron-оболочка + steamworks.js (AppID 480 Spacewar) | devops-engineer + engine-programmer | TD-22 | `desktop/main.ts` с `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Steam-вызовы только в main через IPC. Разблокировка тестового достижения. Работает Steam Overlay (Shift+Tab). Запуск на Windows и на Steam Deck (Proton или нативный Linux). Отчёт: размер, RAM, старт, проблемы. Альтернатива при проблемах — steamworks-ffi-node. |
| TD-24 | Файловый `StorageAdapter` для десктопа + Steam Auto-Cloud | engine-programmer | TD-07, TD-23 | Атомарная запись (tmp + rename), бэкап, пути в `app.getPath('userData')`. Конфигурация Auto-Cloud задокументирована. Проверка синхронизации между двумя машинами. |
| TD-27 | Security-ревью десктоп-сборки | security-engineer | TD-23 | CSP без `unsafe-eval`. Минимальный preload API. Запрет навигации и `window.open` на внешние URL. Electron fuses (`RunAsNode` off и т.д.). Зависимости без критических CVE (`npm audit` в CI). |
| TD-33 | `AchievementSink` для Steam + reconcile при старте + экспорт списка достижений для Steamworks | gameplay-programmer + tools-programmer | TD-12, TD-23 | `unlock(id)` → Steam. При старте все локальные достижения повторно активируются. Скрипт `tools/export-steam-achievements.ts` выдаёт таблицу API Names, флагов hidden и stat-связок из `config/achievements.ts`. |
| TD-34 | Сборка и заливка: electron-builder + SteamPipe (`steamcmd`, `app_build.vdf`) ручным workflow | devops-engineer + release-manager | TD-23, TD-31 | Win/Linux(/Mac) depot. Секреты Steam только в GitHub Secrets. Ветки `beta`/`default` в Steamworks. Чек-лист Steam Deck Verified (контроллер, текст ≥ 9 px при 1280×800, без внешних лаунчеров). |
| TD-35 | Поддержка геймпада и Steam Input / Deck | ui-programmer | TD-29 | Навигация фокусом по всем экранам с геймпада. Экранная клавиатура для числовых полей или шаговые кнопки ± вместо ввода. |

---

## Сводка P0 по исполнителям

| Исполнитель | Задачи P0 |
|---|---|
| lead-programmer | TD-01, TD-06 (контракт и ревью), TD-07 |
| gameplay-programmer | TD-03, TD-04 (ядро), TD-05 (ядро и стор), TD-06 (реализация), TD-09 (правило), TD-10, TD-11, TD-12 (движок), TD-15 |
| ui-programmer | TD-08, TD-04 (компоненты, HowToPlay), TD-05 (SlotMachine), TD-09 (инпут), TD-12 (тост), TD-13, TD-14 |
| tools-programmer | TD-02 (Vitest) |
| devops-engineer | TD-02 (CI) |
| technical-artist | TD-13 (токены, заглушки ассетов) |
| economy-designer | TD-15 (значения лимитов и порог эксплойта) |
| security-engineer | TD-07 (ревью валидации) |
| qa-lead / qa-tester | TD-28 |

**Риск перегруза:** gameplay-programmer — узкое место (9 задач). Если его пропускная способность ограничена, TD-10/TD-11/TD-12 передаются lead-programmer или второму gameplay-программисту. Порядок критического пути не меняется.
