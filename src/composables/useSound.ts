import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'

/**
 * Звук оболочки (ux-flows §2 п.4: 🔊 и M работают всегда).
 * «Звук целиком» — settings.sfxVolume/musicVolume стора (сейв). Фоновая музыка — отдельный тумблер
 * (CD-20: «существующая музыка остаётся под отдельным тумблером»), по умолчанию выключена и хранится
 * в localStorage `dodepa.music`. Аудио создаётся только после жеста пользователя.
 * SFX на Web Audio — CD-20 (sound-designer); здесь только громкость и музыка.
 */

const MUSIC_KEY = 'dodepa.music'
const DEFAULT_VOLUME = 1

function readMusic(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUSIC_KEY) === '1'
  } catch {
    return false
  }
}

const musicWanted = ref(readMusic())
let audio: HTMLAudioElement | null = null
let initialized = false

function base(): string {
  return import.meta.env.BASE_URL ?? '/'
}

export function useSound() {
  const game = useGameStore()
  const enabled = computed(() => game.settings.sfxVolume > 0 || game.settings.musicVolume > 0)
  const musicOn = computed(() => enabled.value && musicWanted.value)

  function syncMusic() {
    if (typeof Audio === 'undefined') return
    if (!musicOn.value) {
      audio?.pause()
      return
    }
    if (!audio) {
      audio = new Audio(`${base()}audio/dep.mp3`)
      audio.loop = true
    }
    audio.volume = Math.max(0, Math.min(1, game.settings.musicVolume * 0.5))
    audio.play().catch(() => {
      /* автоплей запрещён до жеста — попробуем при следующем клике */
    })
  }

  if (!initialized) {
    initialized = true
    watch(musicOn, syncMusic)
    if (typeof document !== 'undefined') {
      const onGesture = () => syncMusic()
      document.addEventListener('pointerdown', onGesture, { once: true })
      document.addEventListener('keydown', onGesture, { once: true })
    }
  }

  function setEnabled(on: boolean) {
    const v = on ? DEFAULT_VOLUME : 0
    game.updateSettings({ sfxVolume: v, musicVolume: v })
  }

  function toggle(): boolean {
    setEnabled(!enabled.value)
    return enabled.value
  }

  function setMusic(on: boolean) {
    musicWanted.value = on
    try {
      globalThis.localStorage?.setItem(MUSIC_KEY, on ? '1' : '0')
    } catch {
      /* хранилище недоступно — выбор живёт до перезагрузки */
    }
    syncMusic()
  }

  /** Короткий звук старта рана — только если включены и звук, и музыка. */
  function playStart() {
    if (!musicOn.value || typeof Audio === 'undefined') return
    const a = new Audio(`${base()}audio/start_dep.mp3`)
    a.volume = 0.4 * game.settings.sfxVolume
    a.play().catch(() => undefined)
  }

  return { enabled, musicOn, musicWanted, toggle, setEnabled, setMusic, playStart }
}
