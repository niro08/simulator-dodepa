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
