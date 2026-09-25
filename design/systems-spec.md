# Системная спецификация: тильт, честная статистика, достижения, косметика, мета-профиль

- **Автор:** Systems Designer · **Дата:** 2026-09-25 · **Статус:** v1, на ревью (game-designer, economy-designer, technical-director)
- **Задачи:** CD-09 (тильт и честная статистика) + мета-слой для CD-10, CD-13, CD-17, CD-19.
- **Источники:** `design/creative-vision.md` (далее **CV**), `production/tasks-creative.md`, `production/architecture.md` (ADR-002, 005, 006, 007, 008).
- **Решения владельца, на которых стоит документ:** ран 28 дней с выбором «ЗАВЯЗАТЬ / ЕЩЁ НЕДЕЛЮ»; RTP слота 90%.
- **Файлы:** CD-09 просит два файла (`design/systems/tilt.md`, `design/systems/honest-stats.md`). По указанию оркестратора всё собрано в одном `design/systems-spec.md`: §2 — это tilt, §3 — это honest-stats.

**Метки.** **[CV]** — число или правило взято из CV как есть. **[SD]** — предложение Systems Designer, economy-designer может обнулить или перетюнить. **[?]** — нужно решение (§7).

---

## 0. Конвенции

1. Деньги — целые ₽. Округление всегда `Math.floor`, если не указано иначе. Проценты в UI показываются с 1 знаком после запятой.
2. `clamp(x, a, b) = min(max(x, a), b)`.
3. Все счётчики статистики — целые числа ≥ 0 и **монотонные**: только растут или берут максимум. Это нужно для Steam Stats (ADR-006). Производные величины (RTP, итог, эквиваленты) **не хранятся**, а считаются геттерами.
4. Все числа из этого документа уходят в `src/game/config/balance.ts` под указанными именами констант. Тексты уходят в `src/game/content/` (CD-11).
5. Id: достижения — `UPPER_SNAKE`, это Steam API Name, после релиза не меняются. Косметика — `kind:snake_id`. Концовки и символы — `snake_case`.
6. Слот, таблица v1 [CV §6.2]. Её владелец — CD-02, здесь она нужна только для расчётов.

| outcomeId | mult | p | Вклад в RTP |
|---|---|---|---|
| `lose` | 0 | 0.666 | 0 |
| `x0_5` (LDW) | 0.5 | 0.120 | 0.060 |
| `x1` | 1 | 0.080 | 0.080 |
| `x2` | 2 | 0.060 | 0.120 |
| `x5` | 5 | 0.050 | 0.250 |
| `x10` | 10 | 0.019 | 0.190 |
| `x25` | 25 | 0.004 | 0.100 |
| `x100` (777) | 100 | 0.001 | 0.100 |
| **Σ** | | 1.000 | **0.900** |

Выводы из таблицы, на которые опираются формулы ниже:
- `P_LOSS_LIKE` = P(mult < 1) = 0.786 (проигрыш + LDW);
- `P_REAL_WIN` = P(mult > 1) = 0.134;
- `P_SHOWCASE_WIN` = P(payout > 0) = 0.334.

---

## 1. Доменные события (контракт для `GameEvent`)

Статистика, тильт-UI, достижения и Выписка работают **только** на этих событиях и на `RunState`. Ядро обязано эмитить их из `dispatch`. Имена полей обязательны, порядок полей не важен.

| Событие | Поля | Когда |
|---|---|---|
| `runStarted` | `runId, seed` | новая игра |
| `dayStarted` | `day, week` | после утренних тиков |
| `slept` | `day, casinoNight: bool` | конец дня (обычный сон или «Ночь») |
| `spin` | `bet, outcomeId, multiplier, payout, ldw, nearMiss, allIn, energyCost, tiltBefore, casinoBalanceBefore, casinoBalanceAfter, bonusLocked` | каждый спин. `allIn = bet === casinoBalanceBefore` (ядро определяет по равенству, а не по кнопке) |
| `deposit` | `amount` | кошелёк → казино |
| `bonusGranted` | `deposit, bonus, wagerRequired` | первый деп с бонусом |
| `bonusCleared` | `released` | вейджер отыгран |
| `bonusBusted` | `balanceLeft` | во время блокировки баланс казино стал < `MIN_BET` |
| `withdrawRequested` | `gross, fee, net` | заказ вывода |
| `withdrawPaid` | `net` | утро, деньги пришли в кошелёк |
| `shiftWorked` | `pay` | смена |
| `schemeResolved` | `success, amount, fine, jailed` | темка |
| `friendBorrowed` | `amount` | занял у друзей |
| `friendsBlocked` | — | переход в «Вы заблокированы» (❤️ ≤ 0 или нет телефона при попытке) |
| `familyHelped` | — | помог семье |
| `loanTaken` | `lender: 'bank'｜'mfo', amount` | кредит |
| `interestAccrued` | `lender, amount` | сон |
| `debtRepaid` | `amount` | погашение |
| `itemPawned` | `itemId, amount` | ломбард |
| `itemRedeemed` | `itemId, cost, pawnAmount` | выкуп |
| `livingCostPaid` | `amount` | сон, 300₽ |
| `billPaid` | `week, amount, late: bool` | оплата счёта |
| `billDeferred` | `week, penalty` | отсрочка +50% |
| `sleepEventShown` / `sleepEventResolved` | `eventId` / `eventId, choice` | карточки |
| `tiltChanged` | `value, delta, source: TiltSource` | только если `delta ≠ 0` после clamp |
| `tiltStageChanged` | `from, to: TiltStage` | смена стадии |
| `casinoNight` | `n, lost` | тильт достиг 100 |
| `weekChoice` | `choice: 'quit'｜'one_more_week', week` | день 7k при k ≥ 4 |
| `runEnded` | `endingId: EndingId｜'abandoned', grade?: 'A'｜'B'｜'C', day` | конец рана |

**Мета-команды** приходят из UI, не меняют `RunState` и меняют только счётчики:
- `meta/tick { playSec, underbellySec }` — стор отправляет раз в 10 с (§3.6);
- `meta/fakeTimerExpired` — врущий таймер дошёл до 00:00;
- `meta/equip { slot, cosmeticId }`.

`EndingId = 'quit' | 'collectors' | 'jail' | 'family_left' | 'minimalism' | 'lost_week' | 'referral'`. Семь концовок из CV §6.4. `lost_week` — это «Ночь в казино ×3». Условия и приоритеты задаёт CD-01.

---

## 2. Тильт 🔥

### 2.1 Модель

- `run.tilt: int ∈ [0, 100]`, на старте рана 0.
- `run.dayTiltMax: int` — максимум тильта за текущий день. Нужен для статистики.
- `stage(T)`:

| Стадия | Диапазон |
|---|---|
| `calm` | 0–39 |
| `heated` | 40–69 |
| `tilt` | 70–99 |
| `night` | 100 (мгновенная) |

**Главный инвариант.** Тильт не участвует в определении исхода спина. Сигнатура `resolveSpin(bet, rng, slotConfig)` **не получает** `RunState` и тильт. Это гарантировано структурно, а не условием `if`. Тильт влияет только на:
- (a) подачу: UI, текст, звук;
- (b) два детерминированных правила из CV §6.3: стоимость спина в ⚡ и «Ночь в казино».

Ни одно из них не трогает RNG, веса, выплаты и вероятности. Подробнее — §2.6.

### 2.2 Источники и стоки

