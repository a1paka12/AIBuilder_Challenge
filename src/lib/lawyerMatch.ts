// 변호사 찾아보기(PRD FR-03 · 07 변호사 추천 명세 5절) — 순수 함수. 화면·DOM에 의존하지 않아 그대로 검산할 수 있다.
//
// 규칙
//  1) 자격: 선택한 상담 주제 중 하나 이상의 취급 업무가 확인되어야 후보. "꼭 필요" 조건은 확인된 정보로 충족해야 하며,
//     프로필에 정보가 없어 확인할 수 없으면 자동 통과시키지 않고 제외한다.
//  2) 조건 일치 = round(100 × Σ(활성 기준 가중치 × 일치값) ÷ Σ(활성 기준 가중치)).
//     가중치 주제 40(일치값 = 확인된 취급 주제 수 ÷ 선택 주제 수) · 방식 20 · 지역 15 · 예산 15 · 시점 10. 일치값은 1 또는 0.
//     "상관없음" 기준은 모든 후보에서 뺀다. 방문을 고르지 않았으면 지역도 뺀다. 미확인은 분모를 줄이지 않고 0점.
//     언어는 점수에 넣지 않고 "꼭 필요"일 때만 거른다. 다른 시간 단위 요금은 30분으로 환산하지 않는다(미확인 취급).
//  3) 정렬: 조건 일치 높은 순 → 프로필 확인일 최근 순 → 고유 ID 순(같은 조건이면 같은 결과). 돈·광고는 순위에 쓰지 않는다.
//  4) 조건 일치는 법률 전문성·실력·승소 가능성 평가가 아니다(07 5-2 "초기 설계 가설").
import {
  BUDGET_CAP,
  LAWYERS,
  METHOD_LABEL,
  REGION_SHORT,
  TIMING_RANK,
  TOPIC_SHORT,
  fee30,
  type Budget,
  type Lang,
  type LawyerProfile,
  type Method,
  type Region,
  type Timing,
  type Topic,
} from '../data/lawyers'

/** 조건마다 고르는 중요도 */
export type Level = 'must' | 'prefer' | 'any'
export const LEVELS: readonly Level[] = ['must', 'prefer', 'any']
export const LEVEL_LABEL: Record<Level, string> = { must: '꼭 필요', prefer: '선호', any: '상관없음' }

/** 중요도를 고르는 조건(주제는 늘 활성 — 하나 이상 겹쳐야 후보) */
export type CriterionKey = 'method' | 'region' | 'budget' | 'timing' | 'language'
export const CRITERION_KEYS: readonly CriterionKey[] = ['method', 'region', 'budget', 'timing', 'language']
/** 점수에 들어가는 기준 */
export type ScoreKey = 'topic' | 'method' | 'region' | 'budget' | 'timing'
export const SCORE_KEYS: readonly ScoreKey[] = ['topic', 'method', 'region', 'budget', 'timing']

export const WEIGHTS: Record<ScoreKey, number> = { topic: 40, method: 20, region: 15, budget: 15, timing: 10 }

export const CRITERION_LABEL: Record<ScoreKey | CriterionKey, string> = {
  topic: '상담 주제',
  method: '상담 방식',
  region: '지역',
  budget: '예산',
  timing: '희망 시점',
  language: '언어',
}

export interface Criteria {
  /** 한 개 이상 */
  topics: Topic[]
  /** 복수 선택 — 하나라도 제공하면 일치 */
  methods: Method[]
  region: Region | null
  budget: Budget | null
  timing: Timing | null
  language: Lang | null
  levels: Record<CriterionKey, Level>
}

export const DEFAULT_LEVELS: Record<CriterionKey, Level> = { method: 'prefer', region: 'prefer', budget: 'prefer', timing: 'prefer', language: 'any' }

export const EMPTY_CRITERIA: Criteria = {
  topics: [],
  methods: [],
  region: null,
  budget: null,
  timing: null,
  language: null,
  levels: { ...DEFAULT_LEVELS },
}

