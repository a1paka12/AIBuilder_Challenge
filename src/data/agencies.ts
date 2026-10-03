// 무료 법률상담 기관·공식 링크 — "무료 법률상담 기관·변호사 찾기" 화면(Help)과 공제 정리의 "다음 단계"(NextSteps)가 함께 쓴다.
//
// 운영 원칙(변호사법 제34조·제109조 고려)
//  - 공공기관의 무료 상담 창구와 대한변호사협회 공식 변호사 검색만 안내한다.
//  - 특정 변호사를 소개·알선하지 않고, 어떤 대가(소개비·수수료·광고비)도 받지 않는다. 변호사 조건 추천(#/lawyer)은 무료 가상 프로필 시연. 법률 판단은 하지 않는다.
//  - 내용은 각 공식 홈페이지에서 확인한 것만 적는다. 확인하지 못한 비용·수수료·자격요건은 적지 않는다.
//  - 숫자(전화번호·수수료·시간)는 공식 페이지에서 확인한 것만 적고, 확인일(checkedAt)을 함께 보여 준다.

export type AgencyKind = 'consult' | 'mediation' | 'lawyer'

export interface Agency {
  id: string
  name: string
  kind: AgencyKind
  /** 무엇을 도와주나 */
  what: string
  /** 연락·신청 방법 */
  how: string
  /** 비용 — 공식 홈페이지에서 확인한 것만(확인 못 하면 생략) */
  cost?: string
  /** 공식 홈페이지(새 창으로 연다) */
  url: string
  /** 추가 안내(없으면 생략) */
  note?: string
  /** 공식 홈페이지 확인일 (YYYY-MM-DD) */
  checkedAt: string
}

export const AGENCY_KIND_LABEL: Record<AgencyKind, string> = {
  consult: '법률상담',
  mediation: '분쟁 조정',
  lawyer: '변호사 검색',
}

/** 공식 홈페이지를 마지막으로 확인한 날 */
export const AGENCIES_CHECKED_AT = '2026-10-03'

/** '2026-10-03' → '2026. 10. 3.' (공공 누리집 날짜 표기) */
export function formatCheckedAt(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${y}. ${m}. ${d}.`
}

export const AGENCIES: Agency[] = [
  {
    id: 'klac',
    name: '대한법률구조공단',
    kind: 'consult',
    what: '법률 문제를 전화·온라인·방문으로 상담해 주는 공공기관이에요. 조건에 맞으면 소송 지원(소송구조)도 받을 수 있어요.',
    how: '전화 132(통화료 발신자 부담) · 홈페이지 사이버상담 · 방문·화상상담은 예약',
    cost: '법률상담 무료 · 소송 지원(소송구조)은 소득 등 조건이 있어요',
    url: 'https://www.klac.or.kr',
    note: '주택임대차분쟁조정위원회도 이 공단이 운영해요(아래 카드). 자세한 조건은 공식 홈페이지에서 확인해 주세요.',
    checkedAt: AGENCIES_CHECKED_AT,
  },
  {
    id: 'hldcc',
    name: '주택임대차분쟁조정위원회',
    kind: 'mediation',
    what: '보증금 반환·원상회복 비용처럼 집주인과 세입자 사이의 분쟁을 조정해요. 대한법률구조공단 등이 운영해요.',
    how: '홈페이지에서 방문·전화·온라인 예약 뒤 조정 신청(본인인증) · 접수 지부는 홈페이지에서 골라요 · 법률상담은 전화 132',
    cost: '조정 신청 수수료가 있어요. 조정목적의 값이 1억원 미만이면 10,000원(마이홈포털 안내 기준) · 면제 대상도 있어요',
    url: 'https://www.hldcc.or.kr',
    note: '상대방이 조정에 응하지 않으면 각하될 수 있어요. 자세한 조건은 공식 홈페이지에서 확인해 주세요.',
    checkedAt: AGENCIES_CHECKED_AT,
  },
  {
    id: 'seoul',
    name: '서울시 마을변호사',
    kind: 'consult',
    what: '서울시가 운영하는 생활 법률 상담이에요. 동주민센터에서 마을변호사가 상담해요.',
    how: '사는 동네 동주민센터에 방문·전화하거나 온라인으로 예약 · 홈페이지 "우리동네 정기상담일"에서 상담일 확인 · 문의 02-2133-6715, 120 다산콜센터',
    cost: '무료(서울시민 대상)',
    url: 'https://legal.seoul.go.kr',
    note: '자세한 대상·조건은 공식 홈페이지에서 확인해 주세요.',
    checkedAt: AGENCIES_CHECKED_AT,
  },
  {
    id: 'kookmin',
    name: '국민대 법률상담센터',
    kind: 'consult',
    what: '국민대학교 법률상담센터(인권센터와 함께 운영)에서 법률상담을 받을 수 있어요.',
    how: '전화 02-910-6397(상담)로 먼저 문의·예약 · 평일 10:00~16:00 · 법학관 1층 105호(홈페이지 안내 기준)',
    url: 'https://legalcc.kookmin.ac.kr',
    note: '예전 안내에는 법학관 233호로 나오기도 해요. 방문 전에 전화로 위치와 상담 대상·비용을 확인해 주세요.',
    checkedAt: AGENCIES_CHECKED_AT,
  },
  {
    id: 'koreanbar',
    name: '대한변호사협회 변호사 검색',
    kind: 'lawyer',
    what: '변호사를 직접 찾아보세요 — 대한변호사협회 공식 변호사 검색. 등록된 변호사를 직접 검색할 수 있는 공식 페이지예요.',
    how: '검색 페이지에서 직접 찾아 변호사 사무실에 연락해요. 보증금 지킴이를 거치지 않아요.',
    url: 'https://www.koreanbar.or.kr/pages/search/search1.asp',
    note: '상담료는 변호사마다 다르니 미리 물어보세요. 보증금 지킴이는 특정 변호사를 소개·알선하지 않고 어떤 대가(소개비·수수료·광고비)도 받지 않아요. 변호사 조건 추천은 무료 가상 프로필 시연이고, 연락은 직접 해요.',
    checkedAt: AGENCIES_CHECKED_AT,
  },
]