| source (`TiltSource`) | Δ | Константа | Условие | Метка |
|---|---|---|---|---|
| `spin_loss` | +8 | `TILT_LOSS` | `spin`, `multiplier = 0` | [CV] |
| `spin_ldw` | +8 | `TILT_LOSS` | `spin`, `ldw` (0.5x): для тильта это проигрыш | [CV] |
| `spin_push` | 0 | — | `spin`, 1x | [SD] |
| `spin_win` | −3 | `TILT_WIN` | `spin`, `multiplier ≥ 2` | [CV] |
| `all_in` | +5 | `TILT_ALL_IN` | `spin` с `allIn`, **добавляется** к исходу спина | [CV] |
| `sleep` | −25 | `TILT_SLEEP` | обычный сон | [CV] |
| `family` | −15 | `TILT_FAMILY` | `familyHelped` | [CV] |
| `shift` | −10 | `TILT_SHIFT` | `shiftWorked` | [CV] |
| `scheme_fail` | +10 | `TILT_SCHEME_FAIL` | `schemeResolved`, `!success` | [SD] |
| `bill_deferred` | +15 | `TILT_BILL_DEFERRED` | `billDeferred` | [SD] |
| `withdraw` | −5 | `TILT_WITHDRAW` | `withdrawRequested`, не чаще 1 раза в день | [SD] («остановился и забрал» — единственная награда за выход из казино) |
| `one_more_week` | +10 | `TILT_ONE_MORE_WEEK` | `weekChoice = one_more_week` | [SD] |
| `event` | по данным | — | эффект карточки, например «отказать маме» +10, «рыбалка» −30 | [CV] |

Near-miss тильт **не** меняет: +0. Он уже учтён как проигрыш. Сделано так, чтобы визуальный приём не становился механикой. Тюнинг-ручка `TILT_NEAR_MISS_EXTRA` = 0 (§2.9).

### 2.3 Формула обновления

```
T' = clamp(T + Σ δ_i, 0, T_cap)
T_cap = 100, если фаза = День; иначе 99
T_morning = casinoNight ? TILT_AFTER_NIGHT : max(0, T − TILT_SLEEP_ABS)
```

| Символ | Тип | Диапазон | Описание |
|---|---|---|---|
| T | int | 0–100 | тильт до события |
| δ_i | int | −30…+15 | дельты всех источников одного события (§2.2) |
| T_cap | int | {99, 100} | 100 только днём: «Ночь» не может начаться утром или во сне |
| TILT_SLEEP_ABS | int | 25 | модуль стока сна |
| TILT_AFTER_NIGHT | int | 50 [SD] | тильт утром после «Ночи» |
| T' | int | 0–100 | результат, ограничен сверху и снизу |

- **Порядок внутри спина:** исход → выплата → статистика → тильт (`spin_*` + `all_in` одной суммой, одно событие `tiltChanged`) → проверка «Ночи».
- **Пример 1.** T = 66, спин ДОДЕП ВСЁ с исходом `lose`: 66 + 8 + 5 = 79. Эмитятся `tiltChanged(79, +13, 'spin_loss')` и `tiltStageChanged(heated → tilt)`.
- **Пример 2.** Утреннее событие «отказать маме» (+10) при T = 95: результат 99, а не 100, «Ночь» не наступает.

### 2.4 Проявление: подача (UI, звук, текст)

Всё ниже — чистая презентация. Компонент читает `stage` из геттера. В режиме `.calm` («Меньше мигания», `prefers-reduced-motion`) анимации заменяются статикой, а смысл сохраняется.

| Элемент | `calm` | `heated` ≥ 40 | `tilt` ≥ 70 | Вариант в `.calm` |
|---|---|---|---|---|
| Баннер «ОТЫГРАЙСЯ!» | нет | первый слайд карусели + липкая полоса над слотом | то же, текст злее (`tilt.banner.tilt.*`) | без анимации |
| Пульс «ДЕПОЗИТ» (`--pulse-period`) | 1.2 с | 0.8 с | 0.6 с (≤ 3 Гц, ок) | нет пульса |
| Кнопка `ДОДЕП ВСЁ` | вторичная | стиль главной CTA, градиент | + лёгкое свечение | без свечения |
| Кнопки `MIN`, `½` | обычные | ghost | ghost | — |
| «Выйти из казино» / вкладка «Жизнь» | обычная | меньше на 1 шаг шкалы, цвет `--c-text-muted` (контраст ≥ 4.5:1 обязателен, **не** opacity) | то же + 2 подтверждения (§2.5) | — |
| Тикер побед | ×1 | скорость ×1.5 | ×2 | тикер на паузе |
| 🔥-метр в «Жизни» | серый | оранжевый | красный, дрожит | без дрожи |
| Виньетка `--tilt-vignette` | нет | нет | статичная красная радиальная по краям | статичная |
| ⚡ в шапке казино | значение | значение | «⚡ —» с подсказкой «время? какое время» (в «Жизни» и Изнанке значение честное) | — |
| Подсказка после проигрыша | нет | нет | тост «Отыграйся ×2?», кнопка **только** ставит ставку ×2, спин не запускает | — |
| Музыка (опционально, sound-designer) | playbackRate 1.00 | 1.06 | 1.12 | — |

**Запрещено:** автоспин, авто-изменение ставки без клика, блокировка выхода, изменение исхода или анимации исхода по тильту (LDW празднуется одинаково на любом тильте).

**Честный двойник в Изнанке** (всегда виден): «Тильт 72/100 — стадия "Тильт". Спины стоят 0⚡: это не бесплатно, это незаметно. Шансы и RTP 90% от тильта не зависят». Плюс разбивка дельт за сегодня по `source`.

### 2.5 Проявление: детерминированные правила порогов [CV]

**A. Стоимость спина.**

```
spinEnergyCost(T) = T ≥ TILT_FREE_SPIN_AT ? 0 : SPIN_ENERGY_COST
```

| Символ | Тип | Диапазон | Описание |
|---|---|---|---|
| T | int | 0–100 | тильт **до** спина |
| TILT_FREE_SPIN_AT | int | 70 | порог |
| SPIN_ENERGY_COST | int | 2 | обычная цена |
| результат | int | {0, 2} | списываемые ⚡ |

- При T ≥ 70 спин доступен даже при ⚡ = 0.
- Пример: T = 70, ⚡ = 0 — спин разрешён, стоит 0. T = 69, ⚡ = 1 — отказ `no_energy`.

**B. Двойное подтверждение выхода** при T ≥ 70. Это только UI.
1. «Точно? Сейчас пойдёт!»: [Остаться] [Уйти].
2. «Ну последний?»: [Ещё один спин] [Уйти].

«Ещё один спин» отправляет обычный `slot/spin` с текущей ставкой: игрок кликнул сам. `Esc` на любом шаге означает «Уйти» (гарантия доступности). Двойник в Изнанке: «Выход всегда работал по Esc».

**C. «Ночь в казино»** — срабатывает, когда T' = 100 днём.

```
nightLoss = floor(casinoBalance × NIGHT_LOSS_SHARE)
```

| Символ | Тип | Диапазон | Описание |
|---|---|---|---|
| casinoBalance | int | ≥ 0 | весь баланс казино, включая заблокированный бонус |
| NIGHT_LOSS_SHARE | float | 0.20 [CV] | доля потери |
| nightLoss | int | 0…casinoBalance | списание |

Последовательность:
1. `casinoBalance −= nightLoss`.
2. `stats.casinoNightLoss += nightLoss`, `casinoNights += 1`.
3. `⚡ = 0`, эмитится `casinoNight`.
4. Принудительный сон: обычный порядок из CD-01, но тильт после сна = `TILT_AFTER_NIGHT` (50).
5. Если `run.stats.casinoNights = 3`, то концовка `lost_week`. Приоритет задаёт CD-01.

Прогресс вейджера за `nightLoss` **не** засчитывается: спинов не было. Пример: баланс 4 237 → потеря 847, остаток 3 390.