/**
 * [예시 조건으로 보기] = 07 5-4 검산 조건. 후보 6명 중 A 100 · B 75 · C 65가 먼저 나온다.
 * 여기서 예산을 "꼭 필요"로 바꾸면 C가 빠지고, 방식을 전화만 고르면 지역 기준이 빠져 다시 계산된다.
 */
export const EXAMPLE_CRITERIA: Criteria = {
  topics: ['restore', 'refund'],
  methods: ['visit'],
  region: 'seoul_ne',
  budget: 'le50k',
  timing: '3d',
  language: null,
  levels: { ...DEFAULT_LEVELS },
}

export const MAX_SHOWN = 3

/** 기준 하나의 확인 결과 */
export type Check = 'yes' | 'no' | 'unknown'

export interface Candidate {
  profile: LawyerProfile
  /** 조건 일치(0~100 정수). 퍼센트·능력 점수가 아니다 */
  score: number
  /** 선택한 주제 중 취급 업무가 확인된 것 */
  topicMatched: Topic[]
  /** 선택한 주제 중 취급이 확인되지 않은 것 */
  topicMissing: Topic[]
  /** 활성 기준(주제 제외)별 확인 결과 */
  checks: Partial<Record<Exclude<ScoreKey, 'topic'>, Check>>
  /** 점수에 실제로 쓴 확인 필드로만 만든 고정 문장 */
  reason: string
}

export interface Blocker {
  key: ScoreKey | CriterionKey
  label: string
  /** 그 조건 때문에 제외된 수 */
  count: number
  /** 그중 정보 미확인으로 제외된 수 */
  unknown: number
  /** 주제가 겹치는 후보 수(주제가 막았으면 전체 수) */
  base: number
}

export interface MatchResult {
  /** 자격을 통과한 후보 전부, 정렬됨 */
  ranked: Candidate[]
  /** 이번 계산에 들어간 기준과 가중치 */
  active: ScoreKey[]
  /** 지역 기준이 활성인지(방문을 골랐고 상관없음이 아님) */
  regionActive: boolean
  /** 후보 0명일 때: 가장 많이 거른 조건(조건은 바꾸지 않는다) */
  blocker: Blocker | null
}

/* ── 문장 도우미 ─────────────────────────────────── */

/** 30,000 → "3만원", 25,000 → "2만 5천원", 8,000 → "8,000원" */
export function wonShort(n: number): string {
  const man = Math.floor(n / 10_000)
  const rest = n % 10_000
  if (man === 0) return `${n.toLocaleString('ko-KR')}원`
  if (rest === 0) return `${man}만원`
  if (rest % 1_000 === 0) return `${man}만 ${rest / 1_000}천원`
  return `${n.toLocaleString('ko-KR')}원`
}

function finalConsonant(word: string): number {
  const ch = word.charCodeAt(word.length - 1)
  return ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 : 0
}

/** 받침 유무로 조사 고르기 — josa('예산','은') → '은', josa('여부','은') → '는', josa('상담','과') → '과' */
export function josa(word: string, kind: '을' | '은' | '과' | '으로'): string {
  const f = finalConsonant(word)
  if (kind === '을') return f === 0 ? '를' : '을'
  if (kind === '은') return f === 0 ? '는' : '은'
  if (kind === '과') return f === 0 ? '와' : '과'
  return f === 0 || f === 8 ? '로' : '으로'
}

/** ['전화 상담','선택한 예산'] → '전화 상담과 선택한 예산', 셋 이상은 'A, B와 C' */
export function joinKo(items: string[]): string {
  if (items.length <= 1) return items.join('')
  const head = items.slice(0, -1)
  const prev = head[head.length - 1]
  return `${head.join(', ')}${josa(prev, '과')} ${items[items.length - 1]}`
}

/* ── 기준 판정 ───────────────────────────────────── */

/** 방문을 골랐고, 방식·지역이 "상관없음"이 아닐 때만 지역이 의미 있다 */
export function isRegionActive(c: Criteria): boolean {
  return c.levels.region !== 'any' && c.levels.method !== 'any' && c.methods.includes('visit')
}

/** 이번 계산에 들어가는 점수 기준 */
export function activeKeys(c: Criteria): ScoreKey[] {
  const keys: ScoreKey[] = ['topic']
  if (c.levels.method !== 'any') keys.push('method')
  if (isRegionActive(c)) keys.push('region')
  if (c.levels.budget !== 'any') keys.push('budget')
  if (c.levels.timing !== 'any') keys.push('timing')
  return keys
}

