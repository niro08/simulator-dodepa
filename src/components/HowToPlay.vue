<template>
  <Transition name="modal">
    <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="close">✕</button>

        <div class="guide">
          <h2 class="guide-title">{{ guide.title }}</h2>

          <div class="guide-section">
            <ul>
              <li v-for="line in guide.lines" :key="line">{{ line }}</li>
            </ul>
            <p class="guide-note">{{ guide.footer }}</p>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { howToPlay } from '@/i18n'
import { useGameStore } from '@/stores/game'

// Все числа гайда — из конфига, гайд не может соврать (TD-04, B-13); тексты — content-pack §12.1
const { config } = useGameStore()
const guide = howToPlay(config)

defineProps<{
  isVisible: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function close() {
  emit('close')
}

function handleOverlayClick() {
  close()
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 1.5rem;
  padding: 2rem;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
  border: 2px solid rgba(124, 58, 237, 0.3);
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(229, 62, 62, 0.8);
  transform: rotate(90deg);
}

.guide {
  color: white;
}

.guide-title {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, #ffd700 0%, #ffed4e 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 1.5rem 0;
  text-align: center;
}

.guide-section {
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.75rem;
  border: 1px solid rgba(124, 58, 237, 0.2);
}

.guide-section h3 {
  color: #a78bfa;
  font-size: 1.25rem;
  margin: 0 0 0.75rem 0;
  font-weight: 700;
}

.guide-section p {
  margin: 0.5rem 0;
  line-height: 1.6;
  color: #e0e0e0;
}

.guide-section ul {
  margin: 0.5rem 0;
  padding-left: 1.5rem;
  list-style: none;
}

.guide-section ul li {
  margin: 0.5rem 0;
  line-height: 1.6;
  color: #d0d0d0;
  position: relative;
}

.guide-section ul li::before {
  content: "•";
  color: #7c3aed;
  font-weight: bold;
  font-size: 1.2rem;
  position: absolute;
  left: -1.2rem;
}

.guide-note {
  font-size: 0.875rem;
  font-style: italic;
}

.guide-section strong {
  color: #ffd700;
}

.guide-section em {
  color: #a78bfa;
  font-style: italic;
}

/* Анимация модального окна */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.9);
  opacity: 0;
}

/* Скроллбар */
.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 10px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: rgba(124, 58, 237, 0.5);
  border-radius: 10px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: rgba(124, 58, 237, 0.7);
}

@media (max-width: 640px) {
  .modal-content {
    padding: 1.5rem;
    max-height: 85vh;
  }

  .guide-title {
    font-size: 1.5rem;
  }

  .guide-section h3 {
    font-size: 1.1rem;
  }

  .guide-section {
    padding: 0.75rem;
  }
}
</style>