Двойник: «Ночь в казино: списано 847₽ (20% баланса). Это усреднённая цена ночи автоспинов при RTP 90%».

### 2.6 Гарантия «тильт не меняет исходы»

1. **Структурно:** `resolveSpin` не имеет доступа к `RunState` (§2.1). Код-ревью отклоняет любую передачу `tilt` или `stage` в `game/slot*`.
2. **Тест CD-10:** две выборки по 200 000 спинов при `tilt = 0` и `tilt = 100`, один seed. Распределения `outcomeId` должны совпасть **побитно**: RNG потребляется одинаково.
3. **Тест:** `expectedRtp(config)` не имеет параметров состояния.
4. Правило A меняет только расход ⚡, правило C — только баланс. Оба не вызывают `rng`.

### 2.7 Edge cases

| Случай | Правило |
|---|---|
| Тильт 100 во время бонуса | «Ночь» как обычно, −20% от всего баланса. Если после этого баланс < `MIN_BET`, эмитится `bonusBusted` |
| Тильт ≥ 70 и деньги кончились | спинов нет: нужна ставка ≥ `MIN_BET` с баланса казино. Тильт остаётся, сток — сон, смена или семья |
| Два источника в одном действии | суммируются до clamp, одно `tiltChanged` с `source` доминирующего (наибольший \|δ\|) |
| Карточка сна даёт +40 при T = 80 | 99, «Ночи» нет |
| «Ещё неделю» на дне 28 при T = 95 | +10, выбор делается утром (фаза ≠ День), T = 99 |
| Отрицательные дельты при T = 0 | T остаётся 0, событие не эмитится |

### 2.8 Петли обратной связи и дрейф

Ожидаемый дрейф тильта за один спин:

```
E[Δ_spin] = P_LOSS_LIKE × TILT_LOSS − P_BIG_WIN × |TILT_WIN| + allInShare × TILT_ALL_IN
```

| Символ | Тип | Диапазон | Описание |
|---|---|---|---|
| P_LOSS_LIKE | float | 0.786 | P(mult < 1) |
| P_BIG_WIN | float | 0.134 | P(mult ≥ 2) |
| allInShare | float | 0–1 | доля спинов «ДОДЕП ВСЁ» |
| E[Δ_spin] | float | ≈ 5.9…10.9 | средний прирост за спин |

Пример при allInShare = 0: 0.786 × 8 − 0.134 × 3 = **5.886**. Значит:
- от 0 до 70 (бесплатные спины) нужно около 12 спинов;
- от 0 до 100 — около 17;
- от 50 (утро после Ночи) до 100 — около 8.5.

| Петля | Знак | Статус |
|---|---|---|
| тильт ≥ 70 → спины 0⚡ → больше спинов → больше проигрышей → тильт растёт | + | **намеренная** (тема «не замечаешь времени»). Ограничена деньгами и «Ночью» |
| «Ночь» → −20% баланса и конец дня → меньше денег на спины | − | намеренный демпфер |
| сон, смена, семья, вывод снижают тильт | − | «выходы» из петли. Все — действия вне казино (пиллар 2) |
| 3 «Ночи» → концовка | терминальная | ограничивает спираль |

**Цели симуляции (для CD-02/CD-04):**
- медиана спинов от 0 до 100 — 15–25;
- ≥ 1 «Ночь» за ран: «казино каждый день» — 40–70%, «честный» — ≤ 5%;
- концовка `lost_week` у «казино каждый день» — 10–30%.

### 2.9 Тюнинг

| Константа | v1 | Безопасный диапазон | Эффект |
|---|---|---|---|
| `TILT_LOSS` | 8 | 5–10 | скорость спирали. <5 — «Ночь» почти недостижима |
| `TILT_WIN` | −3 | −1…−6 | ниже −6 выигрыши «лечат», что противоречит теме |
| `TILT_ALL_IN` | 5 | 0–10 | цена ДОДЕП ВСЁ |
| `TILT_SLEEP` | −25 | −20…−40 | переносимость тильта между днями |
| `TILT_AFTER_NIGHT` | 50 | 30–60 | >60 даёт «Ночь» два дня подряд почти гарантированно |
| `TILT_FREE_SPIN_AT` | 70 | 60–80 | |
| `NIGHT_LOSS_SHARE` | 0.20 | 0.10–0.35 | |
| `TILT_NEAR_MISS_EXTRA` | 0 | 0–4 | >0 делает near-miss механикой. Не рекомендую |
| `TILT_SCHEME_FAIL`, `TILT_BILL_DEFERRED`, `TILT_WITHDRAW`, `TILT_ONE_MORE_WEEK` | 10, 15, −5, 10 | 0–20 | [SD], можно обнулить без последствий для остальных систем |

---

## 3. Честная статистика, Изнанка, Выписка

### 3.1 Счётчики (`RunStats` ≡ `LifetimeStats`, одна форма)

`reduceStats(stats, event)` применяется к `run.stats` и `profile.stats` одновременно (ADR-005). Колонка «Тип»:
- `+` — сумма;
- `max` — максимум;
- `run-only` — служебное, в lifetime не переносится.

Колонка «Steam» — маппится ли счётчик на Steam Stat (INT).

| Ключ | Тип | Событие → правило | Steam |
|---|---|---|---|
| `spins` | + | `spin` → +1 | ✔ |
| `spinsFree` | + | `spin` с `energyCost = 0` → +1 | |
| `casinoEnergySpent` | + | `spin` → +energyCost | |
| `totalWagered` | + | `spin` → +bet | ✔ |
| `totalPaidOut` | + | `spin` → +payout | ✔ |
| `winsShowcase` | + | `spin`, payout > 0 | |
| `winsReal` | + | `spin`, multiplier > 1 | ✔ |
| `pushes` | + | `spin`, multiplier = 1 | |
| `ldw` | + | `spin`, ldw | ✔ |
| `nearMiss` | + | `spin`, nearMiss | ✔ |
| `jackpots` | + | `spin`, outcomeId = x100 | ✔ |
| `allInSpins` | + | `spin`, allIn | |
| `biggestPayout` | max | `spin` → payout | |
| `longestLoseStreak` | max | из `run.loseStreak`: payout < bet → +1, иначе 0 | ✔ |
| `netLossPeak` | max | после `spin`: `totalWagered − totalPaidOut` своего скоупа | ✔ (для `VALUED_CUSTOMER`) |
| `deposits` / `deposited` | + / + | `deposit` → +1 / +amount | ✔ / |
| `bonusesTaken` / `bonusGranted` | + / + | `bonusGranted` → +1 / +bonus | |
| `bonusesCleared` / `bonusesBusted` | + | соответствующие события | |
| `withdrawals` | + | `withdrawRequested` → +1 | ✔ |
| `withdrawnGross` / `withdrawnNet` / `withdrawFees` | + | `withdrawRequested` → +gross / +net / +fee (в момент заказа: деньги покинули казино) | |
| `casinoNights` / `casinoNightLoss` | + | `casinoNight` → +1 / +lost | ✔ / |
| `casinoBalanceForfeited` | + | `runEnded` → +casinoBalance на момент конца | |
| `shifts` | + | `shiftWorked` | ✔ |
| `schemes` / `schemesSucceeded` / `schemeFines` | + | `schemeResolved` | ✔ (succ.) |
| `friendLoans` / `friendLoaned` / `friendsBlocked` | + | соответствующие события | |
| `familyHelps` | + | `familyHelped` | |
| `loansBank` / `loansMfo` / `borrowed` | + | `loanTaken` | |
| `interestPaid` | + | `interestAccrued` → +amount | |
| `debtRepaid` | + | `debtRepaid` | |
| `maxDebt` | max | после любого изменения долга | |
| `itemsPawned` / `pawnReceived` | + | `itemPawned` | |
| `itemsRedeemed` / `redeemPaid` / `redeemPremium` | + | `itemRedeemed` → +1 / +cost / +(cost − pawnAmount) | |
| `itemsLost` | + | `runEnded` → число вещей, лежащих в ломбарде | |
| `billsPaid` / `billsLate` / `billPenalties` | + | `billPaid` (late → billsLate), `billDeferred` → +penalty | |
| `livingCostPaid` | + | `livingCostPaid` | |
| `sleepEvents` | + | `sleepEventShown` | |
| `daysPlayed` | + | `slept` | |
| `daysTilt70` | + | `slept`: если `run.dayTiltMax ≥ 70` → +1, затем `dayTiltMax = T_morning` | ✔ |
| `tiltPeak` | max | `tiltChanged` → value | |
| `cleanWeeks` | + | `slept` на дне 7k: если `run.spinsThisWeek = 0` → +1. Счётчик `spinsThisWeek` (run-only) сбрасывается в начале недели | |
| `extraWeeks` | + | `weekChoice = one_more_week` | |
| `playSec` / `underbellySec` | + | `meta/tick` | ✔ / ✔ |
| `fakeTimerExpiries` | + | `meta/fakeTimerExpired` | |
| `runsStarted` / `runsFinished` | + | `runStarted` / `runEnded` (кроме `abandoned`) | ✔ |
| `loseStreak`, `dayTiltMax`, `spinsThisWeek`, `peakCasinoBalance`, `jackpotToday` | run-only | служебные флаги рана, хранятся в `RunState`, не в статистике | |

