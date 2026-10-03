// 공제 정리 화면·문서에서 함께 쓰는 검증된 참고 자료 5개.
// 내용은 공개 자료의 원문 인용·판결 요지·안내이며, 이 서비스는 판단하지 않는다.

export type ReferenceKind = 'contract' | 'case' | 'guide'

export interface Reference {
  id: string
  title: string
  kind: ReferenceKind
  /** 원문 인용(표준계약서) / 판결 요지(판결) / 안내(공공 절차) */
  body: string
  /** 범위 태그 */
  scope: string
  /** 세입자에게 불리할 수 있는 자료인지(범위 태그 강조용) */
  caution: boolean
  /** 추가 안내(없으면 null) */
  note: string | null
  sourceLabel: string
  sourceUrl: string
  checkedAt: string
  /** 항목명과 맞춰 볼 키워드(공통 카드는 빈 배열) */
  keywords: string[]
  /** 모든 항목에 공통으로 보여 주는 카드 */
  common: boolean
}

export const REFERENCE_KIND_LABEL: Record<ReferenceKind, string> = {
  contract: '원문 인용',
  case: '판결 요지',
  guide: '안내',
}

export const REFERENCE_CHECKED_AT = '2026-10-03'

export const REFERENCES: Reference[] = [
  {
    id: 'std-contract-9',
    title: '주택임대차표준계약서 제9조(원상복구) 단서',
    kind: 'contract',
    body: '…원래의 상태로 복구하여 임대인에게 반환… 다만, 시설물의 노후화나 통상 생길 수 있는 파손 등은 임차인의 원상복구의무에 포함되지 아니한다.',
    scope: '표준계약서 사용 시',
    caution: false,
    note: '표준계약서를 쓰지 않았다면 이 조항은 내 계약에 없을 수 있어요.',
    sourceLabel: '법무부 주택임대차표준계약서',
    sourceUrl: 'https://www.moj.go.kr/sites/moj/download/20231006_01.pdf',
    checkedAt: REFERENCE_CHECKED_AT,
    keywords: ['도배', '벽지', '장판', '바닥', '노후', '파손', '원상복구', '원상회복', '청소', '시트지', '싱크대'],
    common: false,
  },
  {
    id: 'sc-2005da8323',
    title: '대법원 2005. 9. 28. 선고 2005다8323 판결',
    kind: 'case',
    body: '보증금에서 공제할 채권이 생겼다는 사실은 임대인이 주장·입증해야 한다는 취지',
    scope: '대법원 판결',
    caution: false,
    note: null,
    sourceLabel: '케이스노트 · 대법원 2005다8323',
    sourceUrl: 'https://casenote.kr/대법원/2005다8323',
    checkedAt: REFERENCE_CHECKED_AT,
    keywords: [],
    common: true,
  },
  {
    id: 'sc-91da22605',
    title: '대법원 1991. 10. 25. 선고 91다22605, 22612 판결',
    kind: 'case',
    body: '목적물이 훼손된 경우 임차인이 책임을 면하려면 선량한 관리자의 주의의무를 다했음을 입증해야 한다는 취지',
    scope: '대법원 판결 · 세입자에게 불리할 수 있음',
    caution: true,
    note: null,
    sourceLabel: '케이스노트 · 대법원 91다22605',
    sourceUrl: 'https://casenote.kr/대법원/91다22605',
    checkedAt: REFERENCE_CHECKED_AT,
    keywords: [],
    common: true,
  },
  {
    id: 'sc-2002da52657',
    title: '대법원 2002. 12. 10. 선고 2002다52657 판결',
    kind: 'case',
    body: '임대인이 원상복구할 의사 없이 그대로 다시 임대한 경우 원상복구비 상당액을 공제할 수 없다고 본 사례(사안에 따라 다름)',
    scope: '대법원 판결',
    caution: false,
    note: null,
    sourceLabel: '케이스노트 · 대법원 2002다52657',
    sourceUrl: 'https://casenote.kr/대법원/2002다52657',
    checkedAt: REFERENCE_CHECKED_AT,
    keywords: ['도배', '벽지', '장판', '바닥', '원상복구', '원상회복', '청소', '시트지', '싱크대', '수리'],
    common: false,
  },
  {
    id: 'hldcc',
    title: '대한법률구조공단 주택임대차분쟁조정위원회',
    kind: 'guide',
    body: '보증금 반환·원상회복비용 등 임대차 분쟁을 조정합니다. 상대방이 조정에 응하지 않으면 각하될 수 있어요.',
    scope: '공공 절차 안내',
    caution: false,
    note: null,
    sourceLabel: '대한법률구조공단 주택임대차분쟁조정위원회',
    sourceUrl: 'https://www.hldcc.or.kr',
    checkedAt: REFERENCE_CHECKED_AT,
    keywords: [],
    common: true,
  },
]

const squash = (s: string) => s.replace(/\s+/g, '')

/** 항목명에 들어 있는 키워드 수 */
export function keywordMatchCount(ref: Reference, itemName: string): number {
  const name = squash(itemName)
  if (!name) return 0
  return ref.keywords.filter((k) => name.includes(k)).length
}

/**
 * 항목명으로 참고 자료 카드를 찾는다.
 * 키워드가 맞는 카드(일치 수 내림차순) → 공통 카드 순서.
 */
export function findReferences(itemName: string): Reference[] {
  const matched = REFERENCES.filter((r) => !r.common)
    .map((r) => ({ r, n: keywordMatchCount(r, itemName) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.r)
  const common = REFERENCES.filter((r) => r.common)
  return [...matched, ...common]
}

/** 특약에서 찾는 키워드 */
export const CLAUSE_KEYWORDS = ['청소', '클리닝', '도배', '벽지', '장판', '바닥', '원상복구', '원상회복', '퇴실', '퇴거']

/** 같은 뜻으로 묶은 키워드(청소↔클리닝·청소비, 도배↔벽지, 장판↔바닥) */
const CLAUSE_GROUPS: string[][] = [
  ['청소', '클리닝'],
  ['도배', '벽지'],
  ['장판', '바닥'],
  ['원상복구', '원상회복'],
  ['퇴실', '퇴거'],
]

/** 특약 문구에 이 항목과 같은 키워드(또는 동의어)가 있는지 */
export function clauseMatchesItem(clauseText: string, itemName: string): boolean {
  const clause = squash(clauseText)
  const name = squash(itemName)
  if (!clause || !name) return false
  return CLAUSE_GROUPS.some((g) => g.some((k) => clause.includes(k)) && g.some((k) => name.includes(k)))
}
