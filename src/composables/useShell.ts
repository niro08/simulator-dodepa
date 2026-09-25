import { computed, ref, shallowRef } from 'vue'
import type { Command } from '@/game'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { useTheme } from './useTheme'

/**
 * Навигация оболочки и слои (ux-flows §3): экраны S01/S03–S05/S10, оверлеи S06–S08,
 * касса S12, бонус S13, выход при тильте S14, сон S40, предупреждение «ЗАВЯЗАТЬ» (E24). Синглтон модуля.
 * Игровую логику не содержит: всё меняется через store.execute.
 */

export type Screen = 'menu' | 'game' | 'wardrobe' | 'achievements' | 'endings'
export type Overlay = 'pause' | 'settings' | 'howto'
export type MobileTab = 'casino' | 'life' | 'iznanka'

const screen = ref<Screen>('menu')
/** Куда вести «← Назад» с экранов меты: в меню или обратно в ран (кнопка «В гардероб» на тосте). */
const metaReturn = ref<'menu' | 'game'>('menu')
const overlays = ref<Overlay[]>([])
const cashier = ref<null | 'deposit' | 'withdraw'>(null)
const bonusOffer = ref(false)
/** Галочка бонуса в кассе (пародия: включена по умолчанию, GDD §3.5.3). */
const bonusChecked = ref(true)
const sleepConfirm = ref(false)
/** «ЗАВЯЗАТЬ» при деньгах на сайте или выводе в очереди: предупреждение E24 ждёт подтверждения. */
const quitConfirm = ref(false)
const exitStep = ref<0 | 1 | 2>(0)
const pendingLife = shallowRef<(() => void) | null>(null)
const mobileTab = ref<MobileTab>('casino')
/** Слой до входа во вкладку «Изнанка» (мобильный): вернуть при выходе из неё. */
let layerBeforeTab: 'vitrina' | 'iznanka' | null = null
/** Выписка открыта (после экрана концовки). */
const statementOpen = ref(false)
/** Идёт анимация спина: ввод, кроме Esc/M/I, не принимаем (ux-flows §5). */
const spinning = ref(false)