**Инвариант сверки** (тест QA, после каждой команды):

```
casinoBalance = deposited + bonusGranted + totalPaidOut − totalWagered − withdrawnGross − casinoNightLoss
```

Все значения — скоуп `run`. Если сверка не сходится, значит в ядре есть неучтённый поток денег.

### 3.2 Производные метрики (геттеры, не хранятся)

**Фактический RTP игрока.**
```
rtpActual = totalWagered > 0 ? totalPaidOut / totalWagered : null
```

**Итог казино.**
```
casinoNetFinal = withdrawnNet − deposited
casinoNetLive  = withdrawnNet + floor(withdrawable × (1 − WITHDRAW_FEE)) − deposited
withdrawable   = bonusLocked ? 0 : casinoBalance
```

**Удача против казино.**
```
expectedLoss = round(totalWagered × (1 − RTP))
actualLoss   = totalWagered − totalPaidOut
luck         = expectedLoss − actualLoss
```

**Проиграно казино.**
```
L = max(0, −casinoNetFinal)
```

**Полная цена рана.**
```
C = L + interestPaid + billPenalties + schemeFines + redeemPremium
```

| Символ | Тип | Диапазон | Описание |
|---|---|---|---|
| RTP | float | 0.90 | `expectedRtp(config)`, не константа в UI |
| WITHDRAW_FEE | float | 0.05 | комиссия вывода |
| rtpActual | float\|null | 0…∞ | обычно 0.6–1.2 за ран; `null` означает «спинов не было» |
| casinoNetFinal | int | ℤ | < 0 — казино в плюсе. Баланс, оставшийся в конце, считается потерянным: «не твоё, пока не выведено» |
| luck | int | ℤ | > 0 — повезло больше среднего |
| L, C | int | ≥ 0 | база эквивалентов и итоговая строка |

**Пример.** Внесено 12 000. Один вывод: 3 000 брутто, комиссия 150, нетто 2 850. Оборот 41 000, выплачено 36 500. Остаток на балансе 4 500 сгорает.
- rtpActual = 89.0%;
- expectedLoss = 4 100, actualLoss = 4 500, luck = −400;
- casinoNetFinal = 2 850 − 12 000 = **−9 150**, L = 9 150;
- при процентах 1 240 и штрафе за счёт 2 750: C = 13 140.
- Сверка: 12 000 + 0 + 36 500 − 41 000 − 3 000 − 0 = 4 500 = баланс ✔.

### 3.3 Эквиваленты «потеряно в пересчёте на…»

```
eq_k = floor(L / price_k)
```

Показываются **до 3 строк**: первые три в порядке `priority`, у которых `eq_k ≥ 1`.

| id | price_k | Источник цены | priority | Шаблон (ru, плюрализация через i18n) |
|---|---|---|---|---|
| `EQ_GIFT_MOM` | 3 000 | [CV] | 1 | «= {n} подарков маме» |
| `EQ_UTILITIES` | 6 000 | [CV] | 2 | «= {n} мес. коммуналки» |
| `EQ_SHIFTS` | `SHIFT_PAY` (900) | balance | 3 | «= {n} смен на работе. Каждая по 60⚡ твоей жизни» |
| `EQ_DAYS_OF_LIFE` | `LIVING_COST` (300) | balance | 4 | «= {n} дней обычной жизни» |
| `EQ_SHAWARMA` | 250 | [CV] | 5 | «= {n} шаурмы» |
| `EQ_FISHING` | 1 500 | [SD] | 6 | «= {n} рыбалок с Серёгой, на которые ты не поехал» |

| Символ | Тип | Диапазон | Описание |
|---|---|---|---|
| L | int | ≥ 0 | §3.2 |
| price_k | int | > 0 | цена эквивалента. Цены, связанные с балансом, читаются из `balance.ts` |
| eq_k | int | ≥ 0 | число единиц, дробь отбрасывается |

- **Спецслучаи.**
  - L < 250: строка «Почти ничего не проиграно. Редкость. Это не повод».
  - casinoNetFinal > 0: «Казино должно тебе {x}₽. Ты успел вывести {withdrawnNet}₽. Большинство не успевает» (плюс доля ранов в плюсе из `runHistory`).
- **Пример:** L = 9 150 → 3 подарка маме, 1 мес. коммуналки, 10 смен.
- **Внутриигровые часы в казино.**
  ```
  casinoHours = (casinoEnergySpent + spinsFree × SPIN_ENERGY_COST) × AWAKE_HOURS / DAY_ENERGY + casinoNights × NIGHT_HOURS
  unnoticedHours = spinsFree × SPIN_ENERGY_COST × AWAKE_HOURS / DAY_ENERGY
  ```
  Константы: AWAKE_HOURS = 16, DAY_ENERGY = 100, NIGHT_HOURS = 8 [SD]. Результат округляется до 0.1 ч.
  Пример: 40 платных спинов (80⚡), 30 бесплатных, 1 «Ночь» → (80 + 60) × 0.16 + 8 = **30.4 ч**, из них 9.6 ч «не заметил».

### 3.4 Изнанка: живая панель (CD-17)

Моноширинный протокол. Блоки идут сверху вниз, данные — геттеры §3.1–3.3 со скоупом `run`, вкладка «За всё время» показывает скоуп `lifetime`.

1. **Операции:**
   - последние 10 спинов строкой «Операция №{spins}. Ставка {bet}₽. Возврат {payout}₽. Итог {payout−bet}₽»;
   - LDW помечается штампом `−{bet−payout}₽`;
   - near-miss помечается «почти-выигрыш: исход решён до вращения».
2. **Казино:**
   - спины;
   - оборот;
   - выплачено;
   - «выигрышей по версии Витрины: `winsShowcase`, на самом деле в плюс: `winsReal`»;
   - RTP заявленный и фактический, luck;
   - LDW, near-miss («это приём»);
   - casinoNetLive.
