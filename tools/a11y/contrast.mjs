/** CD-21: контраст всех пар токенов (4 темы Витрины, бумага светлая/тёмная). Запуск: node tools/a11y/contrast.mjs */
import { readFileSync } from 'node:fs'
const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
function block(sel) {
  const i = css.indexOf(sel); if (i < 0) throw new Error(sel)
  const s = css.indexOf('{', i), e = css.indexOf('\n}', s)
  const out = {}
  for (const m of css.slice(s + 1, e).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}
const base = block(':root,\n[data-theme="neon"]')
const themes = { neon: {}, monday: block('[data-theme="monday"]'), mirror47: block('[data-theme="mirror47"]'), stream: block('[data-theme="stream"]') }
const darkPaper = block('[data-paper="dark"] {')
function resolve(vars, v, d = 0) {
  if (d > 10) return v
  return v.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, n, fb) => resolve(vars, vars[n] ?? fb ?? '', d + 1))
}
function hexes(s) {
  const out = []
  for (const m of s.matchAll(/#([0-9a-f]{3,8})\b|rgba?\(([^)]+)\)/gi)) {
    if (m[1]) { let h = m[1]; if (h.length === 3) h = [...h].map(c => c + c).join(''); out.push([0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))) }
    else { const p = m[2].split(/[ ,/]+/).filter(Boolean).map(Number); out.push(p.slice(0, 3)) }
  }
  return out
}
const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }
const L = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b)
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
const fails = []; const rows = []
function check(scope, vars, fg, bg, min = 4.5, note = '') {
  const F = hexes(resolve(vars, `var(${fg})`)), B = hexes(resolve(vars, `var(${bg})`))
  if (!F.length || !B.length) { rows.push(`${scope} ${fg} on ${bg}: n/a`); return }
  let worst = 99
  for (const f of F) for (const b of B) worst = Math.min(worst, ratio(f, b))
  const ok = worst >= min
  rows.push(`${ok ? 'ok ' : 'FAIL'} ${scope.padEnd(14)} ${fg.padEnd(20)} on ${bg.padEnd(16)} ${worst.toFixed(2)} (min ${min}) ${note}`)
  if (!ok) fails.push(rows.at(-1))
}
for (const [name, over] of Object.entries(themes)) {
  const v = { ...base, ...over }
  for (const bg of ['--c-page', '--c-panel', '--c-panel-2']) {
    for (const fg of ['--c-text', '--c-text-muted', '--c-text-fine', '--c-secondary-text', '--c-gold', '--c-alert-fg'])
      check(name, v, fg, bg, 4.5, name === 'monday' && bg === '--c-page' && fg !== '--c-text' ? '(monday: только на панели)' : '')
    for (const fg of ['--c-accent-1', '--c-win']) check(name, v, fg, bg, 3, 'крупный/нетекст')
  }
  check(name, v, '--c-cta-text', '--c-cta-bg'); check(name, v, '--c-hot-text', '--c-hot-bg'); check(name, v, '--c-danger-text', '--c-danger-bg')
  check(name, v, '--c-win-text', '--c-win'); check(name, v, '--c-alert-text', '--c-alert'); check(name, v, '--c-badge-hot-text', '--c-badge-hot-bg')
  check(name, v, '--c-focus', '--c-page', 3, 'фокус-кольцо'); check(name, v, '--c-focus', '--c-panel', 3, 'фокус-кольцо')
}
for (const [name, v] of [['paper-light', base], ['paper-dark', { ...base, ...darkPaper }]]) {
  for (const bg of ['--paper', '--paper-2', '--paper-white'])
    for (const fg of ['--ink', '--ink-muted', '--stamp-red', '--stamp-blue', '--stamp-green'])
      check(name, v, fg, bg, 4.5)
  check(name, v, '--paper-white', '--ink'); check(name, v, '--ink', '--highlighter')
  check(name, v, '--stamp-blue', '--paper', 3, 'фокус в бумаге')
}
check('paper-dark-surf', base, '--paper-dark-text', '--paper-dark'); check('paper-dark-surf', base, '--paper-dark-muted', '--paper-dark')
console.log(rows.join('\n')); console.log('\nFAILS:', fails.length); console.log(fails.join('\n'))
