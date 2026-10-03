import type { ApiError, ExtractResponse, Item, ReceiptResponse } from './types'

export const SAMPLE_TEXT =
  '퇴실 정산입니다. 청소비 15만원, 도배 전체 30만원, 장판 25만원, 싱크대 시트지 5만원, 샷시 손잡이 3만원입니다. 총 78만원을 공제하려고 합니다.'

export const MAX_TEXT = 3000

export class ApiFailure extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let r: Response
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new ApiFailure('aborted', '요청을 취소했어요.')
    throw new ApiFailure('network', '연결이 불안정해요. 잠시 후 다시 시도해 주세요.')
  }
  const data = await r.json().catch(() => null)
  if (!r.ok) {
    const err = (data ?? {}) as Partial<ApiError>
    throw new ApiFailure(err.error ?? `http_${r.status}`, err.message ?? '요청을 처리하지 못했어요.')
  }
  return data as T
}

/** 공제 메시지 정리 → Item[] 로 변환 */
export async function extractItems(text: string, signal?: AbortSignal): Promise<{ items: Item[]; statedTotal: number | null; source: 'ai' | 'cache' }> {
  const res = await postJson<ExtractResponse>('/api/extract', { text }, signal)
  return {
    items: res.items.map((it) => ({
      id: it.id,
      name: it.name,
      amount: it.amount,
      quote: it.quote,
      quoteFound: it.quote_found,
      needsCheck: it.needs_check,
      checkReason: it.check_reason,
      confirmed: false,
      selected: false,
      manual: false,
    })),
    statedTotal: res.stated_total,
    source: res.source,
  }
}

/** 사진 파일 지문(SHA-256)만 서버에 기록 */
export function createReceipt(sha256: string): Promise<ReceiptResponse> {
  return postJson<ReceiptResponse>('/api/receipt', { sha256 })
}

/** 브라우저에서 파일 SHA-256 계산 (사진은 서버로 보내지 않음) */
export async function sha256OfFile(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export const won = (n: number | null | undefined) => (typeof n === 'number' ? `${n.toLocaleString('ko-KR')}원` : '확인 필요')

export const formatKST = (iso: string) => {
  const d = new Date(iso)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
