import type { ApiError, ExtractResponse, Item, ReceiptResponse } from './types'
import type { ProcessedText } from './lib/mask'

/**
 * 합성 예시 — 가짜 연락처·계좌가 들어 있어 "기기 내 개인정보 제거"가 눈에 보인다(금액 5개·총 78만원은 그대로).
 * 서버(server/server.mjs)의 SAMPLE_TEXT 는 이 글의 처리본(maskText 결과)과 같아야 저장된 예시 결과로 폴백된다.
 */
export const SAMPLE_TEXT =
  '퇴실 정산입니다. 청소비 15만원, 도배 전체 30만원, 장판 25만원, 싱크대 시트지 5만원, 샷시 손잡이 3만원입니다. 총 78만원을 공제하려고 합니다. 입금은 국민 123456-01-234567로 해 주세요. 문의 010-1234-5678'

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

/**
 * 공제 메시지 정리 → Item[] 로 변환.
 * 처리본(ProcessedText: src/lib/mask.ts maskText 를 거쳐 기기 내 개인정보 제거가 끝난 글)만 받는다 — 원문 string 을 넘기면 타입 오류.
 * 사용자가 전송본을 확인한 뒤에만 호출한다(Deduct 화면).
 */
export async function extractItems(text: ProcessedText, signal?: AbortSignal): Promise<{ items: Item[]; statedTotal: number | null; source: 'ai' | 'cache' }> {
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

// ── DB 연동: 구매 의향(결제 아님)·현장 설문·익명 집계 ─────────────────────────
export interface Stats {
  intents: { book: number; cert: number }
  survey: {
    total: number
    deducted: { yes: number; no: number; not_yet: number }
    asked: { yes: number; no: number }
    reasons: Partial<Record<SurveyReason, number>>
  }
  metrics: { today: Record<string, number>; total: Record<string, number> }
  prices: { book: number; cert: number }
}
export type SurveyReason = 'fight' | 'hassle' | 'unknown_how' | 'small' | 'fear' | 'other'
export const SURVEY_REASON_LABEL: Record<SurveyReason, string> = {
  fight: '싸우기 싫어서',
  hassle: '귀찮아서',
  unknown_how: '어떻게 물어볼지 몰라서',
  small: '금액이 작아서',
  fear: '보증금을 못 받을까 봐',
  other: '기타',
}

/** 브라우저마다 하나인 익명 ID (중복 집계 방지용, 개인 식별 정보 아님) */
export function clientId(): string {
  const KEY = 'bj_client_id'
  try {
    const old = localStorage.getItem(KEY)
    if (old) return old
    const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9-]/g, '')
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 12)}`
  }
}

export async function getStats(): Promise<Stats> {
  const r = await fetch('/api/stats')
  if (!r.ok) throw new ApiFailure('stats', '집계를 불러오지 못했어요.')
  return r.json()
}

export function postIntent(product: 'book' | 'cert'): Promise<{ ok: boolean; counted: boolean; stats: Stats }> {
  return postJson('/api/intent', { clientId: clientId(), product })
}

export function postSurvey(answer: { deducted: 'yes' | 'no' | 'not_yet'; asked?: 'yes' | 'no' | null; reason?: SurveyReason | null }): Promise<{ ok: boolean; stats: Stats }> {
  return postJson('/api/survey', { clientId: clientId(), ...answer })
}

/** 익명 횟수 집계 — 실패해도 화면 동작에 영향 없음 */
export function postMetric(event: 'copy_message' | 'cert_pdf' | 'book_pdf' | 'popup_event' | 'popup_help' | 'lawyer_search'): void {
  fetch('/api/metric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) }).catch(() => {})
}