3. **Бонус** (если был):
   - вейджер `{wagered}/{required}`;
   - ожидаемый остаток после отыгрыша `E_rem = max(0, B0 − W_left × (1 − RTP))`, где B0 — текущий баланс, W_left — остаток вейджера. Это приближение без учёта разорения, точную формулу даёт CD-02;
   - пример: деп 2 000, бонус 4 000, W = 120 000, B0 = 6 000 → 6 000 − 12 000 < 0 → **0₽**.
4. **Тильт:** значение, стадия, дельты за сегодня (§2.4).
5. **Долг:**
   - долг;
   - проценты уплачено;
   - «МФО: 1%/день = {(1.01^365 − 1)×100}% годовых сложными»;
   - штрафы.
6. **Вещи:** заложено сейчас (ломбардная сумма и цена выкупа 130%).
7. Нейтральная строка «Если это про тебя — это лечится» [CV §4].

### 3.5 Выписка (конец рана)

`buildStatement(run, profile, config): Statement` — чистая функция в `game/`, UI только рендерит.

```ts
interface Statement {
  runId: string; endingId: EndingId | 'abandoned'; grade?: 'A'|'B'|'C'
  days: number; extraWeeks: number; title: CosmeticId            // экипированный титул
  playSec: number; casinoHours: number; unnoticedHours: number
  deposited: number; withdrawnNet: number; withdrawFees: number; forfeited: number
  casinoNetFinal: number; rtpDeclared: number; rtpActual: number | null
  expectedLoss: number; actualLoss: number; luck: number
  spins: number; winsShowcase: number; winsReal: number; ldw: number; nearMiss: number; jackpots: number
  casinoNights: number; daysTilt70: number
  interestPaid: number; billPenalties: number; schemeFines: number; redeemPremium: number; fullCost: number
  itemsLost: ItemId[]; friendsBlocked: boolean
  equivalents: { id: string; n: number }[]                        // ≤ 3, §3.3
  lifetime: { runs: number; casinoNetFinal: number; spins: number; rtpActual: number | null }
  newAchievements: AchievementId[]                                 // открытые за этот ран
}
```

**Порядок строк на листе** (голос Изнанки, тишина, без звука):
1. шапка «Выписка по счёту. Клиент: {title}. Период: дни 1–{days}»;
2. концовка и оценка;
3. деньги: внесено, выведено, сгорело на балансе, **итог**;
4. казино: спины, RTP заявленный и фактический, «Витрина / на самом деле»;
5. цена быстрых денег: проценты, штрафы, выкуп;
6. вещи, которых больше нет;
7. время: реальное и в казино, из них «не заметил»;
8. эквиваленты;
9. «За всё время: {runs} ранов, итог {lifetime.casinoNetFinal}₽ ненастоящих денег»;
10. новые ачивки;
11. кнопки «Ещё ран?» (с мета-подписью CV §6.5) и «В меню».

### 3.6 Время

- Стор (не ядро) считает активное время:
  - вкладка `visible` и окно в фокусе;
  - последний ввод был не позже 120 с назад (`IDLE_CUTOFF_SEC`).
- Раз в 10 с стор отправляет `meta/tick { playSec, underbellySec }`, а также на `visibilitychange` и `beforeunload`.
- `underbellySec` растёт, пока включён режим «Снять очки» или открыта Изнанка.
- Значения ограничиваются: не больше 15 с на один тик. Это защищает от скачков часов.

### 3.7 Честные двойники элементов Витрины (пиллар 1)

| Элемент Витрины | Двойник (Изнанка / Выписка) | Данные |
|---|---|---|
| «ВЫИГРЫШ! +50₽» (LDW) | штамп «−50₽ (ставка была 100₽)» | `spin.ldw`, bet, payout |
| Фанфары выигрыша | в Изнанке любой исход — сухой щелчок (§5.4) | — |
| «7-7-почти» | «почти-выигрышей: N. Исход решён до вращения. Это приём» | `nearMiss` |
| Баланс-пилюля казино | «К выводу доступно: {withdrawable}. Придёт завтра, −5%» | casinoNetLive |
| «БОНУС 200%*» | вейджер, ожидаемый остаток ≈ 0, «прошли отыгрыш ~11% игроков» (число из CD-02) | §3.4 |
| Врущий таймер «сгорит через 04:59» | «Таймер обнулился {fakeTimerExpiries} раз. Бонус не сгорал ни разу» | `fakeTimerExpiries` |
| Тикер «Ал***й выиграл 48 000₽» | серый тикер: на 1 строку победы — `round((1 − P_REAL_WIN) / P_REAL_WIN)` строк проигрыша. По таблице v1 это **6**, а не 9 из CV. Берётся из конфига | `slot` config |
| Баннер «ОТЫГРАЙСЯ!» | «Тильт N. RTP 90% при любом тильте» | tilt |
| Спины 0⚡ при тильте | «незамеченных часов: {unnoticedHours}» | §3.3 |
| Кнопка `ДОДЕП ВСЁ` | «Ожидаемая потеря: 10% ставки. Шанс потерять ≥ 50% ставки за спин: 78.6%» | конфиг |
| Тост «Отыграйся ×2?» | «Удвоение ставки не меняет матожидание: −10% от каждой ставки» | — |
| «Вывод на рассмотрении» | «Деньги у казино ещё 1 день. Комиссия {fee}₽» | withdraw |
| Push «Мы скучаем! 50 фриспинов*» | «Фриспины с вейджером ×N. Ожидаемый остаток ≈ 0» | событие |
| Мелкий шрифт со сносками | полный текст сноски обычным кеглем | content |
| «Ответственная игра» 6px | открывает Изнанку | — |
| «Ночь в казино» | «списано {lost}₽, 8 часов, которых ты не помнишь» | `casinoNight` |
| Ачивка на Витрине | честный подзаголовок (CD-11) | content |
| Зеркало №47 | «Зеркала нужны, потому что сайт блокируют» | content |
| VIP / кэшбэк / Анжелика (P1) | «VIP-уровень = сумма твоего проигрыша»; «кэшбэк {x}₽ из твоих {y}₽»; «это скрипт» | CD-32 |

---

## 4. Достижения

- **Общие правила.**
  - Условия проверяются `evaluateAchievements` после каждого `dispatch`. Для `stat` — сравнение `gte` в указанном скоупе. Для `event` — предикат на событии и `RunState` **после** применения.
  - Разблокировка идемпотентна и переживает брошенный ран.
  - Тексты и честные подзаголовки пишет CD-11, ключи `ach.{ID}.title|desc|honest`.
  - **Скрытое** означает Steam Hidden. В «Коллекции» закрытое скрытое показывается как «???», закрытое обычное — с описанием и полоской прогресса (для `stat`).
- **Награды** — только косметика (§5), мета-валюты нет (пиллар 5).

