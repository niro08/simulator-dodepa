<template>
  <span
    v-if="kind === 'new'"
    class="ui-badge ui-badge--new"
    :class="{ 'ui-badge--corner': corner }"
    role="img"
    :aria-label="ariaLabel ?? content"
  >
    <svg class="ui-badge__burst" :class="{ 'fx-spin-slow': animated }" viewBox="0 0 44 44" aria-hidden="true">
      <polygon :points="burstPoints" />
    </svg>
    <span class="ui-badge__burst-text" aria-hidden="true">{{ content }}</span>
  </span>
  <span
    v-else
    class="ui-badge"
    :class="[
      `ui-badge--${kind}`,
      {
        'ui-badge--corner': corner,
        'fx-sway': animated && kind === 'hot',
        'fx-shimmer': animated && kind === 'multiplier'
      }
    ]"
    :style="kind === 'multiplier' ? { '--fx-delay': '1.2s' } : undefined"
    :aria-label="ariaLabel"
  >
    <span v-if="kind === 'live'" class="ui-badge__dot" :class="{ 'fx-live-dot': animated }" aria-hidden="true" />
    <span class="ui-badge__text"><slot>{{ content }}</slot></span>
  </span>
</template>

<script setup lang="ts">
/**
 * Бейджи Витрины (art-bible §3.9): HOT 🔥, ×200% (лента), NEW! (звезда-бёрст),
 * СКОРО (скотч), VIP 👑, LIVE ●, RTP 90% (честный и намеренно скучный).
 */
import { computed } from 'vue'

export type BadgeKind = 'hot' | 'multiplier' | 'new' | 'soon' | 'vip' | 'live' | 'rtp'

const props = withDefaults(
  defineProps<{
    kind: BadgeKind
    /** Текст; по умолчанию стандартный для вида. */
    label?: string
    /** Циклическое движение (покачивание, блик, вращение, мигание LIVE 1 Гц). */
    animated?: boolean
    /** Прибить в правый верхний угол карточки (родитель — position: relative). */
    corner?: boolean
    ariaLabel?: string
  }>(),
  { label: undefined, animated: true, corner: false, ariaLabel: undefined }
)

const DEFAULT_LABEL: Record<BadgeKind, string> = {
  hot: 'HOT 🔥',
  multiplier: '×200%',
  new: 'NEW!',
  soon: 'СКОРО',
  vip: 'VIP 👑',
  live: 'LIVE',
  rtp: 'RTP 90%'
}

const content = computed(() => props.label ?? DEFAULT_LABEL[props.kind])

/** Звезда-бёрст: 12 лучей. */
const burstPoints = (() => {
  const pts: string[] = []
  const rays = 12
  for (let i = 0; i < rays * 2; i++) {
    const r = i % 2 === 0 ? 21 : 15
    const a = (Math.PI * i) / rays - Math.PI / 2
    pts.push(`${(22 + r * Math.cos(a)).toFixed(2)},${(22 + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
})()
</script>

<style scoped>
.ui-badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-condensed);
  font-weight: 700;
  font-size: var(--fs-xs);
  letter-spacing: .08em;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
  vertical-align: middle;
}

.ui-badge--hot {
  height: 20px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  background: var(--c-badge-hot-bg);
  color: var(--c-badge-hot-text);
  font-size: var(--fs-fine);
  transform: skewX(-8deg);
}
.ui-badge--hot.fx-sway { animation-name: ui-badge-hot-sway; }
@keyframes ui-badge-hot-sway {
  0%, 100% { transform: skewX(-8deg) rotate(-3deg); }
  50% { transform: skewX(-8deg) rotate(3deg); }
}

.ui-badge--multiplier {
  height: 28px;
  padding: 0 12px;
  background: var(--gold-bevel);
  color: #1A0B00;
  font-family: var(--font-display);
  font-weight: 900;
  letter-spacing: .02em;
  border-radius: var(--r-xs);
  box-shadow: var(--glow-gold);
}
.ui-badge--multiplier.ui-badge--corner {
  position: absolute;
  top: 18px;
  right: -34px;
  width: 140px;
  justify-content: center;
  border-radius: 0;
  transform: rotate(45deg);
  z-index: 2;
}

.ui-badge--soon {
  height: 24px;
  padding: 0 12px;
  background: rgb(189 189 189 / .85);
  color: #1E1E1E;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: .1em;
}
.ui-badge--soon.ui-badge--corner {
  position: absolute;
  top: 50%;
  left: -20%;
  width: 140%;
  justify-content: center;
  transform: rotate(-24deg);
  z-index: 2;
}

.ui-badge--vip {
  height: 24px;
  padding: 0 10px;
  border-radius: 4px 4px 12px 12px;
  background: var(--gold-bevel);
  color: #1A0B00;
}

.ui-badge--live {
  height: 22px;
  padding: 0 8px;
  border-radius: var(--r-pill);
  background: #E0103A;
  color: #FFFFFF;
}
.ui-badge__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.ui-badge--rtp {
  height: 22px;
  padding: 0 6px;
  border: 2px solid var(--c-text-muted);
  color: var(--c-text-muted);
  font-family: var(--font-mono);
  font-weight: 400;
  letter-spacing: 0;
}

.ui-badge--new {
  width: 48px;
  height: 48px;
  justify-content: center;
}
.ui-badge--new.ui-badge--corner { position: absolute; top: 6px; right: 6px; z-index: 2; }
.ui-badge__burst {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}
.ui-badge__burst polygon {
  fill: #FFFF00;
  stroke: #FF2BD6;
  stroke-width: 2;
  stroke-linejoin: round;
}
.ui-badge__burst-text {
  position: relative;
  color: #0B0620;
  font-size: var(--fs-fine);
  letter-spacing: .02em;
  transform: rotate(-12deg);
}

:root[data-theme="monday"] .ui-badge--hot,
:root[data-theme="monday"] .ui-badge--live { transform: none; }
</style>
