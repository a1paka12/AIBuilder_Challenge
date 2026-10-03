/*
 * 출시 기념 프로모션 상태 — "이 기기·브라우저" 기준
 * - 혜택 해제: localStorage 'bj_promo_unlocked' = '1' (설문 응답 성공 시 unlockPromo())
 * - 첫 화면 팝업: '오늘 하루 보지 않기'(localStorage, 다음 KST 자정까지) · '닫기'(sessionStorage, 이번 탭)
 * 저장소 접근은 전부 try/catch — 사생활 모드·저장소 차단에서는 메모리 값으로만 동작한다(새로고침하면 처음 상태).
 * 이름·연락처 등 개인정보는 어디에도 저장하지 않는다.
 */
import { useSyncExternalStore } from 'react'

export const PROMO_UNLOCK_KEY = 'bj_promo_unlocked'
export const POPUP_HIDE_KEY = 'bj_popup_hide_until'
export const POPUP_SESSION_KEY = 'bj_popup_closed'
/** window 에 발송되는 CustomEvent 이름 — usePromoUnlocked() 가 구독한다 */
export const PROMO_UNLOCKED_EVENT = 'bj:promo-unlocked'

// 저장소가 막혀 있어도 이번 페이지 수명 동안은 기억한다
let memoryUnlocked = false
let memoryHideUntil = 0
let memoryClosed = false

type Area = 'local' | 'session'

function read(area: Area, key: string): string | null {
  try {
    const s = area === 'local' ? window.localStorage : window.sessionStorage
    return s.getItem(key)
  } catch {
    return null
  }
}

function write(area: Area, key: string, value: string): void {
  try {
    const s = area === 'local' ? window.localStorage : window.sessionStorage
    s.setItem(key, value)
  } catch {
    /* 사생활 모드·용량 초과·저장소 차단 — 메모리 값으로만 동작 */
  }
}

// ── 혜택 해제 ───────────────────────────────────────────────────────────────

/** 이 기기·브라우저에서 출시 기념 혜택(기록북 사진 장수 제한 해제)이 적용됐는지 */
export function isPromoUnlocked(): boolean {
  return memoryUnlocked || read('local', PROMO_UNLOCK_KEY) === '1'
}

/** 설문 응답 성공 시 호출 — 저장 후 'bj:promo-unlocked' 이벤트를 보내 화면을 갱신한다 */
export function unlockPromo(): void {
  memoryUnlocked = true
  write('local', PROMO_UNLOCK_KEY, '1')
  try {
    window.dispatchEvent(new CustomEvent(PROMO_UNLOCKED_EVENT))
  } catch {
    /* CustomEvent 미지원 환경 — 다음 렌더에서 isPromoUnlocked() 로 읽힌다 */
  }
}

function subscribeUnlock(onChange: () => void): () => void {
  window.addEventListener(PROMO_UNLOCKED_EVENT, onChange)
  window.addEventListener('storage', onChange) // 다른 탭에서 해제돼도 반영
  return () => {
    window.removeEventListener(PROMO_UNLOCKED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}
const serverSnapshot = () => false

/** 혜택 해제 여부를 구독하는 훅 — unlockPromo() 가 불리면 리렌더된다 */
export function usePromoUnlocked(): boolean {
  return useSyncExternalStore(subscribeUnlock, isPromoUnlocked, serverSnapshot)
}

// ── 첫 화면 팝업 노출 제어 ───────────────────────────────────────────────────

/** 다음 KST 자정(00:00)의 UTC ms. KST 는 서머타임이 없어 +9시간 고정 */
export function nextKstMidnightMs(now: number = Date.now()): number {
  const KST_OFFSET = 9 * 60 * 60 * 1000
  const DAY = 24 * 60 * 60 * 1000
  const shifted = now + KST_OFFSET
  const dayStart = shifted - (shifted % DAY)
  return dayStart + DAY - KST_OFFSET
}

/** '오늘 하루 보지 않기' 가 아직 유효한지 (KST 자정이 지나면 다시 보인다) */
export function popupHiddenToday(): boolean {
  const raw = read('local', POPUP_HIDE_KEY)
  const parsed = raw ? Number(raw) : 0
  const stored = Number.isFinite(parsed) ? parsed : 0
  return Math.max(stored, memoryHideUntil) > Date.now()
}

/** '오늘 하루 보지 않기' — 다음 KST 자정까지 숨긴다 */
export function hidePopupToday(): void {
  const until = nextKstMidnightMs()
  memoryHideUntil = until
  write('local', POPUP_HIDE_KEY, String(until))
}

/** 이번 탭(세션)에서 이미 닫았는지 */
export function popupClosedThisSession(): boolean {
  return memoryClosed || read('session', POPUP_SESSION_KEY) === '1'
}

/** '닫기' — 이번 탭에서는 다시 열지 않는다 (탭을 새로 열면 다시 보인다) */
export function closePopupForSession(): void {
  memoryClosed = true
  write('session', POPUP_SESSION_KEY, '1')
}
