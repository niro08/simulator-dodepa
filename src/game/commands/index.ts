/**
 * Реестр обработчиков команд.
 *
 * Как добавить новую команду:
 * 1. types.ts: добавить вариант в `Command` (и, если нужно, событие в `GameEvent`, причину в `RejectReason`).
 * 2. Написать обработчик `CommandHandler` в commands/<домен>.ts; числа — в config/balance.ts.
 * 3. Зарегистрировать его ниже — TypeScript не соберёт проект, пока команда без обработчика.
 * 4. i18n/ru.ts: текст события в formatEvent (switch исчерпывающий — TS подскажет) и, при нужде, отказа;
 *    новое событие — ещё и в EVENT_TYPES (save/validate.ts).
 * 5. Тест в commands/<домен>.test.ts. В UI — `store.execute({ type: ... })` и `store.canExecute(...)`.
 */
import type { Command, CommandType } from '../types'
import { bankLoanHandler, mfoLoanHandler, repayHandler } from './bank'
import { depositHandler, enterHandler, leaveHandler, withdrawHandler } from './casino'
import {
  chooseEventHandler,
  deferBillHandler,
  extendHandler,
  payBillHandler,
  quitHandler,
  refuseBillHandler,
  resumeHandler,
  sleepHandler,
  wakeHandler
} from './day'
import { borrowHandler, familyHandler } from './friends'
import { pawnHandler, redeemHandler } from './pawn'
import { setBetHandler, spinHandler } from './slot'
import type { CommandHandler } from './types'
import { shadyHandler, shiftHandler } from './work'

type HandlerMap = { [K in CommandType]: CommandHandler<Extract<Command, { type: K }>> }

export const HANDLERS: HandlerMap = {
  'day/wake': wakeHandler,
  'day/sleep': sleepHandler,
  'day/resume': resumeHandler,
  'event/choose': chooseEventHandler,
  'bills/pay': payBillHandler,
  'bills/defer': deferBillHandler,
  'bills/refuse': refuseBillHandler,
  'run/quit': quitHandler,
  'run/extend': extendHandler,
  'casino/enter': enterHandler,
  'casino/leave': leaveHandler,
  'casino/deposit': depositHandler,
  'casino/withdraw': withdrawHandler,
  'bet/set': setBetHandler,
  'slot/spin': spinHandler,
  'work/shift': shiftHandler,
  'work/shady': shadyHandler,
  'family/help': familyHandler,
  'friends/borrow': borrowHandler,
  'bank/loan': bankLoanHandler,
  'mfo/loan': mfoLoanHandler,
  'debt/repay': repayHandler,
  'pawn/pawn': pawnHandler,
  'pawn/redeem': redeemHandler
}

/** Обработчик для произвольной команды (сужение типа внутри реестра гарантирует HandlerMap). */
export function handlerFor<C extends Command>(cmd: C): CommandHandler<C> {
  return HANDLERS[cmd.type] as unknown as CommandHandler<C>
}

export type { CommandHandler } from './types'
