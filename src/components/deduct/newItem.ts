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

/**
 * "30만", "5만원", "1만5천", "15,000", "150000원" 같은 한국어 금액 표기를 숫자로 읽는다.
 * 쉼표·공백·끝의 "원"을 지우고 만·천 단위를 더한다. 읽을 수 없으면 null.
 */
export function readKoreanAmount(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, '').replace(/원$/, '')
  if (/^\d+$/.test(s)) return Number(s)
  const m = /^(?:(\d+(?:\.\d+)?)만)?(?:(\d+(?:\.\d+)?)천)?(\d+)?$/.exec(s)
  if (!m || (!m[1] && !m[2])) return null
  const total = Number(m[1] ?? 0) * 10_000 + Number(m[2] ?? 0) * 1_000 + Number(m[3] ?? 0)
  return Number.isInteger(total) ? total : null
}

/** 금액 입력 검사: 숫자·만/천 표기, 음수·1억 초과 막기. 비우면 null(금액 미정) */
export function parseAmount(raw: string): AmountParse {
  const s = raw.replace(/[,\s]/g, '').replace(/원$/, '')
  if (s === '') return { ok: true, value: null }
  if (s.startsWith('-')) return { ok: false, message: '금액은 0원 이상으로 적어 주세요.' }
  const n = readKoreanAmount(s)
  if (n === null) return { ok: false, message: '금액은 숫자만 적어 주세요. (예: 150000)' }
  if (n > MAX_AMOUNT) return { ok: false, message: '금액은 1억 원까지 적을 수 있어요.' }
  return { ok: true, value: n }
}