export function useShell() {
  const game = useGameStore()
  const ui = useUiStore()
  const theme = useTheme()

  const topOverlay = computed(() => overlays.value[overlays.value.length - 1] ?? null)

  function openOverlay(o: Overlay) {
    if (topOverlay.value === o) return
    overlays.value = [...overlays.value.filter((x) => x !== o), o]
  }
  function closeOverlay(o?: Overlay) {
    overlays.value = o ? overlays.value.filter((x) => x !== o) : overlays.value.slice(0, -1)
  }
  function closeAllOverlays() {
    overlays.value = []
  }

  function go(to: Screen) {
    closeAllOverlays()
    cashier.value = null
    bonusOffer.value = false
    sleepConfirm.value = false
    quitConfirm.value = false
    exitStep.value = 0
    if (to === 'wardrobe' || to === 'achievements' || to === 'endings') {
      if (screen.value === 'menu' || screen.value === 'game') metaReturn.value = screen.value
    }
    screen.value = to
    if (to !== 'game') {
      theme.setLayer('vitrina')
      ui.underbellyOpen = false
    }
  }

  /** «← Назад» с экранов меты (S03–S05). */
  function goBackFromMeta() {
    go(metaReturn.value === 'game' && game.run ? 'game' : 'menu')
  }

  function setLayer(layer: 'vitrina' | 'iznanka') {
    theme.setLayer(layer)
    ui.underbellyOpen = layer === 'iznanka'
  }
  function toggleLayer() {
    setLayer(theme.isIznanka.value ? 'vitrina' : 'iznanka')
  }

  function setTab(tab: MobileTab) {
    if (tab === mobileTab.value) return
    if (tab === 'iznanka') {
      layerBeforeTab = theme.layer.value
      setLayer('iznanka')
    } else if (mobileTab.value === 'iznanka' && layerBeforeTab) {
      setLayer(layerBeforeTab)
      layerBeforeTab = null
    }
    mobileTab.value = tab
  }

  /** Касса: ДЕПОЗИТ в шапке, D, кнопка на месте КРУТИТЬ при пустом балансе. */
  function openCashier(tab: 'deposit' | 'withdraw' = 'deposit') {
    cashier.value = tab
  }

  /** Хиро «ЗАБРАТЬ БОНУС»: оффер S13, если бонус ещё доступен, иначе просто касса. */
  function claimBonus() {
    if (game.hud?.bonus.state === 'available') bonusOffer.value = true
    else openCashier('deposit')
  }

  const inCasino = computed(() => game.hud?.location === 'casino')
  const tiltLocked = computed(() => (game.hud?.tilt ?? 0) >= game.config.balance.TILT_T2)

  /**
   * Действие «Жизни» (или сон): из казино сначала выходим. При 🔥 ≥ 70 — через два подтверждения S14.
   * Esc/⏸/👓 сюда не ведут: системный выход трение не получает.
   */
  function viaLife(action: () => void) {
    if (!inCasino.value || game.phase !== 'day') {
      action()
      return
    }
    if (tiltLocked.value) {
      pendingLife.value = action
      exitStep.value = 1
      return
    }
    game.execute({ type: 'casino/leave' })
    action()
  }

  function lifeCommand(cmd: Command) {
    viaLife(() => game.execute(cmd))
  }

  function exitStay() {
    exitStep.value = 0
    pendingLife.value = null
  }
  function exitLeave() {
    if (exitStep.value === 1) {
      exitStep.value = 2
      return
    }
    exitStep.value = 0
    const action = pendingLife.value
    pendingLife.value = null
    if (inCasino.value) game.execute({ type: 'casino/leave' })
    action?.()
  }

  /** «Лечь спать» (S40): подтверждение, если осталось ⚡ ≥ 10 или сегодня неоплаченный счёт. */
  function requestSleep() {
    const hud = game.hud
    if (!hud || game.actions.sleep) return
    const billToday = hud.bill?.isToday && hud.bill.status !== 'paid'
    if (hud.energy >= 10 || billToday) sleepConfirm.value = true
    else viaLife(() => game.execute({ type: 'day/sleep' }))
  }
  function confirmSleep() {
    sleepConfirm.value = false
    viaLife(() => game.execute({ type: 'day/sleep' }))
  }

  /**
   * «ЗАВЯЗАТЬ» (развилка S46 и блок развилки в «Жизни»). GDD §3.7 / E24: если на сайте остались деньги или вывод
   * в очереди — сначала предупреждение «Завтра не будет», ран закрывается только после подтверждения.
   */
  function requestQuit() {
    const hud = game.hud
    if (!hud || game.actions.quit) return
    if (hud.quitForfeit.total > 0) quitConfirm.value = true
    else game.execute({ type: 'run/quit' })
  }
  function confirmQuit() {
    quitConfirm.value = false
    game.execute({ type: 'run/quit' })
  }

  /** Спин из Жизни: сначала зайти в казино (location). */
  function ensureCasino(): boolean {
    if (inCasino.value) return true
    if (game.actions.enterCasino) return false
    game.execute({ type: 'casino/enter' })
    return true
  }

  const anyDialogOpen = computed(
    () =>
      overlays.value.length > 0 ||
      cashier.value !== null ||
      bonusOffer.value ||
      sleepConfirm.value ||
      quitConfirm.value ||
      exitStep.value > 0
  )

  return {
    screen,
    overlays,
    topOverlay,
    cashier,
    bonusOffer,
    bonusChecked,
    sleepConfirm,
    quitConfirm,
    exitStep,
    mobileTab,
    statementOpen,
    spinning,
    inCasino,
    tiltLocked,
    anyDialogOpen,
    metaReturn,
    go,
    goBackFromMeta,
    openOverlay,
    closeOverlay,
    closeAllOverlays,
    setLayer,
    toggleLayer,
    setTab,
    openCashier,
    claimBonus,
    viaLife,
    lifeCommand,
    exitStay,
    exitLeave,
    requestSleep,
    confirmSleep,
    requestQuit,
    confirmQuit,
    ensureCasino
  }
}