| # | ID (Steam API Name) | Название | Описание для игрока | Скр. | Условие (точно) | Награда |
|---|---|---|---|---|---|---|
| 1 | `FIRST_DEPOSIT` | Первый деп | Сделай первый депозит | — | stat `deposits` lifetime ≥ 1 | `title:newbie` |
| 2 | `BEGINNERS_LUCK` | Новичкам везёт | Выиграй ≥ 2x на первом спине рана | — | event `spin`: `run.stats.spins = 1` ∧ `multiplier ≥ 2` | — |
| 3 | `NEAR_MISS_10` | Почти! | Увидь 10 «почти-выигрышей» | — | stat `nearMiss` lifetime ≥ 10 | — |
| 4 | `LDW_10` | Проигрыш с фанфарами | 10 раз отпразднуй проигрыш | — | stat `ldw` lifetime ≥ 10 | `title:celebrant` |
| 5 | `VETERAN_500` | Ветеран | 500 спинов за всё время | — | stat `spins` lifetime ≥ 500 | `skin:bandit_90s`, `sound:hall_90s` (P1) |
| 6 | `ALL_IN_5000` | ДОДЕП ВСЁ | Поставь весь баланс казино, от 5 000₽ | — | event `spin`: `allIn` ∧ `bet ≥ 5000` | `sound:streamer` (P1) |
| 7 | `JACKPOT_777` | Три топора | Выбей 777 | — | stat `jackpots` lifetime ≥ 1 | `title:three_axes` |
| 8 | `JACKPOT_THEN_ZERO` | И где деньги? | Выбей 777 и в тот же день спусти баланс | ✔ | event `spin`: `run.jackpotToday` ∧ `casinoBalanceAfter < MIN_BET`. Обнуление выводом не считается | `title:lucky` |
| 9 | `CLEAN_WEEK` | Честный труженик | Проживи неделю без единого спина | — | stat `cleanWeeks` run ≥ 1 | `skin:garden` (P1) |
| 10 | `SHIFTS_20_RUN` | Стахановец | 20 смен за один ран | — | stat `shifts` run ≥ 20 | `title:shock_worker` |
| 11 | `SCHEMES_10` | Темщик | 10 успешных темок за всё время | — | stat `schemesSucceeded` lifetime ≥ 10 | — |
| 12 | `FAMILY_10_RUN` | Внучок | Помоги семье 10 раз за ран | — | stat `familyHelps` run ≥ 10 | `skin:garden` (P1, альтернативный путь) |
| 13 | `BLOCKED_BY_FRIENDS` | Друзья не банк | Добейся «Вы заблокированы» | — | stat `friendsBlocked` lifetime ≥ 1 | — |
| 14 | `MFO_3_RUN` | Всего 365% годовых | Возьми МФО 3 раза за ран | — | stat `loansMfo` run ≥ 3 | `title:borrower` |
| 15 | `PAWN_ALL` | Всё своё ношу с собой | Все 5 вещей в ломбарде одновременно | — | event `itemPawned`: число незаложенных вещей рана = 0 | `skin:pawnshop` (P1) |
| 16 | `REDEEM_3_RUN` | Выкупил! | Выкупи 3 вещи за ран | — | stat `itemsRedeemed` run ≥ 3 | — |
| 17 | `WAGER_CLEARED` | Вейджер-мастер | Отыграй бонус 200% полностью | — | stat `bonusesCleared` lifetime ≥ 1 | `theme:mirror_47` (P1) |
| 18 | `BONUS_BUSTED` | Бонусоман | Слей бонус до отыгрыша | — | stat `bonusesBusted` lifetime ≥ 1 | — |
| 19 | `WITHDRAW_5` | Вывод на рассмотрении | Закажи вывод 5 раз | — | stat `withdrawals` lifetime ≥ 5 | — |
| 20 | `VALUED_CUSTOMER` | Ценный клиент | Проиграй 100 000₽ за всё время | — | stat `netLossPeak` lifetime ≥ 100 000 | `skin:gold_vip` (P1) |
| 21 | `TILT_100` | Тильт-проф | Доведи тильт до 100 | — | stat `casinoNights` lifetime ≥ 1 | `skin:clown` |
| 22 | `TIMER_LIES` | Таймер врёт | Дождись, пока «бонус сгорит» | ✔ | stat `fakeTimerExpiries` lifetime ≥ 1 | `title:skeptic` |
| 23 | `INSIGHT` | Прозрение | Проведи в Изнанке 5 минут | — | stat `underbellySec` lifetime ≥ 300 | `title:enlightened` |
| 24 | `ENDING_QUIT` | Выход есть | Концовка «Завязал» | — | event `runEnded`, `endingId = quit` | `skin:grey_reality`, `theme:monday_morning`, `sound:honest` |
| 25 | `ENDING_COLLECTORS` | Добрый вечер, мы из банка | Концовка «Коллекторы» | — | event `runEnded`, `collectors` | — |
| 26 | `ENDING_JAIL` | Темка не зашла | Концовка «Сел» | — | event `runEnded`, `jail` | — |
| 27 | `ENDING_FAMILY_LEFT` | Один дома | Концовка «Семья ушла» | — | event `runEnded`, `family_left` | — |
| 28 | `ENDING_MINIMALISM` | Минимализм | Концовка «Минимализм» | — | event `runEnded`, `minimalism` | — |
| 29 | `ENDING_LOST_WEEK` | Ты не помнишь эту неделю | Концовка «Ночь в казино ×3» | — | event `runEnded`, `lost_week` | — **[SD]**: в CV у этой концовки нет ачивки, а #31 требует все 7 |
| 30 | `ENDING_REFERRAL` | Реферальная программа | Секретная концовка | ✔ | event `runEnded`, `referral` | `theme:stream_overlay` (P1) |
| 31 | `ALL_ENDINGS` | Коллекционер дна | Собери все 7 концовок | — | `profile.endings` содержит все 7 `EndingId` (проверка на `runEnded`) | `title:all_bottoms`, `skin:neon_noir` (P2) |

- Итого 31 = 30 из CV + #29, закрывающая пробел. Если нужно ровно 30, см. §7, вопрос 1.
- `abandoned` не является концовкой и ачивок не даёт.
- **P0-тесты (CD-13):** на сид-сценариях проверяются `VETERAN_500`, `VALUED_CUSTOMER`, `CLEAN_WEEK`, `ALL_ENDINGS`, а также идемпотентность.

**P1-приложение** (id резервируются сейчас, в P0 не активны):

| ID | Условие | Награда |
|---|---|---|
| `BOTTOM_BREACHED` («Дно пробито») | event `spin`: `run.peakCasinoBalance ≥ 10 000` ∧ `casinoBalanceAfter < MIN_BET` | `skin:crypto` |
| `ETERNAL_DODEP` («Вечный додеп», CD-31) | stat `extraWeeks` run ≥ 4 (8 недель) | — (решит CD-31) |

---

## 5. Косметика

### 5.1 Общие правила

- **Типы:**
  - `skin` — скин слота;
  - `theme` — тема UI;
  - `sound` — звук-пак;
  - `title` — титул в Выписке.
- `CosmeticId = \`${kind}:${id}\``.
- **Владение вычисляется, а не хранится:** `owned(profile) = DEFAULTS ∪ { rewards(a) | a ∈ profile.achievements }`, только для записей, которые есть в каталоге текущего билда. Косметика P1, заработанная в P0, появится сама после апдейта. Поле `owned` в сейве не нужно: при миграции оно игнорируется.
- `meta/equip` проверяет `cosmeticId ∈ owned` и `kind` слота, иначе отказ `not_owned`.
- **Косметика не влияет на исходы.** Тест CD-19: `resolveSpin` одинаков при любом скине. Скин получает `SymbolId[]` уже готовой раскладки.
- **Изнанка поверх любой косметики:**
  - Изнанка **не темизируется**: её токены фиксированы, честный слой везде одинаков;
  - в режиме «Снять очки» звук исходов спина всегда «честный» (§5.4).

### 5.2 Скины слота

`SymbolId = 'x0_5' | 'x1' | 'x2' | 'x5' | 'x10' | 'x25' | 'x100' | 'blank'`. Это id уровней выплат. `blank` появляется только в проигрышных раскладках. Выигрыш показывается как три одинаковых символа своего уровня. Near-miss выглядит как `x100, x100, ≠x100`. Каждый скин обязан покрыть все 8 id (тест ADR-007).

Поля скина:

```ts
{ id, unlock, symbols: Record<SymbolId,string>, frameClass, glow, reelEasing, stopStaggerMs, celebrate: 'full'|'muted', grayscale: boolean }
```

