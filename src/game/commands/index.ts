/**
 * Реестр обработчиков команд.
 *
 * Как добавить новую команду:
 * 1. types.ts: добавить вариант в `Command` (и, если нужно, событие в `GameEvent`, причину в `RejectReason`).
 * 2. Написать обработчик `CommandHandler` в commands/<домен>.ts; числа — в config/balance.ts.
 * 3. Зарегистрировать его ниже — TypeScript не соберёт проект, пока команда без обработчика.
 * 4. i18n/ru.ts: текст события в formatEvent (switch исчерпывающий — TS подскажет) и, при нужде, отказа.
 * 5. Тест в commands/<домен>.test.ts. В UI — `store.execute({ type: ... })` и `store.canExecute(...)`.
 */
import type { Command, CommandType } from '../types'
import { creditHandler, repayHandler } from './bank'
import { borrowHandler, helpHandler } from './friends'
import { setBetHandler, spinHandler } from './slot'
import type { CommandHandler } from './types'
import { jobHandler, shadyHandler } from './work'

type HandlerMap = { [K in CommandType]: CommandHandler<Extract<Command, { type: K }>> }

export const HANDLERS: HandlerMap = {
  'slot/spin': spinHandler,
  'bet/set': setBetHandler,
  'work/job': jobHandler,
  'work/shady': shadyHandler,
  'friends/borrow': borrowHandler,
  'friends/help': helpHandler,
  'bank/credit': creditHandler,
  'bank/repay': repayHandler
}

/** Обработчик для произвольной команды (сужение типа внутри реестра гарантирует HandlerMap). */
export function handlerFor<C extends Command>(cmd: C): CommandHandler<C> {
  return HANDLERS[cmd.type] as unknown as CommandHandler<C>
}

export type { CommandHandler } from './types'
