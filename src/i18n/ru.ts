import { slotMetrics } from '@/game'
import type {
  CommandType,
  EndingId,
  EventOf,
  GameConfig,
  GameEvent,
  Grade,
  ItemId,
  Rejection,
  RejectReason,
  SpinResult,
  TiltStage
} from '@/game'

/**
 * Русские тексты. Хроника и отказы строятся из событий ядра; тексты — design/content-pack.md
 * (§1 концовки, §6 кнопки, §9 хроника, §10 ломбард, §11 тильт, §12 «Как играть»).
 * Числа баланса сюда не хардкодятся: либо из события, либо из config.
 */

/** Число со знаком: +5 / -3. */
export function signed(n: number | undefined): string {
  const v = n ?? 0
  return v > 0 ? `+${v}` : `${v}`
}

/** Сумма с пробелами между тысячами: 30 000. */
export function money(n: number): string {
  const sign = n < 0 ? '−' : ''
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Вариант текста: стабильно по номеру записи хроники (без повторов подряд у соседних записей). */
function pick(variants: readonly string[], variant: number): string {
  return variants[Math.abs(variant) % variants.length] ?? variants[0] ?? ''
}

// ─── Справочники ───────────────────────────────────────────────────────────

export const ITEM_NAMES: Record<ItemId, string> = {
  phone: '📱 Телефон',
  bike: '🚲 Велосипед',
  laptop: '💻 Ноутбук',
  teaset: '🫖 Бабушкин сервиз',
  console: '🎮 Приставка'
}

export const TILT_STAGE_LABELS: Record<TiltStage, { v: string; i: string }> = {
  calm: { v: 'ХОЛОДНАЯ ГОЛОВА', i: 'Решения принимаешь ты.' },
  heated: { v: 'РАЗОГРЕТ 🔥', i: 'Решения становятся дороже. Баннеры — громче.' },
  tilt: { v: 'В УДАРЕ 🔥🔥', i: 'Время не замечается: спины стоят 0⚡. Выход — через два подтверждения.' },
  night: { v: 'ЛЕГЕНДА НОЧИ 🔥🔥🔥', i: 'Ночь в казино. День закончен. −20% баланса.' }
}

export interface EndingText {
  title: string
  text: string
  statementLine: string
  lockedHint: string
}

/** Концовки (content-pack §1). Плейсхолдеры {week}, {rep}, {count}… подставляет экран Выписки. */
export const ENDINGS: Record<EndingId, EndingText> = {
  quit: {
    title: 'Завязал',
    text: 'Ты удаляешь приложение, и оно впервые не спрашивает «Вы уверены?».',
    statementLine: 'Итог: вышел.',
    lockedHint: 'Единственный выход, который казино не рекламирует.'
  },
  collectors: {
    title: 'Добрый вечер, мы из банка',
    text:
      'Эдуард больше не звонит, он пришёл сам. Вежливый, в куртке, с папкой, где твоя фамилия написана без единой ошибки. ' +
      'Казино присылает push «Отыграйся, пока не поздно!». Эдуард заглядывает тебе в телефон и говорит: «Уже поздно».',
    statementLine: 'Итог: счёт недели {week} не оплачен. Отсрочка использована. Дело передано.',
    lockedHint: 'Эдуард вежлив. Пока что.'
  },
  jail: {
    title: 'Сел',
    text:
      '«Верняк, без рисков», — говорил человек, которого ты знал три дня. ' +
      'Теперь у тебя режим дня, трёхразовое питание и сосед по камере, который тоже «почти отыгрался». ' +
      'Казино шлёт письма на твою почту, но открыть их некому.',
    statementLine: 'Итог: ты брался за темку {count} раз.',
    lockedHint: 'Некоторые темки заканчиваются расписанием подъёма.'
  },
  family_left: {
    title: 'Семья ушла',
    text:
      'На столе записка маминым почерком: «Позвони, когда будешь готов. Не раньше». ' +
      'Серёга удалил переписку за восемь лет и оставил только твоё «верну в пятницу». ' +
      'В квартире тихо. Шумит только слот: он играет на полной громкости и празднует за двоих.',
    statementLine: 'Итог: ❤️ {rep}. Занимал у близких {count} раз.',
    lockedHint: 'Близкие тоже умеют ставить лимиты.'
  },
  minimalism: {
    title: 'Минимализм',
    text:
      'Ни телефона, ни ноутбука, ни приставки, ни велосипеда, ни сервиза. В кошельке {wallet}₽, а банк и МФО отказали хором. ' +
      'Блогеры называют это «осознанным потреблением». Ты называешь это «утро».',
    statementLine: 'Итог: заложено вещей — 5 из 5. Выкуплено — {count}.',
    lockedHint: 'Полки можно освободить по-разному.'
  },
  casino_nights: {
    title: 'Ночь в казино ×3',
    text:
      'Ты не помнишь, как прошла неделя. В истории — тысячи спинов, в галерее — скриншот «почти 777» в 4:12 утра. ' +
      'Казино присвоило тебе звание «Самый активный игрок недели». Приз — ещё одна неделя, которую ты не вспомнишь.',
    statementLine: 'Итог: тильт 100 — трижды. Помнишь из этих ночей: 0.',
    lockedHint: 'Одна ночь — случайность. Три — стиль жизни.'
  },
  referral: {
    title: 'Реферальная программа',
    text:
      'На балансе {casino_balance}₽, и вывести их тебе не дают: вместо этого дают ссылку. ' +
      '«Бро, ты теперь амбассадор. Стримь, депы мы покроем». ' +
      'Ты включаешь камеру, кричишь «ДОДЕП!», и где-то Ма***а впервые переходит по твоей ссылке. ' +
      'Ты победил. Поздравляем. Нам очень жаль.',
    statementLine: 'Итог: твой RTP теперь — зарплата. RTP твоих рефералов — 90%. Разница — это они.',
    lockedHint: 'Секрет. Есть кое-что хуже проигрыша.'
  }
}

/** «Завязал» с оценкой (content-pack §1: quit_a / quit_b / quit_c). */
export const QUIT_GRADES: Record<Grade, { title: string; text: string; statementLine: string }> = {
  A: {
    title: 'Завязал. Оценка A',
    text:
      'Двадцать восьмое утро. Телефон, ноутбук и бабушкин сервиз на месте, а мама звонит просто так, а не «по делу». ' +
      'Ты удаляешь приложение, и оно впервые не спрашивает «Вы уверены?». Скучно, непривычно и твоё.',
    statementLine: 'Итог: ушёл, пока было что уносить.'
  },
  B: {
    title: 'Завязал. Оценка B',
    text:
      'Долгов нет. Кое-чего на полках тоже нет: ломбард отдаст за 130%, но уже без тебя. ' +
      'Ты удаляешь приложение, и через минуту приходит «Мы скучаем 💔». Впервые за месяц отвечать не хочется.',
    statementLine: 'Итог: вышел с потерями. Это всё равно выход.'
  },
  C: {
    title: 'Завязал. Оценка C',
    text:
      'Долг — ноль. Вещей — ноль. Друзья отвечают, но с паузой перед «привет». ' +
      'Ты сидишь в пустой комнате, и это самая дорогая тишина в твоей жизни. Зато оплачена полностью.',
    statementLine: 'Итог: вышел голым. Но вышел.'
  }
}

export function endingTitle(endingId: EndingId, grade: Grade | null): string {
  return endingId === 'quit' && grade ? QUIT_GRADES[grade].title : ENDINGS[endingId].title
}

/**
 * События сна: тексты карточек. Бытовые карточки economy-v1 §9.2 — плейсхолдеры до writer (CD-11/CD-12).
 */
export const SLEEP_EVENT_TEXTS: Record<string, { speaker: string; text: string; options: [string, string]; results: [string, string] }> = {
  life_fridge: {
    speaker: 'Кухня',
    text: 'Утром холодильник не гудит. Молоко тёплое, мастер — дорогой.',
    options: ['Вызвать мастера', 'Чинить самому'],
    results: ['Мастер пришёл, покачал головой и взял деньги.', 'Полдня с отвёрткой. Холодильник гудит, ты — тоже.']
  },
  life_tooth: {
    speaker: 'Зуб',
    text: 'Ночью заныл зуб. К утру — уже не ноет, а кричит.',
    options: ['Платная клиника', 'Очередь в поликлинику'],
    results: ['Полчаса в кресле — и можно жить.', 'Талон, очередь, «доктор скоро будет». День прошёл в коридоре.']
  },
  life_fine: {
    speaker: 'ЖКХ',
    text: 'В ящике письмо: пени за коммуналку. Красным шрифтом.',
    options: ['Оплатить сразу', 'Отложить'],
    results: ['Оплачено. Письмо — в мусор.', 'Отложил. Долг отложил тебя: теперь он в МФО.']
  }
}

// ─── Хроника ───────────────────────────────────────────────────────────────

function spinText(e: EventOf<'spin'>, variant: number): string {
  const win = money(e.payout)
  const net = e.payout - e.bet
  if (e.outcomeId === 'jackpot') {
    return pick(
      [
        `💥💥💥 ДЖЕКПОТ 7️⃣7️⃣7️⃣! +${win}₽!!!`,
        `7️⃣7️⃣7️⃣ ТЫ СДЕЛАЛ ЭТО! +${win}₽! ВЫВОДИ… ИЛИ ДОДЕПНИ! 🚀`,
        `ТРИ ТОПОРА!!! +${win}₽! Легенды существуют!`
      ],
      variant
    )
  }
  if (e.multiplier >= 10) {
    return pick(
      [`🔥🔥 БОЛЬШОЙ ВЫИГРЫШ x${e.multiplier}! +${win}₽!`, `💎 МЕГА x${e.multiplier}!!! +${win}₽! ЛЕГЕНДА!`, `СКРИНЬ! x${e.multiplier} = +${win}₽! 📸`],
      variant
    )
  }
  if (e.multiplier >= 2) {
    return pick(
      [`💰 x${e.multiplier}! +${win}₽! ТЫ ГОРИШЬ! 🔥`, `🎉 x${e.multiplier}! Вот это заход! +${win}₽!`, `x${e.multiplier}!!! Удача любит смелых! +${win}₽`],
      variant
    )
  }
  if (e.multiplier === 1) {
    return pick([`ВЫИГРЫШ +${win}₽! Ставка вернулась с победой!`, `💰 +${win}₽! Ты при своих — и это только начало!`], variant)
  }
  if (e.ldw) return pick([`🎉 ВЫИГРЫШ +${win}₽! Ты в игре!`, `💰 +${win}₽! Деньги идут к тебе!`, `🎺 ЕСТЬ! +${win}₽!`], variant)
  if (e.nearMiss) {
    return pick(['7️⃣7️⃣ — ПОЧТИ!!! Совсем чуть-чуть! 😱', 'ДВЕ СЕМЁРКИ! Третья была РЯДОМ!', 'Так близко к 777! Удача разогревается! 🔥'], variant)
  }
  if (e.allIn) return pick([`ДОДЕП ВСЁ: ${money(e.bet)}₽ на один спин! 🔥 Смелость — это стиль!`, `ВСЁ НА КОН — ${money(e.bet)}₽!`], variant)
  return pick(
    [`${signed(net)}₽. Барабаны не извинились.`, 'Мимо. Но ощущение, что следующий — точно.', `${signed(net)}₽. Казино говорит «спасибо» только в Изнанке.`],
    variant
  )
}

/** Текст события для хроники (голос Витрины/Жизни). Switch исчерпывающий: новое событие без текста не соберётся. */
export function formatEvent(event: GameEvent, variant = 0): string {
  switch (event.type) {
    case 'runStarted':
      return 'Новый ран. Четыре недели, четыре счёта, одна кнопка «ЗАВЯЗАТЬ».'
    case 'dayStarted':
      return `Утро дня ${event.day}. Неделя ${event.week}.`
    case 'slept':
      return pick([`День ${event.day} окончен.`, 'Отбой. Потолок, темнота и ни одного баннера.'], variant)
    case 'spin':
      return spinText(event, variant)
    case 'casinoEntered':
      return 'Ты открыл сайт казино. Баннеры рады тебя видеть.'
    case 'casinoLeft':
      return pick(
        [
          'Ты вышел из казино. Казино не прощается — оно говорит «до скорого».',
          'Вкладка закрыта. Баннеры продолжают мигать без тебя.',
          'Вышел. Первые пять секунд тишины всегда странные.'
        ],
        variant
      )
    case 'deposit':
      return pick(
        [`Депозит ${money(event.amount)}₽ зачислен мгновенно ⚡`, `+${money(event.amount)}₽ на баланс! Удачи, бро! 🍀`, `Зачислено ${money(event.amount)}₽. Как всегда — за 0 секунд.`],
        variant
      )
    case 'bonusGranted':
      return pick([`🎁 БОНУС 200%! +${money(event.bonus)}₽!`, `ТРОЙНОЙ БАЛАНС! +${money(event.bonus)}₽ бонуса! Поехали! 🚀`], variant)
    case 'bonusDeclined':
      return 'Бонус? Нет, спасибо. Баланс не заблокирован.'
    case 'bonusCleared':
      return pick(['🏆 ОТЫГРЫШ ЗАВЕРШЁН! Вывод доступен!', 'Вейджер пройден! Ты — один из немногих!'], variant)
    case 'bonusBusted':
      return pick(['Бонус использован! Новые акции уже ждут! 🎁', 'Баланс обнулился, но бонус тебя ещё порадовал! 😉'], variant)
    case 'withdrawRequested':
      return pick(
        [`Заявка на вывод ${money(event.gross)}₽ принята! Ожидайте ⏳`, `Вывод ${money(event.gross)}₽ оформлен. Ваша заявка очень важна для нас.`],
        variant
      )
    case 'withdrawPaid':
      return pick(
        [`Утро. На кошелёк пришло ${money(event.net)}₽ из казино. Редкий гость.`, `Вывод дошёл: +${money(event.net)}₽ в кошелёк. Держи крепче.`],
        variant
      )
    case 'shiftWorked':
      if (event.promoted) return `Повышение! Смена: +${money(event.pay)}₽. Мама спросила, когда отмечать.`
      if (event.repPenalty) return `Смена: +${money(event.pay)}₽. Коллеги замолкают, когда ты входишь: оплата меньше.`
      return pick(
        [
          `Смена: +${money(event.pay)}₽. Начальник кивнул. Это почти похвала.`,
          `Отработал. +${money(event.pay)}₽ без фанфар, зато навсегда.`,
          `+${money(event.pay)}₽ за смену. Никто не кричал «ВЫИГРЫШ», а деньги есть.`
        ],
        variant
      )
    case 'schemeResolved':
      if (event.jailed) return 'Темка не зашла. В этот раз — совсем.'
      if (event.success) {
        return pick(
          [`Темка зашла: +${money(event.amount)}₽. Ты не спрашивал, что было в коробке.`, `Зашло: +${money(event.amount)}₽. Никто не пострадал. Наверное.`],
          variant
        )
      }
      return pick(
        [`Темка не зашла: штраф −${money(event.fine)}₽. «Верняк» оказался одноразовым.`, `Провал. −${money(event.fine)}₽ и неловкий разговор в отделении.`],
        variant
      )
    case 'friendBorrowed':
      return event.diminished
        ? pick([`Серёга перевёл ${money(event.amount)}₽. Меньше, чем в прошлый раз. И без смайлика.`, `${money(event.amount)}₽. «Больше нет, бро».`], variant)
        : pick([`Серёга перевёл ${money(event.amount)}₽ с подписью «последний раз». Ты это уже видел.`, `+${money(event.amount)}₽ от друга. Пришло с грустным смайликом.`], variant)
    case 'friendsBlocked':
      return '«Вы заблокированы». Коротко и понятно.'
    case 'familyHelped':
      return pick(
        [
          'Помог маме с рассадой. Три часа без мыслей о барабанах.',
          'Починил бабушке кран. Бабушка накормила так, что тильт упал сам.',
          'Отвёз маму на дачу. По дороге говорили о всякой ерунде. Лучшее за неделю.'
        ],
        variant
      )
    case 'loanTaken':
      return event.lender === 'bank'
        ? `Банк одобрил ${money(event.amount)}₽. Менеджер улыбнулся по скрипту.`
        : pick([`«Быстроденьги-ну-почти»: +${money(event.amount)}₽ за 4 минуты.`, `МФО одобрило ${money(event.amount)}₽. Одобряет всем. В этом и дело.`], variant)
    case 'interestAccrued':
      return `Ночью набежало процентов: +${money(event.total)}₽. Долг: ${money(event.debt)}₽.`
    case 'debtRepaid':
      if (event.viaBill) return `Долговая часть счёта: −${money(event.amount)}₽ долга. Остаток ${money(event.debtLeft)}₽.`
      if (event.repGain > 0) return `Погасил ${money(event.amount)}₽. ❤️ +${event.repGain}. Люди замечают, когда ты возвращаешь.`
      return pick(
        [`Погашено ${money(event.amount)}₽. Долг: ${money(event.debtLeft)}₽. Эдуард вычеркнул строчку.`, `Погасил ${money(event.amount)}₽. Остаток ${money(event.debtLeft)}₽.`],
        variant
      )
    case 'forcedMfo':
      return `Недостачу оформили на тебя в МФО: ${money(event.amount)}₽.`
    case 'itemPawned':
      return pick(
        [
          `${ITEM_NAMES[event.itemId]} сдан за ${money(event.amount)}₽. На полке остался прямоугольник без пыли.`,
          `Гоша оценил: ${ITEM_NAMES[event.itemId]} — ${money(event.amount)}₽. «Приходи за ним, пока я добрый».`
        ],
        variant
      )
    case 'itemRedeemed':
      return `${ITEM_NAMES[event.itemId]} снова дома. Выкуп ${money(event.cost)}₽. Ломбард заработал на ностальгии ${money(event.cost - event.pawnAmount)}₽.`
    case 'livingCostPaid':
      return `−${money(event.amount)}₽ на жизнь: еда, свет, связь.`
    case 'billsOpened':
      return `Сегодня день счетов: ${money(event.total)}₽.`
    case 'billPaid':
      return pick(
        [
          `Счёт недели ${event.week} оплачен: −${money(event.amount)}₽. Свет, еда и совесть продлены на 7 дней.`,
          `Счета закрыты. −${money(event.amount)}₽. Никаких фанфар — и это лучший звук недели.`
        ],
        variant
      )
    case 'billDeferred':
      return `Отсрочка: счёт вырос до ${money(event.fixed)}₽. Завтра. Второй раз так не выйдет.`
    case 'billCreated':
      return `Новый счёт недели ${event.week}: ${money(event.fixed)}₽ к дню ${event.dueDay}.`
    case 'forkOpened':
      return event.debt > 0
        ? `Счета оплачены. Долг ${money(event.debt)}₽ не отпускает.`
        : 'Счета оплачены. Приложение всё ещё на телефоне. Палец — над ним.'
    case 'weekChoice':
      return event.choice === 'quit'
        ? 'Ты удалил приложение. Оно впервые не спросило «Вы уверены?».'
        : pick([`Неделя ${event.week + 1}. Ты же говорил: одна.`, `Неделя ${event.week + 1}. Счета выросли. Ты — нет.`], variant)
    case 'tiltChanged':
      return `Тильт ${event.value}.`
    case 'tiltStageChanged':
      switch (event.to) {
        case 'heated':
          return event.from === 'calm' ? 'Тильт 40+. Баннеры стали громче. Или это ты стал тише.' : 'Тильт упал ниже 70. Голова яснее. Цифры те же.'
        case 'tilt':
          return 'Тильт 70+. Время летит незаметно: спины больше не тратят энергию. Бесплатных спинов не бывает.'
        case 'night':
          return 'Тильт 100.'
        case 'calm':
          return 'Тильт упал. Голова яснее. Цифры те же.'
      }
      return ''
    case 'casinoNight':
      return `Ночь в казино. Ты моргнул, а за окном светает. −${money(event.lost)}₽ с баланса казино. Ночей: ${event.n}.`
    case 'sleepEventShown':
      return 'Ночью кое-что случилось.'
    case 'sleepEventResolved':
      return SLEEP_EVENT_TEXTS[event.eventId]?.results[event.choice] ?? 'Решено.'
    case 'runEnded':
      return event.endingId === 'abandoned' ? 'Ран брошен.' : `Конец: ${endingTitle(event.endingId, event.grade)}.`
    case 'betChanged':
      return `Ставка: ${money(event.to)}₽`
    case 'rejected':
      return formatRejection(event.command, event)
    case 'timeTracked':
      return ''
  }
}

/** Честный дубль для режима «Снять очки» (content-pack §9, поле i). null — дубля нет. */
export function formatEventHonest(event: GameEvent): string | null {
  switch (event.type) {
    case 'spin': {
      const net = event.payout - event.bet
      if (event.ldw) return `Возврат ${money(event.payout)}₽ из ${money(event.bet)}₽. Итог ${signed(net)}₽. Фанфары — бесплатно.`
      if (event.nearMiss) return `Проигрыш −${money(event.bet)}₽. Показан «почти-выигрыш». Исход был решён до вращения.`
      if (event.multiplier === 1) return 'Возврат ставки. Итог 0₽.'
      if (event.payout === 0) return `Операция. Ставка ${money(event.bet)}₽. Возврат 0₽. Итог −${money(event.bet)}₽.`
      return `Итог ${signed(net)}₽. На следующий спин это не влияет.`
    }
    case 'deposit':
      return `Перевод ${money(event.amount)}₽ из кошелька в казино. Обратно — только с комиссией и утром.`
    case 'bonusGranted':
      return `Бонус ${money(event.bonus)}₽ выдан. Весь баланс заблокирован до оборота ${money(event.wagerRequired)}₽.`
    case 'bonusCleared':
      return 'Отыгрыш пройден. Удаётся ~8%. Совет: вывести сейчас.'
    case 'bonusBusted':
      return `Отыгрыш не завершён: осталось ${money(event.wagerLeft)}₽. Депозит ушёл вместе с бонусом.`
    case 'withdrawRequested':
      return `Вывод ${money(event.gross)}₽. Комиссия ${money(event.fee)}₽. Поступит в кошелёк утром.`
    case 'casinoNight':
      return `Ночь в казино: списано ${money(event.lost)}₽. 8 часов, которых ты не помнишь.`
    default:
      return null
  }
}

// ─── Отказы ────────────────────────────────────────────────────────────────

type RejectText = string | ((r: Rejection) => string)

const REJECT_DEFAULT: Record<RejectReason, RejectText> = {
  wrong_phase: 'Сейчас не время',
  in_casino: 'Ты в казино',
  not_in_casino: 'Сначала зайди в казино',
  no_energy: 'Нет сил',
  no_money: (r) => (r.min ? `Нужно ${money(r.min)}₽` : 'Недостаточно денег'),
  bet_below_min: (r) => `Мин. ставка ${money(r.min ?? 0)}₽`,
  amount_below_min: (r) => `Мин. ${money(r.min ?? 0)}₽`,
  invalid_amount: 'Введи сумму',
  bonus_locked: (r) => `Бонус не отыгран: осталось ${money(r.min ?? 0)}₽ оборота`,
  daily_limit: 'Сегодня ты уже помогал',
  friends_blocked: 'Вы заблокированы',
  no_phone: 'Телефон в ломбарде',
  friends_broke: 'Друзьям самим не хватает',
  rep_too_low: (r) => `Банку нужна ❤️ ≥ ${r.min ?? 0}`,
  debt_limit: (r) => `Лимит долга ${money(r.min ?? 0)}₽`,
  no_debt: 'Долгов нет. Пока',
  item_not_owned: 'Этой вещи у тебя нет',
  item_not_pawned: 'Эта вещь не в ломбарде',
  no_bill: 'Счетов нет',
  not_due: (r) => `Счёт через ${r.min ?? 0} дн.`,
  grace_used: 'Отсрочка уже была',
  not_fork_day: 'Завязать можно в день счёта недели 4',
  bill_unpaid: 'Сначала счёт',
  has_debt: (r) => `Долг ${money(r.min ?? 0)}₽. Так не завязывают`,
  forced: 'Ночь уже началась',
  feature_disabled: 'Недоступно',
  no_event: 'Карточки нет',
  option_unaffordable: (r) => `Не хватает: нужно ${money(r.min ?? 0)}₽`
}

/** Тексты отказов, специфичные для команды (перекрывают REJECT_DEFAULT). */
const REJECT_BY_COMMAND: Partial<Record<CommandType, Partial<Record<RejectReason, RejectText>>>> = {
  'slot/spin': {
    no_money: 'Баланс казино пуст. ДЕПОЗИТ?',
    no_energy: 'Нет сил. Даже крутить'
  },
  'casino/deposit': {
    amount_below_min: (r) => `Мин. депозит ${money(r.min ?? 0)}₽`,
    no_money: 'В кошельке нет столько'
  },
  'casino/withdraw': {
    amount_below_min: (r) => `Мин. вывод ${money(r.min ?? 0)}₽`,
    no_money: 'На балансе нет столько'
  },
  'work/shift': { no_energy: (r) => `Смена — ${r.min ?? 0}⚡. Сил нет` },
  'work/shady': { no_energy: (r) => `На темку нужно ${r.min ?? 0}⚡` },
  'family/help': { no_energy: 'Сил не осталось даже на семью' },
  'friends/borrow': { no_energy: (r) => `Выпрашивать деньги тоже тяжело. Нужно ${r.min ?? 0}⚡` },
  'debt/repay': { no_money: 'В кошельке не хватает. Долг подождёт. Проценты — нет' },
  'pawn/redeem': { no_money: (r) => `Выкуп — 130%: ${money(r.min ?? 0)}₽` },
  'bills/pay': { no_money: (r) => `Нужно ${money(r.min ?? 0)}₽ в кошельке` }
}

/** Текст отказа команды (для хроники и подсказок под кнопками). */
export function formatRejection(command: CommandType, rejection: Rejection): string {
  const text = REJECT_BY_COMMAND[command]?.[rejection.reason] ?? REJECT_DEFAULT[rejection.reason]
  return typeof text === 'function' ? text(rejection) : text
}

// ─── Слот ──────────────────────────────────────────────────────────────────

/** Крупная надпись результата в слот-машине (Витрина празднует и LDW — это сатира). */
export function formatSpinBanner(result: SpinResult): string {
  if (result.outcomeId === 'jackpot') return `💥 ДЖЕКПОТ 777! +${money(result.payout)}₽`
  if (result.payout > 0) return `🎉 ВЫИГРЫШ! +${money(result.payout)}₽`
  if (result.nearMiss) return '😱 ПОЧТИ!!! 7️⃣7️⃣…'
  return '😔 Не повезло...'
}

/** Тон записи хроники — для оформления (отказ визуально отличается от успеха, TD-06). */
export type EventTone = 'info' | 'win' | 'jackpot' | 'lose' | 'rejected' | 'warn'

export function eventTone(event: GameEvent): EventTone {
  switch (event.type) {
    case 'rejected':
      return 'rejected'
    case 'spin':
      if (event.outcomeId === 'jackpot') return 'jackpot'
      return event.payout > 0 ? 'win' : 'lose'
    case 'forcedMfo':
    case 'casinoNight':
    case 'bonusBusted':
    case 'friendsBlocked':
    case 'runEnded':
      return 'warn'
    default:
      return 'info'
  }
}

// ─── «Как играть» (content-pack §12.1, числа — из конфига) ─────────────────

export function howToPlay(config: GameConfig): { title: string; lines: string[]; footer: string } {
  const B = config.balance
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const rtp = slotMetrics(config.slot).rtp
  return {
    title: '📖 Как играть',
    lines: [
      `У тебя ${B.RUN_DAYS} дней. Цель — оплатить ${B.BILLS.length} счёта и на ${B.RUN_DAYS}-й день нажать «ЗАВЯЗАТЬ» без долга.`,
      `Каждое утро — ${B.ENERGY_PER_DAY}⚡. Смена, семья, друзья и слот тратят энергию.`,
      `Кошелёк ≠ баланс казино. Депозит — мгновенно. Вывод — утром и минус ${pct(B.WITHDRAW_FEE)}.`,
      `Счета (дни ${B.BILLS.map((_, i) => 7 * (i + 1)).join(', ')}) платятся только из кошелька. Одна отсрочка — +${pct(B.GRACE_PENALTY)}.`,
      `Слот честно случайный: RTP ${pct(rtp)}. На каждые 100₽ ставок в среднем −${Math.round(100 * (1 - rtp))}₽. Стратегии нет.`,
      `Тильт 🔥 растёт от проигрышей. На ${B.TILT_T2} время летит незаметно, на ${B.TILT_MAX} ты ночуешь в казино.`,
      'Быстрые деньги — темка, МФО, ломбард, друзья — всегда оставляют след. Смотри, какой.',
      `Сон: −${B.LIVING_COST}₽ на жизнь, проценты по долгу, тильт −${B.TILT_SLEEP_DECAY}. Иногда ночью что-то случается.`,
      '👓 «Снять очки» — показывает, что на самом деле происходит на экране.',
      'Концовок семь. Хорошая — одна.'
    ],
    footer: 'Выиграть у казино нельзя. Выиграть у этой игры можно: вовремя уйти.'
  }
}
