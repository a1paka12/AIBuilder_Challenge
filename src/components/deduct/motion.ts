/** prefers-reduced-motion 이면 부드러운 스크롤 대신 즉시 이동 */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export function scrollToEl(el: Element | null | undefined, block: ScrollLogicalPosition = 'start'): void {
  el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block })
}
