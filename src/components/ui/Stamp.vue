<template>
  <span
    :key="replayKey"
    class="ui-stamp"
    :class="[`ui-stamp--${tone}`, `ui-stamp--${size}`, { 'ui-stamp--overlay': overlay, 'fx-stamp-in': animate }]"
    :style="{ '--stamp-rot': `${rotate}deg` }"
    :role="decorative ? undefined : 'img'"
    :aria-label="decorative ? undefined : (ariaLabel ?? text)"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <span class="ui-stamp__text" aria-hidden="true"><slot>{{ text }}</slot></span>
  </span>
</template>

<script setup lang="ts">
/**
 * Штамп Изнанки/Выписки (art-bible §3.14): двойная рамка, Oswald КАПС, наклон −8°,
 * «недопечатка» маской из SVG-шума, «шлёп» 180 мс один раз.
 * Повторить «шлёп» — сменить replayKey.
 */
withDefaults(
  defineProps<{
    text: string
    tone?: 'red' | 'blue' | 'green' | 'ink'
    size?: 'sm' | 'md' | 'lg'
    /** Угол в градусах. */
    rotate?: number
    /** Абсолютно по центру родителя (родитель — position: relative). */
    overlay?: boolean
    animate?: boolean
    replayKey?: string | number
    /** Декоративный штамп прячется от скринридера (смысл есть рядом текстом). */
    decorative?: boolean
    ariaLabel?: string
  }>(),
  {
    tone: 'red',
    size: 'md',
    rotate: -8,
    overlay: false,
    animate: true,
    replayKey: 0,
    decorative: false,
    ariaLabel: undefined
  }
)
</script>

<style scoped>
.ui-stamp {
  --stamp-c: var(--stamp-red);
  display: inline-block;
  padding: 3px;
  border: 3px solid var(--stamp-c);
  border-radius: var(--r-xs);
  color: var(--stamp-c);
  font-family: var(--font-condensed);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  line-height: 1;
  white-space: nowrap;
  transform: rotate(var(--stamp-rot, -8deg));
  opacity: .9;
  pointer-events: none;
  /* «Недопечатка»: SVG-шум вырезает ~15% краски */
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3 2.3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3 2.3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
}
.ui-stamp__text {
  display: block;
  padding: .25em .5em .2em;
  border: 1px solid var(--stamp-c);
}
.ui-stamp--blue { --stamp-c: var(--stamp-blue); }
.ui-stamp--green { --stamp-c: var(--stamp-green); }
.ui-stamp--ink { --stamp-c: var(--ink); }
.ui-stamp--sm { font-size: var(--fs-lg); }
.ui-stamp--md { font-size: var(--fs-xl); }
.ui-stamp--lg { font-size: var(--fs-2xl); }
.ui-stamp--overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  translate: -50% -50%;
  z-index: 3;
}
</style>
