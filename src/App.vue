<template>
  <div class="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
    <h1 class="text-3xl font-bold mb-6">Симулятор Додепа 🎰</h1>

    <div class="grid grid-cols-2 gap-4 mb-6 text-center">
      <div class="bg-gray-800 p-4 rounded-2xl shadow">
        <p class="text-gray-400">Деньги</p>
        <p class="text-2xl">{{ money }} ₽</p>
      </div>
      <div class="bg-gray-800 p-4 rounded-2xl shadow">
        <p class="text-gray-400">Энергия</p>
        <p class="text-2xl">⚡ {{ energy }}</p>
      </div>
      <div class="bg-gray-800 p-4 rounded-2xl shadow">
        <p class="text-gray-400">Репутация</p>
        <p class="text-2xl">❤️ {{ reputation }}</p>
      </div>
      <div class="bg-gray-800 p-4 rounded-2xl shadow">
        <p class="text-gray-400">Долг</p>
        <p class="text-2xl">💳 {{ debt }} ₽</p>
      </div>
    </div>

    <div class="flex flex-col gap-3 w-full max-w-sm">
      <button @click="playCasino" class="bg-purple-600 hover:bg-purple-700 rounded-xl p-3 font-semibold">🎲 Играть в казино (-100₽)</button>
      <button @click="workJob" :disabled="energy < 10" class="bg-green-600 hover:bg-green-700 rounded-xl p-3 font-semibold disabled:opacity-50">💼 Подработать (+200₽, -10⚡)</button>
      <button @click="borrowMoney" :disabled="energy < 5 || reputation <= 0" class="bg-blue-600 hover:bg-blue-700 rounded-xl p-3 font-semibold disabled:opacity-50">🤝 Занять у друга (+500₽, -5⚡, -1❤️)</button>
      <button @click="takeCredit" :disabled="energy < 5" class="bg-yellow-600 hover:bg-yellow-700 rounded-xl p-3 font-semibold disabled:opacity-50">🏦 Взять кредит (+1000₽, +100💳, -5⚡)</button>
      <button @click="resetGame" class="bg-red-600 hover:bg-red-700 rounded-xl p-3 font-semibold">🔄 Сбросить прогресс</button>
    </div>

    <p v-if="message" class="mt-6 text-lg text-gray-300">{{ message }}</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const money = ref(1000)
const energy = ref(50)
const reputation = ref(10)
const debt = ref(0)
const message = ref('')

// Загружаем сохранения при запуске
onMounted(() => {
  const saved = localStorage.getItem('dodepaSave')
  if (saved) {
    const data = JSON.parse(saved)
    money.value = data.money ?? 1000
    energy.value = data.energy ?? 50
    reputation.value = data.reputation ?? 10
    debt.value = data.debt ?? 0
  }
})

// Автосохранение при изменении значений
watch([money, energy, reputation, debt], () => {
  localStorage.setItem('dodepaSave', JSON.stringify({
    money: money.value,
    energy: energy.value,
    reputation: reputation.value,
    debt: debt.value
  }))
}, { deep: true })

function playCasino() {
  if (money.value < 100) {
    message.value = 'Недостаточно денег, попробуй занять или подработать!'
    return
  }
  money.value -= 100
  const winChance = Math.random()
  if (winChance < 0.1) {
    const win = Math.floor(200 + Math.random() * 500)
    money.value += win
    message.value = `Ты выиграл ${win}₽! Повезло!`
  } else {
    energy.value += 5
    message.value = 'Ты проиграл... но азарт только растет (+5⚡)'
  }
}

function workJob() {
  if (energy.value < 10) return
  money.value += 200
  energy.value -= 10
  message.value = 'Ты немного подзаработал на жизнь (+200₽, -10⚡)'
}

function borrowMoney() {
  if (energy.value < 5 || reputation.value <= 0) return
  money.value += 500
  energy.value -= 5
  reputation.value -= 1
  message.value = 'Друг дал немного денег (+500₽), но уважение падает (-1❤️)'
}

function takeCredit() {
  if (energy.value < 5) return
  money.value += 1000
  debt.value += 100
  energy.value -= 5
  message.value = 'Банк одобрил кредит (+1000₽, +100💳, -5⚡)'
}

function resetGame() {
  money.value = 1000
  energy.value = 50
  reputation.value = 10
  debt.value = 0
  message.value = 'Прогресс сброшен!'
  localStorage.removeItem('dodepaSave')
}
</script>
