// 공통 타입 — 화면 담당자들이 함께 쓰는 계약. 바꾸려면 오케스트레이터와 합의.

/** AI 또는 사용자가 만든 공제 항목 한 줄 */
export interface Item {
  id: string
  name: string
  /** 원 단위 정수. 모르면 null */
  amount: number | null
  /** 원문 인용(직접 추가한 행은 빈 문자열) */
  quote: string
  /** 원문에서 인용을 찾았는지 */
  quoteFound: boolean
  /** "확인 필요" 표시 여부(AI 판단: 단위 불명확·금액 없음·원문 확인 필요) */
  needsCheck: boolean
  checkReason: string | null
  /** 사용자가 [확인]을 눌렀는지. 금액·이름을 고치면 false로 돌아간다 */
  confirmed: boolean
  /** 사용자가 "물어볼 항목"으로 체크했는지. confirmed가 true일 때만 true 가능 */
  selected: boolean
  /** 사용자가 직접 추가한 행인지 */
  manual: boolean
}

export type Contractor = 'self' | 'other' | 'unknown'

export type ExtractSource = 'ai' | 'cache' | 'manual'

export interface DeductionState {
  /** 사용자가 붙여 넣은 원문 — 이 기기(브라우저 메모리)에서만 쓴다 */
  rawText: string
  /** 서버로 보낸 처리본(전송본): 기기 내 개인정보 제거를 거친 글. 직접 입력이면 없음 */
  processedText?: string
  /** 가린 항목 요약("전화번호 1 · 계좌번호 1"), 가린 것이 없으면 '' */
  maskSummary?: string
  items: Item[]
  statedTotal: number | null
  source: ExtractSource | null
  contractor: Contractor
  /** 사용자가 붙여 넣은 특약 문구(선택) */
  clauseText: string
  /** 문자·내용증명에 쓰는 사용자 입력(브라우저 안에서만 사용) */
  myName: string
  place: string
}

export interface ExtractResponse {
  items: {
    id: string
    name: string
    amount: number | null
    quote: string
    quote_found: boolean
    needs_check: boolean
    check_reason: string | null
  }[]
  stated_total: number | null
  source: 'ai' | 'cache'
}

export interface ApiError {
  error: string
  message: string
}

export interface ReceiptResponse {
  sha256: string
  receivedAt: string
  sig: string
}

/** 방 상태 기록 */
export type Zone = '벽' | '바닥' | '욕실' | '주방' | '창문/문' | '옵션 가전' | '기타'
export type Phase = '입주' | '퇴실'
export type DateSource = 'exif' | 'manual' | 'none'

export interface RoomPhoto {
  id: string
  zone: Zone
  phase: Phase
  /** 브라우저 안에서만 쓰는 object URL (서버로 보내지 않음) */
  url: string
  fileName: string
  sha256: string
  memo: string
  date: string | null
  dateSource: DateSource
  receipt: ReceiptResponse | null
  /** 개인정보 가림 처리본인지 — 브라우저 canvas 재인코딩으로 메타데이터(EXIF·GPS)가 제거된 새 파일 (PRD FR-01). url·sha256 은 처리본 기준 */
  masked?: boolean
  /** 가림 상자 수 */
  maskCount?: number
}