- Длительность вращения скин **не** задаёт: она всегда из конфига (≤ 1.3 с, быстрый спин 0.4 с).
- `stopStaggerMs` ∈ [80, 200].

| Скин | x0_5 | x1 | x2 | x5 | x10 | x25 | x100 | blank | Рамка (`frameClass`) | glow | reelEasing / анимация | celebrate | Анлок | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `skin:fruit` Фруктовый | 🍒 | 🍋 | 🍊 | 🍉 | ⭐ | 💎 | 7️⃣ | 🤡 | `frame-neon`: бегущие лампочки | `--c-accent` | `cubic-bezier(.2,.8,.2,1)` | full | **по умолчанию** | P0 |
| `skin:bandit_90s` Однорукий бандит 90-х | 🍒 | 🍋 | 🔔 | 🍀 | ⭐ | 💰 | 7️⃣ | `BAR` (текст-глиф) | `frame-pixel`: ступенчатая рамка, `image-rendering: pixelated` | `#FFB000` | `steps(8)`, механический стоп, stagger 200 | full | #5 | P0 |
| `skin:clown` Клоунский | 🎈 | 🥧 | 🎺 | 🤹 | 🎪 | 🎭 | 🤡 | 🃏 | `frame-circus`: красно-белые полосы `repeating-linear-gradient` | `#FF2BD6` | overshoot `cubic-bezier(.34,1.56,.64,1)` | full | #21 | P0 |
| `skin:grey_reality` Серая реальность | 🧦 | 🥫 | 🚌 | 💊 | 🔌 | 🧾 | 🗝️ | ▫️ | `frame-paper`: 1px `--c-ink` на `--c-paper` | нет | `linear`, stagger 80 | **muted**: без взрыва монет и шейка, только сумма моноширинным | #24 | P0 |
| `skin:pawnshop` Ломбард | 🫖 | 🚲 | 📱 | 🎮 | 📺 | 💻 | 💍 | 🏷️ | `frame-tag`: ценник | `#C9A227` | default | full | #15 | P1 |
| `skin:garden` Бабушкин огород | 🥔 | 🧅 | 🥒 | 🍅 | 🌻 | 🐔 | 🫙 | 🪱 | `frame-fence`: штакетник | `#7CB342` | default | full | #9 **или** #12 | P1 |
| `skin:gold_vip` Золотой VIP | 🪙 | 🥂 | 💰 | 💎 | 🏆 | 🛥️ | 👑 | 🧾 | `frame-gold` | `--c-gold` | default | full | #20 | P1 |
| `skin:crypto` Крипто-ракета | 🪙 | 📈 | 🐸 | 🐋 | 🚀 | 💎 | 🌕 | 📉 | `frame-chart` | `#39FF14` | default | full | `BOTTOM_BREACHED` | P1 |
| `skin:neon_noir` Неон-нуар | 🥃 | 🎷 | 🕶️ | 🌃 | 🎩 | 💼 | 🌙 | 🧯 | `frame-noir` | `#00E5FF` | default | full | #31 | P2 |

- `celebrate: 'muted'` гасит VFX одинаково для выигрыша и LDW: равенство подачи сохраняется.
- Шейк и вспышка 777 во всех скинах подчиняются `.calm`.

### 5.3 Темы UI (CSS-токены)

- **Контракт:** каждая тема — файл `styles/themes/{id}.css` с селектором `[data-theme='{id}']`, и она **обязана определить все токены** списка. Тест: парсинг CSS, множество токенов совпадает.
- Значения — черновик SD. Финальные значения и проверку контраста ≥ 4.5:1 утверждает art-director (CD-14). Имена токенов утверждает SD и TD.
- Токены Изнанки (`--u-paper #E9E5DA`, `--u-ink #1E1E1E`, `--u-ink-muted #6B6B6B`, `--u-stamp #B3261E`, `--u-paper-dark #2B2B2B`, `--u-font-mono`) живут в `tokens.css` и **темами не переопределяются**.

