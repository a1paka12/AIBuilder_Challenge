// 기기 내 개인정보 제거 (FR-01) — 서버로 보내기 전에 브라우저 안에서 먼저 가린다.
// 순수 함수: 네트워크·DOM·전역 상태를 쓰지 않는다. 서버(server/server.mjs maskPII)의 패턴을 그대로 옮겼고,
// 서버의 가림은 2차 방어로 그대로 남아 있다.

declare const processedBrand: unique symbol
/** maskText()를 거친 글만 이 타입이 된다 — extractItems()는 이 타입만 받으므로 원문이 서버로 가는 경로가 코드상 없다. */
export type ProcessedText = string & { readonly [processedBrand]: true }

export type MaskKind = 'rrn' | 'mobile' | 'phone' | 'account' | 'email' | 'name' | 'address' | 'word'

/** 사용자가 직접 추가한 단어의 종류 — 이름 / 주소 / 기타 */
export type WordKind = 'name' | 'address' | 'word'

export interface MaskWord {
  text: string
  kind: WordKind
}

export const WORD_KIND_OPTIONS: { value: WordKind; label: string }[] = [
  { value: 'name', label: '이름' },
  { value: 'address', label: '주소' },
  { value: 'word', label: '기타' },
]

export const MASK_LABEL: Record<MaskKind, string> = {
  rrn: '주민등록번호',
  mobile: '전화번호',
  phone: '전화번호',
  account: '계좌번호',
  email: '이메일',
  name: '이름',
  address: '주소',
  word: '가린 단어',
}

/** 치환 토큰 — 처리본에는 이 글자만 남는다 (08 명세 형식: [전화번호 삭제]) */
export const MASK_TOKEN: Record<MaskKind, string> = {
  rrn: '[주민등록번호 삭제]',
  mobile: '[전화번호 삭제]',
  phone: '[전화번호 삭제]',
  account: '[계좌번호 삭제]',
  email: '[이메일 삭제]',
  name: '[이름 삭제]',
  address: '[주소 삭제]',
  word: '[가린 단어 삭제]',
}

/** YYYY-MM-DD 같은 날짜(금액·날짜는 남긴다 — 08 3절) */
const DATE_RE = /^(19|20)\d{2}[-./](0?[1-9]|1[0-2])[-./](0?[1-9]|[12]\d|3[01])$/
/** 계좌번호 후보 검사: 날짜가 아니고 숫자가 10자리 이상(국내 계좌는 10~14자리) */
const isAccount = (m: string) => !DATE_RE.test(m) && m.replace(/\D/g, '').length >= 10

/** 서버 maskPII 와 같은 순서·같은 패턴 (앞 패턴이 먼저 차지한 자리는 뒤 패턴이 건드리지 않는다) */
const PATTERNS: { kind: MaskKind; re: RegExp; accept?: (m: string) => boolean }[] = [
  { kind: 'rrn', re: /(?<!\d)\d{6}\s?-\s?[1-4]\d{6}(?!\d)/g }, // 주민등록번호
  { kind: 'mobile', re: /(?<!\d)01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}(?!\d)/g }, // 휴대전화
  { kind: 'phone', re: /(?<!\d)0\d{1,2}[-\s.]\d{3,4}[-\s.]\d{4}(?!\d)/g }, // 일반전화
  { kind: 'account', re: /(?<!\d)\d{2,6}-\d{2,6}-\d{2,8}(-\d{1,6})?(?!\d)/g, accept: isAccount }, // 계좌번호(하이픈 묶음, 날짜 제외)
  { kind: 'email', re: /[\w.+-]+@[\w-]+\.[\w.]+/g }, // 이메일
]

/** 처리본 안에서 치환 토큰이 차지한 자리(하이라이트용) */
export interface MaskSpan {
  start: number
  end: number
  kind: MaskKind
  token: string
}

export interface MaskResult {
  /** 서버로 보낼 처리본(전송본) */
  text: ProcessedText
  /** 처리본 기준 치환 위치 */
  spans: MaskSpan[]
  /** 종류별 가린 개수 (0은 넣지 않는다) */
  counts: Partial<Record<MaskKind, number>>
  /** 가린 개수 합계 */
  total: number
}

interface Hit {
  start: number
  end: number
  kind: MaskKind
}

/** 사용자가 추가한 단어 정리: 공백 제거·빈 값 제외·중복 제거(같은 단어는 처음 고른 종류). 문자열만 주면 '이름' */
export function normalizeWords(words: readonly (string | MaskWord)[]): MaskWord[] {
  const out: MaskWord[] = []
  for (const w of words) {
    const t = (typeof w === 'string' ? w : w.text).trim()
    const kind: WordKind = typeof w === 'string' ? 'name' : w.kind
    if (t && !out.some((o) => o.text === t)) out.push({ text: t, kind })
  }
  return out
}