/** 기준 하나를 프로필의 확인된 정보로만 판정한다. 정보가 없으면 'unknown' */
export function checkOf(p: LawyerProfile, c: Criteria, key: CriterionKey): Check {
  switch (key) {
    case 'method':
      if (p.methods === null || c.methods.length === 0) return 'unknown'
      return c.methods.some((m) => p.methods!.includes(m)) ? 'yes' : 'no'
    case 'region':
      if (p.methods === null) return 'unknown'
      if (!p.methods.includes('visit')) return 'no'
      if (p.regions === null || c.region === null) return 'unknown'
      return p.regions.includes(c.region) ? 'yes' : 'no'
    case 'budget': {
      const f = fee30(p)
      if (f === null || c.budget === null) return 'unknown'
      return f <= BUDGET_CAP[c.budget] ? 'yes' : 'no'
    }
    case 'timing':
      if (p.availability === null || c.timing === null) return 'unknown'
      return TIMING_RANK[p.availability] <= TIMING_RANK[c.timing] ? 'yes' : 'no'
    case 'language':
      if (p.languages === null || c.language === null) return 'unknown'
      return p.languages.includes(c.language) ? 'yes' : 'no'
  }
}

/** "꼭 필요"로 거르는 조건 목록(지역은 활성일 때만) */
export function mustKeys(c: Criteria): CriterionKey[] {
  return CRITERION_KEYS.filter((k) => c.levels[k] === 'must' && (k !== 'region' || isRegionActive(c)))
}

/** 아직 값을 고르지 않은 조건(이게 비어야 계산한다) */
export function missingFields(c: Criteria): string[] {
  const missing: string[] = []
  if (c.topics.length === 0) missing.push(CRITERION_LABEL.topic)
  if (c.levels.method !== 'any' && c.methods.length === 0) missing.push(CRITERION_LABEL.method)
  if (isRegionActive(c) && c.region === null) missing.push(CRITERION_LABEL.region)
  if (c.levels.budget !== 'any' && c.budget === null) missing.push(CRITERION_LABEL.budget)
  if (c.levels.timing !== 'any' && c.timing === null) missing.push(CRITERION_LABEL.timing)
  if (c.levels.language !== 'any' && c.language === null) missing.push(CRITERION_LABEL.language)
  return missing
}

function topicSplit(p: LawyerProfile, c: Criteria): { matched: Topic[]; missing: Topic[] } {
  const matched = c.topics.filter((t) => p.topics.includes(t))
  const missing = c.topics.filter((t) => !p.topics.includes(t))
  return { matched, missing }
}

/** 자격 확인: 주제 하나 이상 + 꼭 필요 조건 전부 'yes' */
export function isEligible(p: LawyerProfile, c: Criteria): boolean {
  if (topicSplit(p, c).matched.length === 0) return false
  return mustKeys(c).every((k) => checkOf(p, c, k) === 'yes')
}

/* ── 점수·이유 ───────────────────────────────────── */

export function scoreOf(p: LawyerProfile, c: Criteria): number {
  const keys = activeKeys(c)
  let num = 0
  let den = 0
  for (const k of keys) {
    const w = WEIGHTS[k]
    den += w
    if (k === 'topic') num += c.topics.length ? (w * topicSplit(p, c).matched.length) / c.topics.length : 0
    else num += checkOf(p, c, k) === 'yes' ? w : 0
  }
  return den === 0 ? 0 : Math.round((100 * num) / den)
}

