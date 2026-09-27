import { describe, expect, it } from 'vitest'
import { defaultConfig } from '@/game'
import * as ru from './ru'
import * as ui from './ui'
import { BONUS_OFFER, EXIT_CONFIRM, TICKER_HONEST, TICKER_SHOWCASE, tickerHonest } from './ui'

/** QA (Task 6): статические проверки переписанных текстов. */

type Found = { path: string; text: string }

function collect(value: unknown, path: string, out: Found[], seen = new WeakSet<object>()) {
  if (typeof value === 'string') out.push({ path, text: value })
  else if (value && typeof value === 'object') {
    if (seen.has(value)) return
    seen.add(value)
    for (const [k, v] of Object.entries(value)) collect(v, `${path}.${k}`, out, seen)
  }
}

function allStrings(): Found[] {
  const out: Found[] = []
  for (const [name, v] of Object.entries(ru)) collect(v, `ru.${name}`, out)
  for (const [name, v] of Object.entries(ui)) collect(v, `ui.${name}`, out)
  return out
}

const MASK = /^([А-ЯЁA-Z][а-яёa-z]?\*{3}[а-яёa-z]*)/

describe('тексты: инварианты после переписывания', () => {
  it('тикеры: одинаковая длина, пары начинаются с одного замаскированного имени', () => {
    expect(TICKER_HONEST).toHaveLength(TICKER_SHOWCASE.length)
    const honest = tickerHonest(defaultConfig.stats)
    const bad: string[] = []
    TICKER_SHOWCASE.forEach((s, i) => {
      const a = s.match(MASK)?.[1]
      const b = honest[i]!.match(MASK)?.[1]
      if (a && b && a !== b) bad.push(`#${i}: ${a} ≠ ${b}`)
    })
    expect(bad).toEqual([])
  })

  it('EXIT_CONFIRM: honest[i] на каждую lines[i], строки непустые', () => {
    expect(EXIT_CONFIRM.lines.length).toBeGreaterThan(0)
    expect(EXIT_CONFIRM.honest).toHaveLength(EXIT_CONFIRM.lines.length)
    for (const s of [...EXIT_CONFIRM.lines, ...EXIT_CONFIRM.honest]) expect(s.trim()).not.toBe('')
  })

  it('нет протёкших {плейсхолдеров} в ui.ts и в собранных строках', () => {
    const leaks = allStrings()
      .filter((f) => f.path.startsWith('ui.') && !f.path.startsWith('ui.TICKER_HONEST.'))
      .filter((f) => /\{\w+\}/.test(f.text))
    expect(leaks).toEqual([])
    const rendered = [
      ...tickerHonest(defaultConfig.stats),
      BONUS_OFFER.body(1000, 2000),
      ...[BONUS_OFFER.terms(1, 5000, 30, 100)].flat()
    ].join('\n')
    expect(rendered).not.toMatch(/\{\w+\}/)
  })

  it("'04:59' только в BONUS_OFFER.timer и TIMER_LIES", () => {
    const hits = allStrings()
      .filter((f) => f.text.includes('04:59'))
      .map((f) => f.path)
      .filter((p) => p !== 'ui.BONUS_OFFER.timer' && !p.includes('.TIMER_LIES.'))
    expect(hits).toEqual([])
  })

  it("нет устаревшего 'два подтверждения'", () => {
    const hits = allStrings().filter((f) => /два подтверждени/i.test(f.text))
    expect(hits).toEqual([])
  })
})
