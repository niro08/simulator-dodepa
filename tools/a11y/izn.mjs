/**
 * CD-21: браузерный аудит доступности (Playwright + axe-core). Не входит в npm test.
 * Запуск: собрать и поднять превью (npx vite preview --port 5287), затем
 *   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers PW_MODULE=/opt/node22/lib/node_modules/playwright \
 *   AXE_JS=<путь к axe-core/axe.min.js> OUT=/tmp/a11y.json node tools/a11y/{audit,ringall,izn}.mjs
 * audit.mjs  — axe (WCAG 2.1 AA + best-practice), горизонтальный скролл, таргеты < 44px, заголовки,
 *              обход Tab, live-регионы при спине, AudioContext до жеста, анимации (Гц) в обычном/calm/reduced-motion.
 * ringall.mjs — контраст кольца фокуса (≥ 3:1) у каждого фокусируемого элемента во всех темах и в Изнанке.
 * izn.mjs    — эффективный контраст текста внутри .vitrina под фильтром Изнанки.
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PW_MODULE || 'playwright')
const b = await chromium.launch()
for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 740 }]) {
const p = await (await b.newContext({ viewport: vp })).newPage()
await p.goto((process.env.URL || 'http://localhost:5287/simulator-dodepa/')); await p.waitForSelector('.menu')
await p.getByRole('button', { name: /Новый ран/ }).click(); await p.waitForTimeout(900)
await p.evaluate(() => document.activeElement?.blur()); await p.keyboard.press('KeyI'); await p.waitForTimeout(500)
for (const th of ['neon', 'monday', 'mirror47', 'stream']) {
  await p.evaluate((t) => (document.documentElement.dataset.theme = t), th); await p.waitForTimeout(150)
  const r = await p.evaluate(() => {
    const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { c: v.slice(0, 3), a: v[3] ?? 1 } }
    const filt = ([r, g, b]) => { let y = (.2126 * r + .7152 * g + .0722 * b) / 255; y = Math.min(1, Math.max(0, y)) * 255; return [y, y, y] }
    const lin = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }
    const L = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b)
    const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor).c
    const res = []
    for (const el of document.querySelectorAll('.vitrina *')) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      if (!el.getClientRects().length || el.closest('[aria-hidden="true"]')) continue
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue
      const fg = parse(cs.color); if (!fg || cs.webkitTextFillColor?.includes('0, 0, 0, 0')) continue
      let bg = null, img = false, inV = false
      for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.backgroundImage !== 'none') img = true; const c = parse(s.backgroundColor); if (c && c.a > .5) { bg = c.c; inV = !!a.closest('.vitrina'); break } }
      const B = bg ? (inV ? filt(bg) : bg) : bodyBg
      const rr = ratio(filt(fg.c), B)
      const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700
      const min = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      if (rr < min) res.push(`${rr.toFixed(2)}<${min} ${el.className.toString().split(' ').slice(0, 2).join('.') || el.tagName} "${el.textContent.trim().slice(0, 30)}" fg=${cs.color} bg=${bg ?? 'body'}${img ? ' [bg-image]' : ''} ${size}px`)
    }
    return [...new Set(res)]
  })
  console.log(`\n## ${vp.width} ${th} (${r.length})\n` + r.slice(0, 25).join('\n'))
}
}
await b.close()
