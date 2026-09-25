import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useGameStore } from './stores/game'
import './styles/casino.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Сейв загружается до монтирования: меню сразу знает, есть ли что продолжать.
useGameStore(pinia)
  .load()
  .catch((error) => console.error('Не удалось загрузить сейв', error))
  .finally(() => app.mount('#app'))
