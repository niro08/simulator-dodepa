# Simulator Dodepa 🎰

A satirical browser game about gambling addiction: 28 days of a gambler's life — salary, bills, debts and one very
honest slot machine. The game **mocks online casinos, it does not promote them**: the house always wins, and the only
real victory is walking away. Target: a Steam release (currently a Vue 3 web build). UI language: Russian.
Full Russian README: [README_RU.md](README_RU.md).

> ⚠️ **Disclaimer.** No real money is involved: nothing can be deposited, withdrawn or bought. No payment buttons,
> no network requests, no daily-login rewards. All casino, streamer and service names are fictional.
> If gambling is a problem for you: [Gamblers Anonymous](https://www.gamblersanonymous.org/).

## Concept

- **Showcase vs. Underside.** The *Showcase* is a neon casino site with every retention trick (200% bonus pre-ticked,
  fake win ticker, "bonus expires" timer, near-misses, two confirmations to leave and none to deposit). Press `I`
  ("take off the glasses") for the *Underside*: the same game on paper — actual RTP, losses disguised as wins, bonus
  clear-rate forecast, debt interest, lost hours.
- **One run = 28 days.** Morning → day (100⚡ for actions and spins) → night (living costs, interest, random event).
  Weekly bills on days 7/14/21/28, one deferral per run. On day 28: **QUIT** (debt-free only) or **ONE MORE WEEK**.
- **7 endings** (quit A/B/C, collectors, jail, family left, three casino nights, minimalism, secret) followed by a
  **bank statement** of what the run really cost.
- **Mechanics:** wallet vs. casino balance (instant deposit, next-morning withdrawal −5%), 3×3 slot at 90% RTP,
  shifts, shady gigs, family, friends, bank and payday loans, pawnshop, tilt meter, 29 night events.
- **Meta:** 31 achievements, endings collection, cosmetics only (slot skins, themes, sound packs, titles) — no
  between-run bonuses.

## Controls

`Space` spin · `−`/`=` bet ½/×2 · `0` min bet · `D` cashier · `I` Showcase ↔ Underside · `L`/`C` life/casino ·
`N` sleep · `←`/`→`, `1`/`2` choose option · `M` sound · `?`/`F1` how to play · `F6` cycle regions · `Esc` close/pause.
On mobile: bottom tabs (Casino / Life / Underside) and a sticky action button.

## Project layout

```
src/game/         pure deterministic core: commands, day/night, slot, rules, endings, stats, achievements,
                  statement, underside view; config/ (single source of balance numbers), content/, save/ (migrations)
src/stores/       Pinia wrapper over the core (execute/spin/save)
src/components/   game/ (run shell), phases/ (morning, events, bills, fork, ending, statement),
                  menu/, meta/ (wardrobe, achievements, endings), overlays/ (pause, settings, toasts), ui/ (design system)
src/audio/        procedural Web Audio SFX and sound packs
src/i18n/         ru.ts (core texts), ui.ts (interface strings)
src/styles/       tokens/themes, base, fonts, VFX
tools/            balance-sim (Monte Carlo economy), a11y audits
```

## Commands

```sh
npm install
npm run dev          # http://localhost:5173/simulator-dodepa/
npm test             # vitest
npm run type-check   # vue-tsc
npm run build-only   # vite production build → dist/
npm run build        # type-check + build
```

## Docs

- `design/` — creative vision, market research, run-structure GDD, economy v1 + simulation, systems spec, content pack,
  UX flows, art bible, audio spec.
- `production/` — architecture/ADRs, technical audit, task plans, QA reports.
- `.claude/` — agent studio from [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
  (MIT, see `.claude/CCGS-LICENSE`); project rules for Claude Code are in `CLAUDE.md`.

Stack: Vue 3, TypeScript, Pinia, Vite, Vitest.