| Токен | Назначение | `theme:neon` (база, P0) | `theme:monday_morning` (P0, #24) |
|---|---|---|---|
| `--c-bg` | фон страницы | `#0B0620` | `#D9DCE1` |
| `--c-surface` | панели | `#170B33` | `#FFFFFF` |
| `--c-surface-2` | вложенные панели | `#22104A` | `#EEF0F3` |
| `--c-border` | обводки | `#3A1F73` | `#B8BEC7` |
| `--c-text` | основной текст | `#F4F1FF` | `#1F2328` |
| `--c-text-muted` | вторичный текст (≥ 4.5:1) | `#B9B0D9` | `#4F5763` |
| `--c-text-invert` | текст на CTA | `#0B0620` | `#FFFFFF` |
| `--c-accent` | главный акцент | `#FF2BD6` | `#3B5B8C` |
| `--c-accent-2` | второй акцент | `#00E5FF` | `#6B7C93` |
| `--c-cta-from` / `--c-cta-to` | градиент CTA | `#FF7A00` / `#FF2BD6` | `#3B5B8C` / `#3B5B8C` |
| `--c-gold` | джекпот, VIP | `#FFC43D` | `#8A6D1F` |
| `--c-win` | выигрыш (и LDW!) | `#39FF14` | `#2E7D32` |
| `--c-lose` | проигрыш | `#FF7A00` | `#6D4C41` |
| `--c-danger` | ошибки, долг | `#FF3355` | `#B3261E` |
| `--c-tilt-1` / `--c-tilt-2` / `--c-tilt-3` | 🔥-метр по стадиям | `#8A8A9E` / `#FF7A00` / `#FF3355` | `#8A8F98` / `#B26A00` / `#B3261E` |
| `--tilt-vignette` | виньетка ≥ 70 | `rgb(255 51 85 / .25)` | `rgb(179 38 30 / .12)` |
| `--glow-accent` | свечение акцента | `0 0 20px rgb(255 43 214 / .6)` | `none` |
| `--glow-win` | свечение выигрыша | `0 0 24px rgb(57 255 20 / .6)` | `none` |
| `--shadow-card` | тень карточек | `0 8px 24px rgb(0 0 0 / .5)` | `0 1px 2px rgb(0 0 0 / .15)` |
| `--pulse-name` | имя keyframes пульса CTA | `cta-pulse` | `none` |
| `--pulse-period` | базовый период (стадии тильта умножают на 1 / .67 / .5) | `1.2s` | `1.2s` |
| `--radius-card` / `--radius-pill` | скругления | `16px` / `999px` | `4px` / `4px` |
| `--border-w` | толщина обводок | `2px` | `1px` |
| `--font-display` | заголовки, баннеры | `Impact, 'Arial Black', 'Franklin Gothic Heavy', sans-serif` | `'Segoe UI', Calibri, Arial, sans-serif` |
| `--font-body` | текст | `system-ui, sans-serif` | `system-ui, sans-serif` |
| `--display-transform` | регистр дисплея | `uppercase` | `none` |
| `--banner-skew` | наклон баннеров | `-6deg` | `0deg` |
| `--ticker-bg` | фон неонового тикера | `#170B33` | `#EEF0F3` |
| `--reel-bg` | фон барабанов | `#0B0620` | `#FFFFFF` |
| `--reel-size` | размер ячейки (JS читает отсюда) | `80px` | `80px` |

- **P1-темы** (значения задаёт art-director, набор токенов тот же):
  - `theme:mirror_47` — «кислотный сайт 2012»: `#00FF00` на `#000080`, `Comic Sans MS`, `--banner-skew: 0`, класс-декор «NEW!» и вращающиеся ★ (подчиняются `.calm`). Открывается #17.
  - `theme:stream_overlay` — рамка «веб-камеры», фейковый чат-плейсхолдер, `--c-accent #9146FF`-подобный фиолетовый без бренда. Открывается #30.

### 5.4 Звук-паки (Web Audio, синтез; CD-20)

Слоты звуков: `click, reelTick, reelStop, win, ldw, lose, push, jackpot, deposit, withdraw, stamp, sleep, morning, tiltStage, casinoNight, achievement`.

Пак — это `Record<SoundSlot, SynthPresetId | null>`.

| Пак | Суть | Инварианты (тесты) | Анлок | P |
|---|---|---|---|---|
| `sound:classic` | квадратная волна, «динь-динь», арпеджио на выигрыш | `ldw === win` (LDW звучит как выигрыш); `push === win` | **по умолчанию** | P0 |
| `sound:honest` | один сухой щелчок и тишина | `win === ldw === lose === push === jackpot === 'dry_click'`; `deposit === 'dry_click'`; `achievement = null` | #24 | P0 |
| `sound:hall_90s` | электромеханика, монеты в лоток | `ldw === win` | #5 | P1 |
| `sound:streamer` | гиперболизированные «ДОДЕП!»-хорны | `ldw === win` | #6 | P1 |

**Правило Изнанки [CV пиллар 1]:** пока включён режим «Снять очки», слоты `win, ldw, lose, push, jackpot` играются из `sound:honest` при любом выбранном паке.

### 5.5 Титулы (печатаются в шапке Выписки)

- **По умолчанию:** `title:client` «Клиент».
- **Остальные:** `newbie` «Новичок» (#1), `celebrant` «Празднующий» (#4), `three_axes` «Три топора» (#7), `lucky` «Везунчик» (#8), `shock_worker` «Передовик» (#10), `borrower` «Заёмщик» (#14), `skeptic` «Скептик» (#22), `enlightened` «Прозревший» (#23), `all_bottoms` «Прошёл всё. Буквально» (#31).

### 5.6 Сводка: умолчания и P0-объём

- **Дефолтная экипировка:** `skin:fruit`, `theme:neon`, `sound:classic`, `title:client`.
- **P0 каталог** (CD-19):
  - 4 скина: fruit, bandit_90s, clown, grey_reality;
  - 2 темы: neon, monday_morning;
  - 2 пака: classic, honest;
  - 10 титулов.
- **Гардероб:** закрытая вещь показывается силуэтом с названием ачивки. Если ачивка скрытая, вместо названия «???».
- Бейдж «новое» у вещей из `profile.unseenCosmetics`.

---

## 6. Мета-профиль (переживает раны)

```ts
interface Profile {
  version: number
  stats: LifetimeStats                                                 // §3.1, монотонные
  achievements: Partial<Record<AchievementId, { unlockedAt: number; runId: string | null }>>
  endings: Partial<Record<EndingId, { count: number; firstAt: number; bestGrade?: 'A'|'B'|'C' }>>
  equipped: { skin: CosmeticId; theme: CosmeticId; sound: CosmeticId; title: CosmeticId }
  unseenCosmetics: CosmeticId[]                                        // бейдж «новое» в Гардеробе
  runHistory: RunSummary[]                                             // последние 20, FIFO
  flags: { tutorialDone: boolean; hintsSeen: string[] }
}
interface RunSummary {
  runId: string; startedAt: number; endedAt: number
  endingId: EndingId | 'abandoned'; grade?: 'A'|'B'|'C'
  days: number; extraWeeks: number; casinoNetFinal: number
  totalWagered: number; totalPaidOut: number; playSec: number
}
```

**Сохраняется между ранами:**
- lifetime-статистика;
- ачивки;
- коллекция концовок со счётчиком и лучшей оценкой «Завязал»;
- экипировка;
- история 20 ранов (для «За всё время», доли ранов в плюсе и P2-карточки);
- флаги обучения: обучение первых 2 дней не показывается повторно, но включается в Настройках.

**Не сохраняется** (пиллар 5):
- деньги, вещи, долг, тильт, репутация;
- любые бонусы к экономике;
- мета-валюта: поле `meta.currency/upgrades` из ADR-005 **удаляется**;
- «наследуемые бонусы» `progression.ts`: в P0 их нет. P1-предыстории — это другие стартовые условия, а не усиления. Их доступность вычисляется из `endings`.

**Жизненный цикл:**
1. `runStarted` → `stats.runsStarted++`.
2. Каждое событие → `reduceStats` на run и lifetime → `evaluateAchievements` → сейв. Всё в **одной атомарной записи**, поэтому перезагрузка не откатывает статистику и ачивки.
3. `runEnded`:
   - `casinoBalanceForfeited`, `itemsLost`;
   - `endings[id].count++`, обновление `bestGrade`;
   - push в `runHistory`;
   - `buildStatement` (данные Выписки кладутся в UI-стор);
   - `run = null`.
4. «Новая игра» при активном ране — это `runEnded('abandoned')`: статистика уже учтена, концовка не засчитывается, Выписка показывается кратко.
5. «ЕЩЁ НЕДЕЛЮ» продолжает тот же `runId`: статистика рана не сбрасывается, `extraWeeks++`.

**Хранение:** `dodepaMeta` из документов CD — это логическое имя `Profile`. Физически по ADR-008 он лежит в `save.profile` единого файла, чтобы запись run + profile была атомарной. Настройки — `save.settings` (ADR-005): громкость, `calm`, быстрый спин, язык. В профиль они не входят.

---

## 7. Открытые вопросы и сущности для реестра

**Нужны решения:**
1. **[владелец/CD]** 31 ачивка вместо 30: добавлен `ENDING_LOST_WEEK`, иначе «Коллекционер дна» опирается на концовку без своей ачивки. Альтернатива для ровно 30: убрать `BEGINNERS_LUCK`. Рекомендую 31: у Steam нет лимита.
2. **[CD]** Правила порогов 70 и 100 (0⚡, «Ночь», −20%) меняют ресурсы, но не исходы. Если «только подача» понималось строго, `TILT_FREE_SPIN_AT = 101` и `NIGHT_LOSS_SHARE = 0` выключают их без кода. Тогда концовка `lost_week` остаётся, но «Ночь» становится только сюжетной: день заканчивается.
3. **[economy-designer]** Источники с меткой [SD]: `scheme_fail` +10, `bill_deferred` +15, `withdraw` −5, `one_more_week` +10, `TILT_AFTER_NIGHT` 50. Проверить на целях симуляции §2.8.
4. **[CD/writer]** Пропорция серого тикера по таблице v1 — 1:6, а не 1:9. Выводим из конфига.
5. **[TD]** `dodepaMeta` как отдельный ключ (CD-05, CD-13) против единого `save.profile` (ADR-008). Рекомендую ADR-008 из-за атомарности. Поле `cosmetics.owned` не хранить (§5.1). `meta.currency` удалить.
6. **[game-designer, CD-01]** `EndingId` и когда в бесконечном режиме доступно «ЗАВЯЗАТЬ». Рекомендация: на каждом дне 7k (k ≥ 4) при долге 0.

**Новые кросс-системные сущности** (предлагаю внести в `design/registry/entities.yaml`, реестра пока нет):
- `EndingId` ×7;
- `SymbolId` ×8;
- `TiltStage` ×4, `TiltSource` ×13;
- 31 + 2 `AchievementId`;
- `CosmeticId` (9 скинов, 4 темы, 4 пака, 10 титулов);
- константы `TILT_*`, `NIGHT_LOSS_SHARE`, `SPIN_ENERGY_COST`, `AWAKE_HOURS`, `NIGHT_HOURS`, `IDLE_CUTOFF_SEC`, `EQ_*`;
- список токенов тем §5.3.
