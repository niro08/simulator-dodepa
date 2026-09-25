import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useTheme } from '@/composables/useTheme'
import { SfxEngine, SoundDirector, packIdFromCosmetic, type SoundPackId, type SoundSlot } from '@/audio'

/**
 * Звук оболочки (ux-flows §2 п.4: 🔊 и M работают всегда) — фасад над процедурным SFX (src/audio, CD-20).
 * - Громкость master = settings.sfxVolume (0..1, сейв); «Звук целиком» выкл = 0, вкл — возврат
 *   к последней ненулевой громкости (localStorage `dodepa.volume`). Ползунок — в Настройках.
 * - SFX синтезируются на Web Audio; AudioContext создаётся по первому жесту (pointerdown/keydown).
 *   Нет Web Audio (SSR, тесты) — всё молча noop.
 * - Звук-пак — store.cosmetics.equipped.sound; в режиме «Снять очки» исходы спина звучат честно
 *   (сухой щелчок) и всё приглушено (systems-spec §5.4).
 * - Исходы и события — из store.onPresent (для спина — после остановки барабанов); барабаны — reels()
 *   из SlotPanel; клик — делегированно на любые кнопки.
 * - Фоновая музыка — старый файл под отдельным тумблером (CD-20), по умолчанию выключена
 *   (localStorage `dodepa.music`); новых обращений к public/audio нет.
 */

const MUSIC_KEY = 'dodepa.music'
const VOLUME_KEY = 'dodepa.volume'
const DEFAULT_VOLUME = 1
const CLICKABLE = 'button, [role="button"], [role="switch"], [role="tab"], a[href], summary'

function readMusic(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUSIC_KEY) === '1'
  } catch {
    return false
  }
}

function readLastVolume(): number {
  try {
    const v = Number(globalThis.localStorage?.getItem(VOLUME_KEY))
    return Number.isFinite(v) && v > 0 && v <= 1 ? v : DEFAULT_VOLUME
  } catch {
    return DEFAULT_VOLUME
  }
}

function writeLastVolume(v: number) {
  try {
    globalThis.localStorage?.setItem(VOLUME_KEY, String(v))
  } catch {
    /* хранилище недоступно — запомним до перезагрузки */
  }
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0)

const musicWanted = ref(readMusic())
let lastVolume = readLastVolume()
let audio: HTMLAudioElement | null = null
let initialized = false

const engine = new SfxEngine()
let director: SoundDirector | null = null

function base(): string {
  return import.meta.env.BASE_URL ?? '/'
}

export function useSound() {
  const game = useGameStore()
  const theme = useTheme()
  const volume = computed(() => clamp01(game.settings.sfxVolume))
  const enabled = computed(() => game.settings.sfxVolume > 0 || game.settings.musicVolume > 0)
  const musicOn = computed(() => enabled.value && musicWanted.value)
  const pack = computed<SoundPackId>(() => packIdFromCosmetic(game.cosmetics.equipped.sound))

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
    audio.volume = clamp01(game.settings.musicVolume * 0.5)
    audio.play().catch(() => {
      /* автоплей запрещён до жеста — попробуем при следующем клике */
    })
  }

  if (!initialized) {
    initialized = true
    director = new SoundDirector(engine, () => ({ pack: pack.value, underbelly: theme.isIznanka.value }))
    engine.setVolume(volume.value)
    watch(volume, (v) => engine.setVolume(v))
    watch(musicOn, syncMusic)
    watch(() => game.settings.musicVolume, syncMusic)
    game.onPresent((events) => director?.handleEvents(events))

    if (typeof document !== 'undefined') {
      let musicTried = false
      const onGesture = () => {
        engine.unlock()
        if (!musicTried) {
          musicTried = true
          syncMusic()
        }
      }
      // capture: контекст должен появиться до click-обработчиков, которые уже хотят играть
      document.addEventListener('pointerdown', onGesture, { capture: true, passive: true })
      document.addEventListener('keydown', onGesture, { capture: true, passive: true })
      document.addEventListener(
        'click',
        (event) => {
          const target = event.target as Element | null
          const el = target && typeof target.closest === 'function' ? target.closest(CLICKABLE) : null
          if (el && !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true') {
            director?.play('click')
          }
        },
        { passive: true }
      )
    }
  }

  /** Громкость master 0..1 (SFX и музыка). 0 — то же, что «звук выкл». */
  function setVolume(value: number) {
    const v = clamp01(value)
    if (v > 0) {
      lastVolume = v
      writeLastVolume(v)
    }
    game.updateSettings({ sfxVolume: v, musicVolume: v })
  }

  function setEnabled(on: boolean) {
    if (on) {
      setVolume(lastVolume > 0 ? lastVolume : DEFAULT_VOLUME)
    } else {
      if (volume.value > 0) {
        lastVolume = volume.value
        writeLastVolume(lastVolume)
      }
      game.updateSettings({ sfxVolume: 0, musicVolume: 0 })
      engine.stopAll()
    }
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

  /** Сыграть слот текущего пака (с учётом Изнанки). */
  function play(slot: SoundSlot): boolean {
    return director?.play(slot) ?? false
  }

  /** Вращение барабанов: моменты остановки каждого барабана от старта, мс. */
  function reels(stopsMs: readonly number[]): boolean {
    return director?.reels(stopsMs) ?? false
  }

  /** Джингл старта рана (синтез, без файлов). */
  function playStart() {
    play('runStart')
  }

  return { enabled, volume, pack, musicOn, musicWanted, toggle, setEnabled, setVolume, setMusic, play, reels, playStart }
}
