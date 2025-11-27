import { ref, onMounted, onUnmounted } from 'vue'

// Композабл для управления фоновой музыкой и анализа звука
export function useBackgroundMusic(audioPath: string) {
  const audio = ref<HTMLAudioElement | null>(null)
  const audioContext = ref<AudioContext | null>(null)
  const analyser = ref<AnalyserNode | null>(null)
  const dataArray = ref<Uint8Array | null>(null)
  const isInitialized = ref(false)

  // Загружаем состояние музыки из localStorage
  const loadMusicState = () => {
    const saved = localStorage.getItem('musicEnabled')
    return saved === 'true' // По умолчанию выключено (false)
  }

  // Инициализируем isPlaying с правильным значением из localStorage
  const isPlaying = ref(loadMusicState())

  const saveMusicState = (enabled: boolean) => {
    localStorage.setItem('musicEnabled', String(enabled))
    isPlaying.value = enabled
  }

  // Инициализация аудио
  const initAudio = () => {
    if (isInitialized.value) return

    audio.value = new Audio(audioPath)
    audio.value.loop = true
    audio.value.volume = isPlaying.value ? 0.5 : 0

    // Создаём аудио контекст для анализа
    audioContext.value = new AudioContext()
    analyser.value = audioContext.value.createAnalyser()
    analyser.value.fftSize = 256

    const source = audioContext.value.createMediaElementSource(audio.value)
    source.connect(analyser.value)
    analyser.value.connect(audioContext.value.destination)

    const bufferLength = analyser.value.frequencyBinCount
    dataArray.value = new Uint8Array(bufferLength)

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

  const toggle = async () => {
    if (!isInitialized.value) {
      initAudio()
    }

    const newState = !isPlaying.value

    if (newState) {
      // Включаем музыку
      setVolume(0.5)
      await play()
    } else {
      // Выключаем звук (но музыка продолжает играть для эквалайзера)
      setVolume(0)
    }

    saveMusicState(newState)
  }

  // Получить текущую интенсивность звука (0-1)
  const getAudioIntensity = (): number => {
    if (!analyser.value || !dataArray.value) return 0

    // @ts-ignore - Web Audio API типизация
    analyser.value.getByteFrequencyData(dataArray.value)

    // Берём средние и высокие частоты для лучшего эффекта
    const bass = dataArray.value.slice(0, 10)
    const mid = dataArray.value.slice(10, 30)
    const high = dataArray.value.slice(30, 50)

    const avgBass = bass.reduce((a, b) => a + b, 0) / bass.length
    const avgMid = mid.reduce((a, b) => a + b, 0) / mid.length
    const avgHigh = high.reduce((a, b) => a + b, 0) / high.length

    // Взвешенное среднее (больше веса басам и серединке)
    return (avgBass * 0.5 + avgMid * 0.35 + avgHigh * 0.15) / 255
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
    getAudioIntensity,
    loadMusicState
  }
}