/** 추천 이유 — 점수에 쓴 확인 필드로만 만든 고정 문장 조합 */
export function reasonOf(p: LawyerProfile, c: Criteria): string {
  const { matched, missing } = topicSplit(p, c)
  const keys = activeKeys(c).filter((k): k is Exclude<ScoreKey, 'topic'> => k !== 'topic')
  const yes: string[] = []
  const no: string[] = []
  const unknown: string[] = []
  for (const k of keys) {
    const r = checkOf(p, c, k)
    if (k === 'method') {
      if (r === 'yes') yes.push(`${c.methods.filter((m) => p.methods!.includes(m)).map((m) => METHOD_LABEL[m]).join('·')} 상담`)
      else if (r === 'no') no.push('상담 방식')
      else unknown.push('상담 방식')
    } else if (k === 'region') {
      if (r === 'yes' && c.region) yes.push(`${REGION_SHORT[c.region]} 지역`)
      else if (r === 'no') no.push('방문 지역')
      else unknown.push('방문 가능 지역')
    } else if (k === 'budget') {
      if (r === 'yes') yes.push('선택한 예산')
      else if (r === 'no') no.push('예산')
      else unknown.push(p.fee ? '30분 기준 상담료' : '상담료')
    } else {
      if (r === 'yes') yes.push('희망 시점')
      else if (r === 'no') no.push('희망 시점')
      else unknown.push('희망 날짜의 상담 가능 여부')
    }
  }
  const sentences: string[] = []
  const topicPart = `${joinKo(matched.map((t) => TOPIC_SHORT[t]))} 관련 취급 업무가 확인되었`
  sentences.push(yes.length ? `${topicPart}고, ${joinKo(yes)} 조건이 맞습니다.` : `${topicPart}습니다.`)
  if (missing.length) {
    const m = joinKo(missing.map((t) => TOPIC_SHORT[t]))
    sentences.push(`선택한 주제 중 ${m} 관련 취급 여부는 확인되지 않았습니다.`)
  }
  if (no.length) {
    const n = joinKo(no)
    sentences.push(`${n}${josa(n, '은')} 선택한 조건과 맞지 않습니다.`)
  }
  if (unknown.length) {
    const u = joinKo(unknown)
    sentences.push(`${u}${josa(u, '은')} 사무실에 확인해 주세요.`)
  }
  return sentences.join(' ')
}

/** 조건 일치 높은 순 → 확인일 최근 순 → ID 순 */
export function compareCandidates(a: Candidate, b: Candidate): number {
  if (b.score !== a.score) return b.score - a.score
  if (a.profile.checkedAt !== b.profile.checkedAt) return a.profile.checkedAt < b.profile.checkedAt ? 1 : -1
  return a.profile.id < b.profile.id ? -1 : a.profile.id > b.profile.id ? 1 : 0
}

/** 후보 0명일 때 가장 많이 거른 조건. 조건을 바꾸거나 다른 후보를 만들지 않는다 */
export function blockerOf(c: Criteria, profiles: readonly LawyerProfile[]): Blocker | null {
  const base = profiles.filter((p) => topicSplit(p, c).matched.length > 0)
  if (base.length === 0) {
    return { key: 'topic', label: CRITERION_LABEL.topic, count: profiles.length, unknown: 0, base: profiles.length }
  }
  let best: Blocker | null = null
  for (const k of mustKeys(c)) {
    let count = 0
    let unknown = 0
    for (const p of base) {
      const r = checkOf(p, c, k)
      if (r !== 'yes') count += 1
      if (r === 'unknown') unknown += 1
    }
    if (!best || count > best.count) best = { key: k, label: CRITERION_LABEL[k], count, unknown, base: base.length }
  }
  return best
}

/** 조건 → 자격 통과 후보 전부(정렬) + 점수·이유. 0명이면 가장 많이 거른 꼭 필요 조건 */
export function matchLawyers(c: Criteria, profiles: readonly LawyerProfile[] = LAWYERS): MatchResult {
  const ranked = profiles
    .filter((p) => isEligible(p, c))
    .map((p): Candidate => {
      const { matched, missing } = topicSplit(p, c)
      const checks: Candidate['checks'] = {}
      for (const k of activeKeys(c)) if (k !== 'topic') checks[k] = checkOf(p, c, k)
      return { profile: p, score: scoreOf(p, c), topicMatched: matched, topicMissing: missing, checks, reason: reasonOf(p, c) }
    })
    .sort(compareCandidates)
  return {
    ranked,
    active: activeKeys(c),
    regionActive: isRegionActive(c),
    blocker: ranked.length === 0 ? blockerOf(c, profiles) : null,
  }
}
