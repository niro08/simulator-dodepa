import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useGameStore } from './stores/game'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/vfx.css'
import './styles/casino.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

if (new URLSearchParams(window.location.search).has('showcase')) {
  // Витрина UI-компонентов для проверки: отдельный чанк, в игровой маршрут не подключена.
  void import('./components/ui/UiShowcase.vue').then((m) => createApp(m.default).mount('#app'))
} else {
  // Сейв загружается до монтирования: меню сразу знает, есть ли что продолжать.
  useGameStore(pinia)
    .load()
    .catch((error) => console.error('Не удалось загрузить сейв', error))
    .finally(() => app.mount('#app'))
}
