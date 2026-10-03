// 변호사 찾아보기(PRD FR-03 · 07 변호사 추천 명세) — 가상 프로필 데이터
//
// ⚠ 전부 가상(데모용)이다. 실존 변호사·사무실과 무관하며, 화면에서 연락·예약할 수 없다.
//   실제 프로필을 확보하기 전까지는 "가상 변호사 A~H" 표기로 추천 로직만 시연한다(07 10절).
// 운영 원칙(변호사법 제34조 고려)
//  - 변호사에게서 소개비·수수료·광고비를 받지 않고, 돈으로 순위를 바꾸지 않는다. 순서는 사용자가 고른 조건으로만 정한다.
//  - 실적·승소율·후기·이용자 수·연락처·예약 URL은 두지 않는다.
//  - 상담 주제 4종은 서비스 검색 태그다. 대한변협 공식 전문분야 명칭이 아니며, 등록 전문분야(registeredSpecialty)와 따로 둔다.
//  - 확인하지 않은 값은 추측해 채우지 않고 null(= 미확인, 화면에서 "문의 필요")로 둔다.

/** 상담 주제(서비스 검색 태그) */
export type Topic = 'restore' | 'refund' | 'clause' | 'procedure'
/** 상담 방식 */
export type Method = 'phone' | 'video' | 'visit'
/** 방문 상담 지역 — 방문을 골랐을 때만 의미가 있다 */
export type Region = 'seoul_ne' | 'seoul_other' | 'gyeonggi_incheon' | 'other'
/** 예산 — 30분 상담 기준 상한 */
export type Budget = 'le30k' | 'le50k' | 'le100k'
/** 희망 시점 / 프로필의 가장 빠른 상담 가능 시점 */
export type Timing = 'today' | '3d' | '2w'
/** 상담 언어 */
export type Lang = 'ko' | 'en'

export const TOPICS: readonly Topic[] = ['restore', 'refund', 'clause', 'procedure']
export const TOPIC_LABEL: Record<Topic, string> = {
  restore: '퇴실 청소·도배 등 원상회복 비용',
  refund: '보증금 일부·전액 반환 문의',
  clause: '계약서 특약 해석 문의',
  procedure: '분쟁조정·소액 사건 절차 문의',
}
/** 카드 태그·추천 이유 문장용 짧은 이름 */
export const TOPIC_SHORT: Record<Topic, string> = {
  restore: '원상회복 비용',
  refund: '보증금 반환',
  clause: '특약 해석',
  procedure: '분쟁조정·소액 절차',
}

export const METHODS: readonly Method[] = ['phone', 'video', 'visit']
export const METHOD_LABEL: Record<Method, string> = {
  phone: '전화',
  video: '영상',
  visit: '방문',
}

export const REGIONS: readonly Region[] = ['seoul_ne', 'seoul_other', 'gyeonggi_incheon', 'other']
export const REGION_LABEL: Record<Region, string> = {
  seoul_ne: '서울 동북권(성북·강북·노원 등)',
  seoul_other: '서울 그 외',
  gyeonggi_incheon: '경기·인천',
  other: '그 외 지역',
}
export const REGION_SHORT: Record<Region, string> = {
  seoul_ne: '서울 동북권',
  seoul_other: '서울 그 외',
  gyeonggi_incheon: '경기·인천',
  other: '그 외 지역',
}

export const BUDGETS: readonly Budget[] = ['le30k', 'le50k', 'le100k']
export const BUDGET_LABEL: Record<Budget, string> = {
  le30k: '3만원 이하',
  le50k: '5만원 이하',
  le100k: '10만원 이하',
}
/** 30분 상담료 상한(원) */
export const BUDGET_CAP: Record<Budget, number> = {
  le30k: 30_000,
  le50k: 50_000,
  le100k: 100_000,
}
/** 예산 비교 기준 상담 시간(분). 다른 시간 단위 요금은 환산하지 않는다(07 5-2) */
export const BUDGET_MINUTES = 30

export const TIMINGS: readonly Timing[] = ['today', '3d', '2w']
export const TIMING_LABEL: Record<Timing, string> = {
  today: '오늘',
  '3d': '3일 이내',
  '2w': '2주 이내',
}
/** 빠른 순서(작을수록 빠름). 프로필 시점 ≤ 희망 시점이면 일치 */
export const TIMING_RANK: Record<Timing, number> = { today: 0, '3d': 1, '2w': 2 }

export const LANGS: readonly Lang[] = ['ko', 'en']
export const LANG_LABEL: Record<Lang, string> = { ko: '한국어', en: '영어' }

/** 상담 요금 — 기재된 시간·금액 그대로. 다른 시간 단위로 환산하지 않는다 */
export interface Fee {
  minutes: number
  /** 원 */
  amount: number
  vatIncluded: boolean
}

