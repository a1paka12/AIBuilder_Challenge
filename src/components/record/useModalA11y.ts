import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/**
 * 대화상자 접근성 묶음 — 열릴 때 포커스 이동(initialFocus, 없으면 대화상자), Tab 가둠, Esc 닫기,
 * 닫히면(언마운트) returnFocus(있으면) 또는 열기 전 요소로 포커스 복귀.
 * 열 때 포커스가 body 로 빠져 있었을 수 있으니(예: 불러오는 동안 버튼 비활성) 복귀 대상은 명시하는 편이 안전하다.
 * "열릴 때 마운트, 닫힐 때 언마운트"되는 대화상자 컴포넌트 안에서 쓴다.
 */
export function useModalA11y<T extends HTMLElement>(
  onClose: () => void,
  initialFocus?: RefObject<HTMLElement | null>,
  returnFocus?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<T>(null)

  useEffect(() => {
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const raf = window.requestAnimationFrame(() => {
      const target = initialFocus?.current ?? dialogRef.current
      target?.focus()
    })
    return () => {
      window.cancelAnimationFrame(raf)
      const restore = () => {
        const explicit = returnFocus?.current
        const back = explicit && explicit.isConnected ? explicit : prev && prev.isConnected && prev !== document.body ? prev : null
        back?.focus()
        return !back || document.activeElement === back
      }
      // 닫는 렌더에서 아직 비활성(disabled)일 수 있으니 실패하면 다음 프레임에 한 번 더
      if (!restore()) window.requestAnimationFrame(() => void restore())
    }
    // 마운트 1회 — initialFocus·returnFocus 는 ref 라 바뀌지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 포커스가 아직 대화상자 밖(body 등)에 있을 때 누른 Esc 도 닫는다. 안쪽 Esc 는 onKeyDown 이 stopPropagation 해서 여기까지 오지 않는다.
  useEffect(() => {
    const onDocKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const root = dialogRef.current
      if (root && e.target instanceof Node && root.contains(e.target)) return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onDocKey)
    return () => document.removeEventListener('keydown', onDocKey)
  }, [onClose])

  const onKeyDown = (e: KeyboardEvent<T>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const root = dialogRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement)
    if (nodes.length === 0) {
      e.preventDefault()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement
    const inside = active instanceof HTMLElement && nodes.includes(active)
    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault()
        last.focus()
      }
    } else if (!inside || active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return { dialogRef, onKeyDown }
}
