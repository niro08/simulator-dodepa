import { ref, onMounted, onUnmounted } from 'vue'

// Композабл для управления фоновой музыкой и анализа звука
export function useBackgroundMusic(audioPath: string) {
  const audio = ref<HTMLAudioElement | null>(null)
  const audioContext = ref<AudioContext | null>(null)
  const isInitialized = ref(false)

  // Музыка всегда выключена по умолчанию
  const isPlaying = ref(false)

  // Инициализация аудио
  const initAudio = () => {
    if (isInitialized.value) return

    audio.value = new Audio(audioPath)
    audio.value.loop = true
    audio.value.volume = isPlaying.value ? 0.5 : 0

    audioContext.value = new AudioContext()

    const source = audioContext.value.createMediaElementSource(audio.value)
    source.connect(audioContext.value.destination)

    isInitialized.value = true
  }

  const play = async () => {
    if (!audio.value) return

    try {
      // Resume audio context если был suspended
      if (audioContext.value?.state === 'suspended') {
        await audioContext.value.resume()
      }

      await audio.value.play()
    } catch (error) {
      console.warn('Не удалось воспроизвести музыку:', error)
    }
  }

  const setVolume = (volume: number) => {
    if (!audio.value) return
    audio.value.volume = Math.max(0, Math.min(1, volume))
  }

  const stop = () => {
    if (!audio.value) return
    audio.value.pause()
    audio.value.currentTime = 0
    isPlaying.value = false
  }

  const toggle = async () => {
    try {
      if (!isInitialized.value) {
        initAudio()
        // Safari требует небольшой задержки после инициализации
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      const newState = !isPlaying.value
      isPlaying.value = newState

      if (newState) {
        // Включаем музыку
        setVolume(0.5)
        // Safari: обязательно resume контекста перед play
        if (audioContext.value?.state === 'suspended') {
          await audioContext.value.resume()
        }
        await play()
      } else {
        // Полностью останавливаем музыку (для Safari)
        if (audio.value) {
          audio.value.pause()
          audio.value.currentTime = 0
        }
        // Suspend контекста для экономии ресурсов
        if (audioContext.value?.state === 'running') {
          await audioContext.value.suspend()
        }
      }
    } catch (error) {
      console.warn('Ошибка переключения музыки:', error)
    }
  }

  onMounted(() => {
    // Инициализируем при первом взаимодействии пользователя
    const handleFirstInteraction = () => {
      if (!isInitialized.value) {
        initAudio()
      }
    }

    document.addEventListener('click', handleFirstInteraction, { once: true })
    document.addEventListener('keydown', handleFirstInteraction, { once: true })
  })

  onUnmounted(() => {
    if (audio.value) {
      audio.value.pause()
      audio.value.src = ''
    }
    if (audioContext.value) {
      audioContext.value.close()
    }
  })

  return {
    isPlaying,
    toggle,
    stop
  }
}

