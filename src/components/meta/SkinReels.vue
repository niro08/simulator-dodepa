<template>
  <div
    class="skin-reels"
    :class="[`skin-reels--${frame}`, `skin-reels--${size}`, { 'skin-reels--locked': locked, 'skin-reels--grey': skin.grayscale }]"
    :style="{ '--skin-glow': skin.glow ?? 'transparent' }"
    role="img"
    :aria-label="ariaLabel"
  >
    <div class="skin-reels__window">
      <span v-for="cell in cells" :key="cell.index" class="skin-reels__cell">
        <span class="skin-reels__sym" :class="{ 'skin-reels__sym--text': cell.symbol.length > 2 && !/\p{Extended_Pictographic}/u.test(cell.symbol) }">
          {{ cell.symbol }}
        </span>
        <span v-if="size === 'lg'" class="skin-reels__tier">{{ WARDROBE.tiers[cell.index] }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { skinDef } from '@/skins'
import { WARDROBE } from '@/i18n/ui'

/**
 * Мини-барабаны скина (Гардероб, art-bible §4): статичные символы и рамка, без демо-спина и исходов
 * (ux-flows S03). sm — три «топовых» символа для карточки, lg — все 8 по тирам выплат с подписями.
 * Закрытый скин — силуэт `brightness(0) opacity(.35)`.
 */
const props = withDefaults(defineProps<{ skinId: string; size?: 'sm' | 'lg'; locked?: boolean; ariaLabel?: string }>(), {
  size: 'sm',
  locked: false,
  ariaLabel: undefined
})

const skin = computed(() => skinDef(props.skinId))
const frame = computed(() => skin.value.frameClass.replace('frame-', ''))
/** Порядок для карточки: 777, 25x, 10x — «витринные» символы скина. */
const cells = computed(() => {
  const all = skin.value.symbols.map((symbol, index) => ({ symbol, index }))
  return props.size === 'lg' ? all : [all[6], all[5], all[4]].filter((c): c is { symbol: string; index: number } => !!c)
})
</script>

<style scoped>
.skin-reels {
  --cell: 36px;
  display: inline-grid;
  padding: 6px;
  border-radius: var(--r-sm);
  background: linear-gradient(180deg, #2a1452, #170b33);
  box-shadow:
    inset 0 0 0 2px var(--skin-glow),
    0 0 14px color-mix(in srgb, var(--skin-glow) 55%, transparent);
}
.skin-reels--lg {
  --cell: 52px;
  padding: 10px;
  border-radius: var(--r-md);
}
.skin-reels__window {
  display: grid;
  grid-auto-flow: column;
  gap: 4px;
}
.skin-reels--lg .skin-reels__window {
  grid-auto-flow: row;
  grid-template-columns: repeat(4, var(--cell));
  gap: 6px;
}
.skin-reels__cell {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 2px;
  width: var(--cell);
  min-height: var(--cell);
  padding: 2px 0;
  border-radius: 6px;
  background: linear-gradient(180deg, #fff 0%, #ece6ff 100%);
  box-shadow: inset 0 -3px 6px rgba(0, 0, 0, 0.18);
  color: #0b0620;
}
.skin-reels--lg .skin-reels__cell {
  min-height: calc(var(--cell) + 14px);
}
.skin-reels__sym {
  font-family: var(--font-emoji);
  font-size: calc(var(--cell) * 0.58);
  line-height: 1;
}
.skin-reels__sym--text {
  padding: 2px 3px;
  background: #111;
  color: #fff;
  font-family: var(--font-condensed);
  font-weight: 700;
  font-size: calc(var(--cell) * 0.3);
  letter-spacing: 0.04em;
}
.skin-reels__tier {
  font-family: var(--font-mono);
  font-size: var(--fs-fine);
  color: #4a4460;
}

/* Рамки по frameClass (P0 — свои, остальные — общая с цветом свечения скина) */
.skin-reels--pixel {
  border-radius: 0;
  background: #8b0000;
  box-shadow:
    0 0 0 3px #c0c0c0,
    4px 4px 0 3px #3a0000,
    0 0 14px color-mix(in srgb, var(--skin-glow) 50%, transparent);
}
.skin-reels--pixel .skin-reels__cell {
  border-radius: 0;
}
.skin-reels--circus {
  background: repeating-linear-gradient(90deg, #e0103a 0 10px, #fff4e0 10px 20px);
}
.skin-reels--paper {
  background: var(--paper);
  box-shadow: inset 0 0 0 1px var(--ink);
}
.skin-reels--paper .skin-reels__cell {
  background: var(--paper-white);
  box-shadow: inset 0 0 0 1px var(--paper-line);
  border-radius: 0;
}
.skin-reels--tag {
  background:
    repeating-linear-gradient(90deg, transparent 0 18px, rgba(160, 160, 160, 0.35) 18px 20px),
    #2a2a2a;
}
.skin-reels--fence {
  background: repeating-linear-gradient(90deg, #8b5a2b 0 12px, #a0522d 12px 14px);
}
.skin-reels--gold {
  background: linear-gradient(180deg, #3a2a0a, #1a1206);
  box-shadow:
    inset 0 0 0 2px #ffc43d,
    0 0 16px rgba(255, 196, 61, 0.55);
}
.skin-reels--chart {
  background: linear-gradient(180deg, #0a0f14, #111b24);
}
.skin-reels--noir {
  background: repeating-linear-gradient(20deg, #0e0e0e 0 8px, #1b1b1b 8px 14px);
}
.skin-reels--grey .skin-reels__sym {
  filter: grayscale(1);
}

.skin-reels--locked {
  box-shadow: inset 0 0 0 1px var(--ink-muted);
  background: var(--paper-2);
}
.skin-reels--locked .skin-reels__cell {
  background: var(--paper);
  box-shadow: none;
}
.skin-reels--locked .skin-reels__sym {
  filter: brightness(0) opacity(0.35);
}
.skin-reels--locked .skin-reels__sym--text {
  background: transparent;
}
</style>