export interface LawyerProfile {
  /** 고유 ID — 동점일 때 마지막 정렬 기준 */
  id: string
  /** 표시명 — 실존 인물과 겹칠 수 없는 "가상 변호사 A" 표기 */
  name: string
  /** 확인된 취급 업무 태그(서비스 검색 태그). 목록에 없는 주제 = 취급 미확인 */
  topics: Topic[]
  /** 등록 전문분야(대한변협 등록을 확인한 명칭만). 가상 프로필은 null = 없음·미확인 */
  registeredSpecialty: string | null
  /** 제공 상담 방식. null = 미확인 */
  methods: Method[] | null
  /** 방문 상담 가능 지역. 방문을 제공하지 않으면 빈 배열, null = 미확인 */
  regions: Region[] | null
  /** 상담 요금. null = 미확인(요금 문의 필요) */
  fee: Fee | null
  /** 가장 빠른 상담 가능 시점(확정 예약 아님). null = 미확인(일정 문의 필요) */
  availability: Timing | null
  /** 상담 가능 언어. null = 미확인 */
  languages: Lang[] | null
  /** 프로필 정보 확인일(가상, YYYY-MM-DD) — 동점일 때 최근 순 */
  checkedAt: string
}

/** 30분 기준 상담료(원). 요금이 없거나 30분 단위가 아니면 null(비교 불가 = 미확인 취급) */
export function fee30(p: LawyerProfile): number | null {
  return p.fee && p.fee.minutes === BUDGET_MINUTES ? p.fee.amount : null
}

/**
 * 가상 프로필 8명.
 *
 * 07 5-4 검산 — 주제 [원상회복 비용, 보증금 반환] · 방식 [방문] · 지역 서울 동북권 · 예산 5만원 이하 · 시점 3일 이내,
 * 모든 기준 "선호", 언어 "상관없음"이면
 *   A = 40+20+15+15+10 = 100
 *   B = 40+20+ 0+15+ 0 =  75 (지역·시점 불일치)
 *   C = 20+20+15+ 0+10 =  65 (주제 1/2·예산 초과)
 * 이 조건이 화면의 [예시 조건으로 보기]다(후보 6명 중 A·B·C 3명이 먼저 나온다. F·H는 주제가 겹치지 않아 제외).
 * 예산을 "꼭 필요"로 바꾸면 C(8만원)와 요금 미확인 D·G, 20분 요금이라 비교할 수 없는 E가 빠진다.
 * 방식을 [전화]만 고르면 지역 기준이 빠져 A 100 · B 88 · C 59로 다시 계산된다.
 */
export const LAWYERS: LawyerProfile[] = [
  {
    id: 'a',
    name: '가상 변호사 A',
    topics: ['restore', 'refund', 'clause'],
    registeredSpecialty: null,
    methods: ['phone', 'video', 'visit'],
    regions: ['seoul_ne'],
    fee: { minutes: 30, amount: 30_000, vatIncluded: true },
    availability: 'today',
    languages: ['ko'],
    checkedAt: '2026-10-01',
  },
  {
    id: 'b',
    name: '가상 변호사 B',
    topics: ['restore', 'refund'],
    registeredSpecialty: null,
    methods: ['phone', 'visit'],
    regions: ['seoul_other'],
    fee: { minutes: 30, amount: 50_000, vatIncluded: true },
    availability: '2w',
    languages: ['ko', 'en'],
    checkedAt: '2026-09-30',
  },
  {
    id: 'c',
    name: '가상 변호사 C',
    topics: ['refund', 'procedure'],
    registeredSpecialty: null,
    methods: ['phone', 'visit'],
    regions: ['seoul_ne', 'seoul_other'],
    fee: { minutes: 30, amount: 80_000, vatIncluded: false },
    availability: '3d',
    languages: ['ko'],
    checkedAt: '2026-09-28',
  },
  {
    // 요금 미확인
    id: 'd',
    name: '가상 변호사 D',
    topics: ['restore', 'clause', 'procedure'],
    registeredSpecialty: null,
    methods: ['video'],
    regions: [],
    fee: null,
    availability: 'today',
    languages: ['ko', 'en'],
    checkedAt: '2026-09-29',
  },
  {
    // 20분 요금만 기재 → 30분 예산과 비교하지 않는다. 일정 미확인
    id: 'e',
    name: '가상 변호사 E',
    topics: ['refund', 'procedure'],
    registeredSpecialty: null,
    methods: ['phone'],
    regions: [],
    fee: { minutes: 20, amount: 20_000, vatIncluded: true },
    availability: null,
    languages: ['ko'],
    checkedAt: '2026-09-27',
  },
  {
    id: 'f',
    name: '가상 변호사 F',
    topics: ['clause'],
    registeredSpecialty: null,
    methods: ['visit', 'video'],
    regions: ['seoul_ne'],
    fee: { minutes: 30, amount: 50_000, vatIncluded: true },
    availability: '3d',
    languages: ['ko'],
    checkedAt: '2026-09-26',
  },
  {
    // 요금·일정·언어 미확인
    id: 'g',
    name: '가상 변호사 G',
    topics: ['restore'],
    registeredSpecialty: null,
    methods: ['phone', 'video'],
    regions: [],
    fee: null,
    availability: null,
    languages: null,
    checkedAt: '2026-09-25',
  },
  {
    id: 'h',
    name: '가상 변호사 H',
    topics: ['clause', 'procedure'],
    registeredSpecialty: null,
    methods: ['phone', 'visit'],
    regions: ['gyeonggi_incheon'],
    fee: { minutes: 30, amount: 100_000, vatIncluded: true },
    availability: '2w',
    languages: ['ko', 'en'],
    checkedAt: '2026-09-24',
  },
]