/**
 * 원문에서 개인정보 패턴과 사용자가 추가한 단어를 토큰으로 바꾼 처리본을 만든다.
 * 패턴 순서는 서버와 같고, 먼저 찾은 자리와 겹치는 뒤 패턴의 결과는 버린다.
 */
export function maskText(raw: string, extraWords: readonly (string | MaskWord)[] = []): MaskResult {
  const src = String(raw ?? '')
  const hits: Hit[] = []
  const overlaps = (s: number, e: number) => hits.some((h) => s < h.end && e > h.start)

  for (const { kind, re, accept } of PATTERNS) {
    re.lastIndex = 0
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
      const s = m.index
      const e = s + m[0].length
      if (m[0].length === 0) {
        re.lastIndex++ // 빈 매치 무한 루프 방지(현재 패턴에는 없음)
        continue
      }
      if (accept && !accept(m[0])) continue
      if (!overlaps(s, e)) hits.push({ start: s, end: e, kind })
    }
  }

  // 사용자가 추가한 단어는 긴 것부터(짧은 단어가 긴 단어의 일부를 먼저 차지하지 않게)
  const words = normalizeWords(extraWords).sort((a, b) => b.text.length - a.text.length)
  for (const { text: w, kind } of words) {
    let from = 0
    for (let idx = src.indexOf(w, from); idx >= 0; idx = src.indexOf(w, from)) {
      const e = idx + w.length
      if (!overlaps(idx, e)) hits.push({ start: idx, end: e, kind })
      from = e
    }
  }

  hits.sort((a, b) => a.start - b.start)

  let out = ''
  const spans: MaskSpan[] = []
  const counts: Partial<Record<MaskKind, number>> = {}
  let cursor = 0
  for (const h of hits) {
    out += src.slice(cursor, h.start)
    const token = MASK_TOKEN[h.kind]
    spans.push({ start: out.length, end: out.length + token.length, kind: h.kind, token })
    out += token
    counts[h.kind] = (counts[h.kind] ?? 0) + 1
    cursor = h.end
  }
  out += src.slice(cursor)

  return { text: out as ProcessedText, spans, counts, total: hits.length }
}

/** 요약 문구: "[전화번호 삭제] 1 · [계좌번호 삭제] 1" (휴대전화·일반전화는 합친다). 없으면 빈 문자열 */
export function summarizeMask(counts: Partial<Record<MaskKind, number>>): string {
  const merged = new Map<string, number>()
  const order: MaskKind[] = ['rrn', 'mobile', 'phone', 'account', 'email', 'name', 'address', 'word']
  for (const k of order) {
    const n = counts[k] ?? 0
    if (!n) continue
    const label = MASK_TOKEN[k]
    merged.set(label, (merged.get(label) ?? 0) + n)
  }
  return Array.from(merged, ([label, n]) => `${label} ${n}`).join(' · ')
}

/** 처리본을 글자 조각과 토큰 조각으로 나눈다(화면에서 토큰만 <mark>로 강조할 때 사용) */
export function splitProcessed(text: string, spans: readonly MaskSpan[]): { text: string; span: MaskSpan | null }[] {
  const parts: { text: string; span: MaskSpan | null }[] = []
  let cursor = 0
  for (const sp of spans) {
    if (sp.start > cursor) parts.push({ text: text.slice(cursor, sp.start), span: null })
    parts.push({ text: sp.token, span: sp })
    cursor = sp.end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), span: null })
  return parts
}

const TOKEN_RE = /\[(주민등록번호|전화번호|계좌번호|이메일|이름|주소|가린 단어) 삭제\]/g
const KIND_BY_TOKEN: Record<string, MaskKind> = {
  '[주민등록번호 삭제]': 'rrn',
  '[전화번호 삭제]': 'mobile',
  '[계좌번호 삭제]': 'account',
  '[이메일 삭제]': 'email',
  '[이름 삭제]': 'name',
  '[주소 삭제]': 'address',
  '[가린 단어 삭제]': 'word',
}

/** 저장해 둔 처리본 문자열만 있을 때(화면을 떠났다 돌아온 경우) 토큰 위치를 다시 찾는다 */
export function spansFromProcessed(text: string): MaskSpan[] {
  const spans: MaskSpan[] = []
  TOKEN_RE.lastIndex = 0
  for (let m = TOKEN_RE.exec(text); m !== null; m = TOKEN_RE.exec(text)) {
    spans.push({ start: m.index, end: m.index + m[0].length, kind: KIND_BY_TOKEN[m[0]] ?? 'word', token: m[0] })
  }
  return spans
}
