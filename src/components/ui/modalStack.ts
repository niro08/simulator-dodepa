/**
 * Стопка открытых модалок (Modal.vue). Фокус-трап и клавиши обрабатывает только верхняя:
 * две модалки с document-обработчиком focusin иначе бесконечно перетягивают фокус (CD-21).
 */
const stack: symbol[] = []

export function pushModal(token: symbol): void {
  popModal(token)
  stack.push(token)
}

export function popModal(token: symbol): void {
  const i = stack.indexOf(token)
  if (i >= 0) stack.splice(i, 1)
}

export function isTopModal(token: symbol): boolean {
  return stack[stack.length - 1] === token
}

/**
 * Блокировка прокрутки страницы — одна на всю стопку. Раньше каждая модалка сама
 * запоминала body.style.overflow и восстанавливала его при закрытии: когда одна модалка
 * закрывается в том же тике, в котором открывается другая (оффер бонуса → касса),
 * вторая запоминала чужое 'hidden' и возвращала его после закрытия — скролл умирал навсегда.
 */
type ScrollTarget = { style: { overflow: string } }

const locks = new Set<symbol>()
let savedOverflow = ''

export function lockScroll(token: symbol, target: ScrollTarget): void {
  if (locks.has(token)) return
  if (locks.size === 0) {
    savedOverflow = target.style.overflow
    target.style.overflow = 'hidden'
  }
  locks.add(token)
}

export function unlockScroll(token: symbol, target: ScrollTarget): void {
  if (!locks.delete(token)) return
  if (locks.size === 0) target.style.overflow = savedOverflow
}
