import { describe, expect, it } from 'vitest'
import { lockScroll, unlockScroll } from './modalStack'

describe('lockScroll / unlockScroll', () => {
  it('модалка открылась в том же тике, где закрылась другая: скролл возвращается после последней', () => {
    const body = { style: { overflow: '' } }
    const offer = Symbol('offer')
    const cashier = Symbol('cashier')
    lockScroll(offer, body)
    // «ЗАБРАТЬ» в оффере: касса активируется раньше, чем оффер деактивируется
    lockScroll(cashier, body)
    unlockScroll(offer, body)
    expect(body.style.overflow).toBe('hidden')
    unlockScroll(cashier, body)
    expect(body.style.overflow).toBe('')
  })

  it('повторные lock/unlock одной модалки не ломают счёт и возвращают исходное значение', () => {
    const body = { style: { overflow: 'auto' } }
    const a = Symbol('a')
    lockScroll(a, body)
    lockScroll(a, body)
    unlockScroll(a, body)
    expect(body.style.overflow).toBe('auto')
    unlockScroll(a, body)
    expect(body.style.overflow).toBe('auto')
  })
})
