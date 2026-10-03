import type { Item } from '../../types'

/** 사용자가 직접 추가하는 빈 행 */
export function newManualItem(): Item {
  return {
    id: `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    amount: null,
    quote: '',
    quoteFound: false,
    needsCheck: false,
    checkReason: null,
    confirmed: false,
    selected: false,
    manual: true,
  }
}

export const MAX_AMOUNT = 100_000_000

export type AmountParse = { ok: true; value: number | null } | { ok: false; message: string }

/** 금액 입력 검사: 숫자만, 음수·1억 초과 막기. 비우면 null(금액 미정) */
export function parseAmount(raw: string): AmountParse {
  const s = raw.replace(/[,\s]/g, '').replace(/원$/, '')
  if (s === '') return { ok: true, value: null }
  if (s.startsWith('-')) return { ok: false, message: '금액은 0원 이상으로 적어 주세요.' }
  if (!/^\d+$/.test(s)) return { ok: false, message: '금액은 숫자만 적어 주세요. (예: 150000)' }
  const n = Number(s)
  if (n > MAX_AMOUNT) return { ok: false, message: '금액은 1억 원까지 적을 수 있어요.' }
  return { ok: true, value: n }
}
