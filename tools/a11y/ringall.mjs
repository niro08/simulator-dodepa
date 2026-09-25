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
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
const G = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('game')`
await p.goto((process.env.URL || 'http://localhost:5287/simulator-dodepa/')); await p.waitForSelector('.menu')
async function check(label) {
  // фокусируем каждый видимый фокусируемый элемент с клавиатуры (focus-visible через Tab-подобный путь: keyboard modality)
  await p.keyboard.press('Shift'); 
  const r = await p.evaluate(() => {
    const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { c: v.slice(0, 3), a: v[3] ?? 1 } }
    const izn = document.documentElement.dataset.layer === 'iznanka'
    const gray = ([r, g, b]) => { const y = .2126 * r + .7152 * g + .0722 * b; return [y, y, y] }
    const lin = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }
    const L = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b)
    const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
    const dialog = document.querySelector('[aria-modal="true"]:last-of-type')
    const scope = [...document.querySelectorAll('[aria-modal="true"]')].pop() || document
    const bad = []
    for (const el of scope.querySelectorAll('button, a[href], input, select, [tabindex="0"]')) {
      if (!el.getClientRects().length || el.closest('[inert],[aria-hidden="true"]')) continue
      el.focus({ focusVisible: true }); if (document.activeElement !== el) continue
      const cs = getComputedStyle(el)
      let ring = null, how = ''
      if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) { ring = parse(cs.outlineColor)?.c; how = 'outline' }
      else if (cs.boxShadow !== 'none') { ring = parse(cs.boxShadow)?.c; how = 'shadow' }
      if (!ring) { bad.push(`NO RING ${el.tagName.toLowerCase()}.${(el.className?.toString?.() || '').split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 25)}"`); continue }
      let bg = null, inV = false
      for (let a = parseFloat(cs.outlineOffset) < 0 ? el : el.parentElement; a; a = a.parentElement) { const c = parse(getComputedStyle(a).backgroundColor); if (c && c.a > .5) { bg = c.c; inV = izn && !!a.closest('.vitrina'); break } }
      bg = bg || parse(getComputedStyle(document.body).backgroundColor).c
      const vis = izn && el.closest('.vitrina')
      const rr = ratio(vis ? gray(ring) : ring, inV ? gray(bg) : bg)
      if (rr < 3) bad.push(`${rr.toFixed(2)} ${how} ${el.tagName.toLowerCase()}.${(el.className?.toString?.() || '').split(' ')[0]} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 25)}" ring=${ring} bg=${bg.map(Math.round)}`)
    }
    document.activeElement?.blur?.()
    return [...new Set(bad)]
  })
  console.log(`\n## ${label} (${r.length})\n` + r.slice(0, 14).join('\n'))
}
const theme = (t) => p.evaluate((t) => (document.documentElement.dataset.theme = t), t)
const layer = (l) => p.evaluate((l) => (document.documentElement.dataset.layer = l), l)
for (const t of ['neon', 'monday', 'mirror47', 'stream']) { await theme(t); await check('menu ' + t) }
await theme('neon')
await p.getByRole('button', { name: 'Настройки' }).click(); await p.waitForTimeout(300); await check('settings'); await p.keyboard.press('Escape')
await p.locator('.menu__item', { hasText: 'Гардероб' }).click(); await p.waitForTimeout(300); await check('wardrobe'); await p.keyboard.press('Escape'); await p.waitForTimeout(300)
await p.getByRole('button', { name: /Новый ран/ }).click(); await p.waitForTimeout(900)
for (const t of ['neon', 'monday', 'mirror47', 'stream']) { await theme(t); await layer('vitrina'); await check('game ' + t); await layer('iznanka'); await check('iznanka ' + t) }
await theme('neon'); await layer('vitrina')
await p.keyboard.press('KeyD'); await p.waitForTimeout(400); await check('cashier'); await layer('iznanka'); await check('cashier iznanka'); await layer('vitrina'); await p.keyboard.press('Escape'); await p.waitForTimeout(300)
await p.keyboard.press('Escape'); await p.waitForTimeout(300); await check('pause'); await p.keyboard.press('Escape'); await p.waitForTimeout(300)
await p.keyboard.press('KeyN'); await p.waitForTimeout(400); await check('sleep confirm'); await p.keyboard.press('Escape'); await p.waitForTimeout(300)
const step = async (want) => { await p.evaluate(`(() => { const s = ${G}; for (let i = 0; i < 300 && s.phase !== '${want}' && s.phase !== 'ended'; i++) { const ph = s.phase; if (ph === 'day') s.execute({ type: 'day/sleep' }); else if (ph === 'event') s.execute({ type: 'event/choose', option: Math.max(0, s.pendingEvent?.options?.findIndex((x) => x.affordable) ?? 0) }); else if (ph === 'daySummary' || ph === 'morning') s.execute({ type: 'day/wake' }); else if (ph === 'bills') s.execute({ type: 'bills/refuse' }); else if (ph === 'fork') s.execute({ type: 'run/quit' }) || s.execute({ type: 'run/extend' }); else break } })()`); await p.waitForTimeout(700) }
for (const ph of ['daySummary', 'morning', 'event', 'bills', 'fork', 'ended']) { await step(ph); await check('phase ' + ph) }
const st = p.getByRole('button', { name: /выписк/i }).first(); if (await st.count()) { await st.click(); await p.waitForTimeout(800); await check('statement') }
await b.close()
