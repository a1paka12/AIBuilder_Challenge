// 변호사 찾아보기 (PRD FR-03 · 07 변호사 추천 명세) — #/lawyer
// 화면 흐름(단계식): 'form' — 1. 상담 조건 고르기만 보인다(상단 고지 유지). 필수 값이 다 차면 [조건으로 후보 보기].
//                    'results' — 폼을 숨기고 고른 조건 요약 + [조건 수정], 2. 후보와 추천 이유가 화면을 채운다.
//                    3. 공공 무료 상담 경로는 기본 접힘(후보 0명이면 기본 펼침), 누르면 펼친다.
// 완료 기준: 상담 주제(복수)·방식·지역·예산·희망 시점·언어를 고르고 조건마다 꼭 필요/선호/상관없음을 정하면
//            꼭 필요 조건을 충족한 후보를 조건 일치 순으로 보여 주고(상위 3명 + 전체 후보 보기), 추천 이유는 점수에 쓴
//            확인 필드로만 만든다. 폼에서 조건을 바꾸고 다시 보면 재계산하고, 0명이면 조건을 바꾸지 않은 채 가장 많이 거른 조건과
//            조건 수정·대한변협 공식 검색·공공 무료 상담 경로를 안내한다.
// 알려진 제한: 실제 프로필 확보 전에는 가상 프로필로 로직만 시연, 연락·예약 없음.
// 접근성: 조건은 fieldset/legend + 네이티브 체크박스·라디오, 중요도 라디오에는 조건 이름을 숨김 글자로 붙인다.
//         결과 단계 진입 시 결과 제목(h2)으로 포커스 + aria-live="polite" 결과 알림, [조건 수정]은 폼 단계로 돌아가
//         첫 조건 그룹(상담 주제)으로 포커스. 공공 경로는 h2 안의 aria-expanded 버튼으로 펼친다.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { go } from '../router'
import { postMetric } from '../api'
import { AGENCIES, AGENCY_KIND_LABEL, formatCheckedAt, type Agency } from '../data/agencies'
import {
  BUDGETS,
  BUDGET_LABEL,
  LANGS,
  LANG_LABEL,
  METHODS,
  METHOD_LABEL,
  REGIONS,
  REGION_LABEL,
  REGION_SHORT,
  TIMINGS,
  TIMING_LABEL,
  TOPICS,
  TOPIC_LABEL,
  TOPIC_SHORT,
  BUDGET_MINUTES,
  type LawyerProfile,
} from '../data/lawyers'
import {
  CRITERION_LABEL,
  EMPTY_CRITERIA,
  EXAMPLE_CRITERIA,
  LEVELS,
  LEVEL_LABEL,
  MAX_SHOWN,
  WEIGHTS,
  isRegionActive,
  matchLawyers,
  missingFields,
  wonShort,
  type Candidate,
  type Criteria,
  type CriterionKey,
  type Level,
} from '../lib/lawyerMatch'
import '../styles/lawyers.css'

/* ── 상수 ───────────────────────────────────────────── */

/** 공공 무료 상담 경로 — src/data/agencies.ts 의 공공·학교 상담 창구만(변호사 검색은 고지·0명 안내에서 따로) */
const PUBLIC_IDS = ['klac', 'hldcc', 'seoul', 'kookmin'] as const
const PUBLIC_PATHS: Agency[] = PUBLIC_IDS.map((id) => AGENCIES.find((a) => a.id === id)).filter((a): a is Agency => !!a)
const KOREANBAR = AGENCIES.find((a) => a.id === 'koreanbar')

/* ── 작은 도우미 ───────────────────────────────────── */

function reduceMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** 화면 안의 요소로 이동 + 포커스 (해시 라우팅이라 #anchor 링크 대신) */
function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function cloneCriteria(c: Criteria): Criteria {
  return { ...c, topics: [...c.topics], methods: [...c.methods], levels: { ...c.levels } }
}

/* ── 선 아이콘 (장식, aria-hidden). 로고·도장·방패 모양은 쓰지 않는다 ── */

function IconExternal() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9.5 9.5" />
      <path d="M19 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.5" />
    </svg>
  )
}

/* 키 비주얼: 조건 체크리스트 → 후보 카드 3장. 순수 SVG 선 그림, 사진·로고 없음. */
function LawyerArt() {
  return (
    <div className="lw-hero-art">
      <svg viewBox="0 0 240 150" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {/* 조건 체크리스트 */}
        <rect x="14" y="22" width="84" height="106" rx="6" fill="#fff" />
        <path d="M30 22v-6h52v6" />
        <rect x="26" y="40" width="12" height="12" rx="2" fill="var(--primary)" stroke="var(--primary)" />
        <path d="M29 46l3 3 5-6" stroke="#fff" />
        <path d="M46 46h40" stroke="var(--line-strong)" />
        <rect x="26" y="62" width="12" height="12" rx="2" fill="var(--primary)" stroke="var(--primary)" />
        <path d="M29 68l3 3 5-6" stroke="#fff" />
        <path d="M46 68h32" stroke="var(--line-strong)" />
        <rect x="26" y="84" width="12" height="12" rx="2" fill="var(--primary)" stroke="var(--primary)" />
        <path d="M29 90l3 3 5-6" stroke="#fff" />
        <path d="M46 90h36" stroke="var(--line-strong)" />
        <rect x="26" y="106" width="12" height="12" rx="2" fill="var(--primary-soft)" />
        <path d="M46 112h28" stroke="var(--line-strong)" />
        {/* 화살표 */}
        <path d="M110 75h24" />
        <path d="M127 67l8 8-8 8" />
        {/* 후보 카드 3장 */}
        <rect x="156" y="14" width="70" height="36" rx="5" fill="#fff" />
        <circle cx="170" cy="32" r="7" fill="var(--primary-soft)" />
        <path d="M184 27h30M184 37h20" stroke="var(--line-strong)" />
        <rect x="156" y="58" width="70" height="36" rx="5" fill="#fff" />
        <circle cx="170" cy="76" r="7" fill="var(--primary-soft)" />
        <path d="M184 71h30M184 81h20" stroke="var(--line-strong)" />
        <rect x="156" y="102" width="70" height="36" rx="5" fill="#fff" />
        <circle cx="170" cy="120" r="7" fill="var(--primary-soft)" />
        <path d="M184 115h30M184 125h20" stroke="var(--line-strong)" />
      </svg>
    </div>
  )
}

/* ── 중요도(꼭 필요 / 선호 / 상관없음) ─────────────── */

function LevelPicker({ name, target, value, onChange, disabled, offNote }: { name: string; target: string; value: Level; onChange: (v: Level) => void; disabled?: boolean; offNote?: string }) {
  return (
    <fieldset className={`lw-level${disabled ? ' is-off' : ''}`} disabled={disabled}>
      <legend className="lw-sr-only">
        {target} 중요도{disabled && offNote ? ` (${offNote})` : ''}
      </legend>
      <span className="lw-level-label" aria-hidden="true">
        중요도
      </span>
      {LEVELS.map((lv) => {
        const id = `${name}-${lv}`
        return (
          <span className={`lw-lv lw-lv-${lv}`} key={lv}>
            <input type="radio" name={name} id={id} value={lv} checked={value === lv} disabled={disabled} onChange={() => onChange(lv)} />
            <label htmlFor={id}>
              {LEVEL_LABEL[lv]}
              <span className="lw-sr-only"> — {target}</span>
            </label>
          </span>
        )
      })}
      {disabled && offNote && (
        <span className="lw-level-off small muted" aria-hidden="true">
          {offNote}
        </span>
      )}
    </fieldset>
  )
}

/* ── 선택 그룹 (fieldset/legend + 네이티브 라디오·체크박스, 칩 모양) ── */

interface ChoiceGroupProps<T extends string> {
  name: string
  kind: 'radio' | 'checkbox'
  legend: string
  legendExtra?: ReactNode
  hint?: ReactNode
  options: readonly T[]
  labelOf: (v: T) => string
  isChecked: (v: T) => boolean
  onToggle: (v: T) => void
  disabled?: boolean
  level?: { value: Level; onChange: (v: Level) => void; disabled?: boolean; offNote?: string }
  fieldsetRef?: Ref<HTMLFieldSetElement>
}

function ChoiceGroup<T extends string>({ name, kind, legend, legendExtra, hint, options, labelOf, isChecked, onToggle, disabled, level, fieldsetRef }: ChoiceGroupProps<T>) {
  const hintId = hint ? `${name}-hint` : undefined
  return (
    <fieldset className={`lw-fieldset${disabled ? ' is-off' : ''}`} ref={fieldsetRef} aria-describedby={hintId}>
      <legend className="lw-legend">
        <span>{legend}</span>
        {legendExtra}
      </legend>
      {hint && (
        <p id={hintId} className="lw-hint small muted">
          {hint}
        </p>
      )}
      {level && (
        <LevelPicker name={`${name}-lv`} target={legend} value={level.value} onChange={level.onChange} disabled={level.disabled} offNote={level.offNote} />
      )}
      <div className="lw-chips">
        {options.map((v, i) => {
          const id = `${name}-${i}`
          return (
            <span className={`lw-opt${kind === 'checkbox' ? ' is-check' : ''}`} key={v}>
              <input type={kind} name={name} id={id} value={v} checked={isChecked(v)} disabled={disabled} onChange={() => onToggle(v)} />
              <label htmlFor={id}>{labelOf(v)}</label>
            </span>
          )
        })}
      </div>
    </fieldset>
  )
}

/* ── 후보 카드 ─────────────────────────────────────── */

function Ask({ children }: { children: ReactNode }) {
  return <span className="lw-ask">{children}</span>
}

function CandidateCard({ c, rank }: { c: Candidate; rank: number }) {
  const p: LawyerProfile = c.profile
  const offersVisit = p.methods?.includes('visit') ?? false
  return (
    <li className="card lw-cand">
      <div className="lw-cand-head">
        <span className="lw-cand-rank">
          <span className="lw-sr-only">추천 순서 </span>
          {rank}
        </span>
        <h3 className="lw-cand-name">{p.name}</h3>
        <span className="badge warn">가상 프로필</span>
        <span className="lw-match">
          조건 일치 <span className="num">{c.score}</span>
        </span>
      </div>
      <h4 className="lw-cand-sub">추천 이유</h4>
      <p className="lw-reason">{c.reason}</p>
      <dl className="lw-rows">
        <div>
          <dt>취급 업무</dt>
          <dd>
            <span className="lw-tags">
              {p.topics.map((t) => {
                const hit = c.topicMatched.includes(t)
                return (
                  <span key={t} className={`lw-tag${hit ? ' is-match' : ''}`}>
                    {TOPIC_SHORT[t]}
                    {hit && <span className="lw-sr-only"> (선택한 주제)</span>}
                  </span>
                )
              })}
            </span>
            <span className="muted small lw-src">서비스 검색 태그 · 가상 기재</span>
          </dd>
        </div>
        <div>
          <dt>등록 전문분야</dt>
          <dd>{p.registeredSpecialty ?? <span className="muted">등록 전문분야 없음·미확인</span>}</dd>
        </div>
        <div>
          <dt>상담 방식</dt>
          <dd>{p.methods ? p.methods.map((m) => METHOD_LABEL[m]).join(' · ') : <Ask>상담 방식 문의 필요</Ask>}</dd>
        </div>
        <div>
          <dt>방문 지역</dt>
          <dd>
            {p.methods === null || (offersVisit && p.regions === null) ? (
              <Ask>방문 지역 문의 필요</Ask>
            ) : offersVisit && p.regions ? (
              p.regions.map((r) => REGION_SHORT[r]).join(' · ')
            ) : (
              <span className="muted">방문 상담 없음</span>
            )}
          </dd>
        </div>
        <div>
          <dt>상담료</dt>
          <dd>
            {p.fee ? (
              <>
                <span className="num">
                  {p.fee.minutes}분 {wonShort(p.fee.amount)}
                </span>{' '}
                <span className="muted small">
                  (부가세 {p.fee.vatIncluded ? '포함' : '별도'} · 가상)
                </span>
                {p.fee.minutes !== BUDGET_MINUTES && (
                  <span className="lw-src small muted">{BUDGET_MINUTES}분 요금이 아니라 예산과 비교하지 않아요(환산하지 않음)</span>
                )}
              </>
            ) : (
              <Ask>요금 문의 필요</Ask>
            )}
          </dd>
        </div>
        <div>
          <dt>일정</dt>
          <dd>
            {p.availability ? (
              <>
                {TIMING_LABEL[p.availability]} 상담 가능으로 기재 <span className="muted small">(확정 예약 아님 · 가상)</span>
              </>
            ) : (
              <Ask>일정 문의 필요</Ask>
            )}
          </dd>
        </div>
        <div>
          <dt>언어</dt>
          <dd>{p.languages ? p.languages.map((l) => LANG_LABEL[l]).join(' · ') : <Ask>언어 문의 필요</Ask>}</dd>
        </div>
        <div>
          <dt>정보 확인일</dt>
          <dd>
            <span className="num">{formatCheckedAt(p.checkedAt)}</span> <span className="muted small">(가상)</span>
          </dd>
        </div>
      </dl>
      <p className="lw-cand-foot small muted">가상 프로필이라 연락·예약할 수 없어요. 실제 변호사는 대한변호사협회 공식 검색에서 확인하세요.</p>
    </li>
  )
}

/* ── 공공 무료 상담 경로 카드 ───────────────────────── */

function PublicPathCard({ a }: { a: Agency }) {
  return (
    <li className="card lw-public-card">
      <div className="lw-public-head">
        <h3 className="lw-public-name">{a.name}</h3>
        <span className="badge">{AGENCY_KIND_LABEL[a.kind]}</span>
      </div>
      <p className="lw-public-what">{a.what}</p>
      <dl className="lw-rows lw-rows-public">
        <div>
          <dt>어떻게</dt>
          <dd>{a.how}</dd>
        </div>
        {a.cost && (
          <div>
            <dt>비용</dt>
            <dd>{a.cost}</dd>
          </div>
        )}
      </dl>
      <div className="lw-public-foot">
        <a className="btn" href={a.url} target="_blank" rel="noopener noreferrer" aria-label={`${a.name} 공식 홈페이지 (새 창)`}>
          공식 홈페이지
          <IconExternal />
        </a>
        <span className="small muted lw-public-domain">
          {host(a.url)} · 확인일 {formatCheckedAt(a.checkedAt)}
        </span>
      </div>
    </li>
  )
}

/* ── 읽어 주는 상태 문장 ───────────────────────────── */

/**
 * 단계가 바뀌며 새로 붙는 live region 은 처음 내용을 안 읽어 주는 화면 낭독기가 있어서,
 * 빈 채로 붙인 뒤 한 박자 늦게 글자를 채운다. 이후 글자가 바뀔 때마다 다시 읽어 준다.
 */
function LiveStatus({ text, className, id }: { text: string; className: string; id?: string }) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setShown(text), 60)
    return () => window.clearTimeout(t)
  }, [text])
  return (
    <p id={id} className={className} role="status" aria-live="polite" aria-atomic="true">
      {shown}
    </p>
  )
}

/* ── 화면 ─────────────────────────────────────────── */

type Step = 'form' | 'results'

export default function Lawyers() {
  const uid = useId()
  const [crit, setCrit] = useState<Criteria>(() => cloneCriteria(EMPTY_CRITERIA))
  const [step, setStep] = useState<Step>('form')
  const [showAll, setShowAll] = useState(false)
  /** 공공 무료 상담 경로 펼침 — null 이면 기본값(결과 단계에서 후보 0명일 때만 펼침) */
  const [publicOpen, setPublicOpen] = useState<boolean | null>(null)
  const topicRef = useRef<HTMLFieldSetElement>(null)
  const resultsTitleRef = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<Step | null>(null)
  const metricSent = useRef(false)
  const listId = `${uid}-cands`
  const publicBodyId = `${uid}-public-body`
  const missingId = `${uid}-missing`

  const update = (fn: (c: Criteria) => void) =>
    setCrit((prev) => {
      const next = cloneCriteria(prev)
      fn(next)
      return next
    })
  const toggleIn = <T,>(arr: T[], v: T): T[] => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  const setLevel = (key: CriterionKey) => (v: Level) => update((c) => (c.levels[key] = v))

  const missing = missingFields(crit)
  const regionActive = isRegionActive(crit)
  // 방문을 고르지 않았거나 방식이 상관없음이면 지역 중요도도 의미가 없다 (지역 '상관없음' 자체는 되돌릴 수 있게 비활성 대상에서 뺀다)
  const visitOff = !crit.methods.includes('visit') || crit.levels.method === 'any'

  // 값이 다 모이면 계산 — 폼에서 조건을 바꾸고 다시 보면 점수·순위·이유가 새로 계산된다
  const result = useMemo(() => (missingFields(crit).length === 0 ? matchLawyers(crit) : null), [crit])
  // 결과 단계는 계산 결과가 있을 때만 (필수 값이 비면 들어올 수 없다)
  const inResults = step === 'results' && result !== null

  const total = result?.ranked.length ?? 0
  const visible = result ? (showAll ? result.ranked : result.ranked.slice(0, MAX_SHOWN)) : []
  const hasMore = total > MAX_SHOWN
  const publicExpanded = publicOpen ?? (inResults && total === 0)

  // 익명 집계: 결과 단계 첫 진입 때 1번만
  useEffect(() => {
    if (inResults && !metricSent.current) {
      metricSent.current = true
      postMetric('lawyer_search')
    }
  }, [inResults])

  /** [조건 수정] — 조건 폼 첫 그룹(상담 주제)으로 포커스. 고른 값이 있으면 그 칸, 없으면 첫 칸 */
  const focusConditions = () => {
    const root = topicRef.current
    if (!root) return
    const target = root.querySelector<HTMLInputElement>('input:checked') ?? root.querySelector<HTMLInputElement>('input')
    root.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' })
    target?.focus({ preventScroll: true })
    // 마우스로 누른 뒤의 프로그램 포커스는 :focus-visible 이 안 켜질 수 있어 잠깐 강조한다
    const opt = target?.closest<HTMLElement>('.lw-opt')
    if (opt) {
      opt.classList.remove('lw-flash')
      void opt.offsetWidth
      opt.classList.add('lw-flash')
      const clear = () => opt.classList.remove('lw-flash')
      target?.addEventListener('blur', clear, { once: true })
      window.setTimeout(clear, 2000)
    }
  }

  // 단계가 바뀐 뒤(새 단계가 그려진 다음) 포커스를 옮긴다
  useEffect(() => {
    const want = pendingFocus.current
    if (!want || want !== step) return
    pendingFocus.current = null
    if (want === 'results') {
      const h = resultsTitleRef.current
      if (!h) return
      h.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
      h.focus({ preventScroll: true })
    } else {
      focusConditions()
    }
  }, [step])

  const showResults = () => {
    if (missingFields(crit).length > 0) return
    setShowAll(false)
    setPublicOpen(null)
    pendingFocus.current = 'results'
    setStep('results')
  }

  const applyExample = () => {
    setCrit(cloneCriteria(EXAMPLE_CRITERIA))
    setShowAll(false)
    setPublicOpen(null)
    pendingFocus.current = 'results'
    setStep('results')
  }

  const editConditions = () => {
    pendingFocus.current = 'form'
    setStep('form')
  }

  const openPublic = () => {
    setPublicOpen(true)
    window.setTimeout(() => jumpTo('lw-public'), 0)
  }

  // 읽어 주는 상태 문장
  const formStatus =
    missing.length > 0
      ? `아직 고르지 않은 조건: ${missing.join(' · ')}. 다 고르면 [조건으로 후보 보기]를 누를 수 있어요.`
      : '조건을 다 골랐어요. [조건으로 후보 보기]를 누르면 후보와 추천 이유를 보여 줘요.'
  let resultStatus = ''
  if (result) {
    if (total === 0) resultStatus = '현재 조건으로 확인된 후보가 없습니다.'
    else {
      // 순위·점수가 바뀌면 문장도 바뀌어야 다시 읽어 준다 — 1~3위 이름·점수와 빠진 기준을 함께 담는다
      const top = result.ranked
        .slice(0, 3)
        .map((c, i) => `${i + 1}위 ${c.profile.name}(조건 일치 ${c.score})`)
        .join(', ')
      const off = !regionActive ? ' · 지역은 계산에서 제외' : ''
      resultStatus = `조건에 맞는 후보 ${total}명${hasMore && !showAll ? ` · 조건 일치 순으로 ${MAX_SHOWN}명 먼저` : ''} · ${top}${off}`
    }
  }

  const isEmpty = crit.topics.length === 0 && crit.methods.length === 0 && !crit.region && !crit.budget && !crit.timing && !crit.language
  const lv = (k: CriterionKey) => ` · ${LEVEL_LABEL[crit.levels[k]]}`

  // 고른 조건 요약 — 주제·방식·지역·예산·시점·언어 + 중요도
  const summary: string[] = [
    `${crit.topics.map((t) => TOPIC_SHORT[t]).join('·')}`,
    crit.levels.method === 'any' ? '방식 상관없음' : `${crit.methods.map((m) => METHOD_LABEL[m]).join('·')}${lv('method')}`,
    !regionActive ? '지역 제외' : crit.region ? `${REGION_SHORT[crit.region]}${lv('region')}` : '지역 미선택',
    crit.levels.budget === 'any' ? '예산 상관없음' : crit.budget ? `${BUDGET_LABEL[crit.budget]}${lv('budget')}` : '예산 미선택',
    crit.levels.timing === 'any' ? '시점 상관없음' : crit.timing ? `${TIMING_LABEL[crit.timing]}${lv('timing')}` : '시점 미선택',
    crit.levels.language === 'any' ? '언어 상관없음' : crit.language ? `${LANG_LABEL[crit.language]}${lv('language')}` : '언어 미선택',
  ]

  const regionHint = !crit.methods.includes('visit') || crit.levels.method === 'any'
    ? '방문을 고르지 않아 지역은 점수·자격에서 빠져요. 방문을 고르면 지역을 계산에 넣어요.'
    : crit.levels.region === 'any'
      ? '상관없음 — 지역은 점수·자격에서 빠져요.'
      : '방문 상담 가능 지역으로 확인해요. 상세 주소는 필요 없어요.'

  return (
    <section className="lw">
      <nav className="lw-crumb" aria-label="현재 위치">
        <ol>
          <li>
            <button type="button" className="linklike" onClick={() => go('home')}>
              처음
            </button>
          </li>
          <li aria-current="page">변호사 찾아보기</li>
        </ol>
      </nav>

      {/* 키 비주얼 — 결과 단계에서는 제목만 남겨 후보가 화면을 채우게 한다 */}
      {inResults ? (
        <div className="lw-hero is-compact">
          <div className="lw-hero-body">
            <p className="eyebrow">상담 준비</p>
            <h1>변호사 찾아보기</h1>
          </div>
        </div>
      ) : (
        <div className="lw-hero">
          <div className="lw-hero-body">
            <p className="eyebrow">상담 준비</p>
            <h1>변호사 찾아보기</h1>
            <p className="lead">
              상담 주제와 방식·지역·예산·희망 시점·언어를 고르고, 조건마다 꼭 필요·선호·상관없음을 정한 뒤 [조건으로 후보 보기]를 누르면 조건 일치 순으로 후보와 추천 이유를 보여 줘요.
            </p>
            <div className="lw-hero-actions">
              <button type="button" className="btn primary" onClick={() => jumpTo('lw-form')}>
                조건 고르기
              </button>
              <button type="button" className="btn ghost" onClick={applyExample}>
                예시 조건으로 보기
              </button>
            </div>
          </div>
          <LawyerArt />
        </div>
      )}

      {/* 상단 고지 — 두 단계 모두 눈에 잘 띄게 */}
      <div className="notice warn lw-notice" role="note">
        <strong>데모용 가상 프로필이에요. 실제 변호사가 아니며 연락·예약할 수 없어요.</strong>
        <p>
          보증금 지킴이는 변호사에게서 소개비·수수료·광고비를 받지 않고, 돈으로 순위를 바꾸지 않아요(변호사법 제34조 고려). 순서는 고른 조건과 확인된 프로필 정보로만 정해져요.
        </p>
        <p>
          실제 변호사는 대한변호사협회 공식 변호사 검색에서 직접 확인하세요.{' '}
          {KOREANBAR && (
            <a href={KOREANBAR.url} target="_blank" rel="noopener noreferrer" aria-label="대한변호사협회 변호사 검색 (새 창)">
              대한변협 변호사 검색
              <IconExternal />
            </a>
          )}
        </p>
      </div>

      {/* 1단계: 조건 선택 */}
      {!inResults && (
        <section id="lw-form" className="lw-form-sec" aria-labelledby="lw-form-title" tabIndex={-1}>
          <div className="section-head">
            <h2 id="lw-form-title">1. 상담 조건 고르기</h2>
            <p className="muted small">꼭 필요 = 충족이 확인된 후보만 남겨요. 선호 = 점수에만 반영해요. 상관없음 = 계산에서 빼요.</p>
          </div>
          <div className="card lw-form">
            <ChoiceGroup
              name={`${uid}-topic`}
              kind="checkbox"
              legend="상담 주제"
              legendExtra={<span className="lw-legend-sub muted">1개 이상 · 여러 개 선택 가능</span>}
              hint="서비스 검색 태그예요. 대한변협 공식 전문분야 명칭이 아니에요. 고른 주제 중 하나 이상의 취급 업무가 확인된 후보만 나와요."
              options={TOPICS}
              labelOf={(v) => TOPIC_LABEL[v]}
              isChecked={(v) => crit.topics.includes(v)}
              onToggle={(v) => update((c) => (c.topics = toggleIn(c.topics, v)))}
              fieldsetRef={topicRef}
            />
            <ChoiceGroup
              name={`${uid}-method`}
              kind="checkbox"
              legend="상담 방식"
              legendExtra={<span className="lw-legend-sub muted">여러 개 선택 가능</span>}
              hint={crit.levels.method === 'any' ? '상관없음 — 상담 방식은 점수·자격에서 빠져요.' : '고른 방식 중 하나라도 제공하면 일치예요.'}
              options={METHODS}
              labelOf={(v) => METHOD_LABEL[v]}
              isChecked={(v) => crit.methods.includes(v)}
              onToggle={(v) => update((c) => (c.methods = toggleIn(c.methods, v)))}
              disabled={crit.levels.method === 'any'}
              level={{ value: crit.levels.method, onChange: setLevel('method') }}
            />
            <ChoiceGroup
              name={`${uid}-region`}
              kind="radio"
              legend="지역"
              legendExtra={regionActive ? <span className="badge">방문 상담에 적용</span> : <span className="badge">계산에서 제외</span>}
              hint={regionHint}
              options={REGIONS}
              labelOf={(v) => REGION_LABEL[v]}
              isChecked={(v) => crit.region === v}
              onToggle={(v) => update((c) => (c.region = v))}
              disabled={!regionActive}
              level={{ value: crit.levels.region, onChange: setLevel('region'), disabled: visitOff, offNote: '방문을 고르면 적용돼요' }}
            />
            <ChoiceGroup
              name={`${uid}-budget`}
              kind="radio"
              legend="예산"
              legendExtra={<span className="lw-legend-sub muted">30분 상담 기준</span>}
              hint={crit.levels.budget === 'any' ? '상관없음 — 예산은 점수·자격에서 빠져요.' : '30분 요금이 확인된 후보만 비교해요. 다른 시간 단위 요금은 환산하지 않아요.'}
              options={BUDGETS}
              labelOf={(v) => BUDGET_LABEL[v]}
              isChecked={(v) => crit.budget === v}
              onToggle={(v) => update((c) => (c.budget = v))}
              disabled={crit.levels.budget === 'any'}
              level={{ value: crit.levels.budget, onChange: setLevel('budget') }}
            />
            <ChoiceGroup
              name={`${uid}-timing`}
              kind="radio"
              legend="희망 시점"
              hint={crit.levels.timing === 'any' ? '상관없음 — 희망 시점은 점수·자격에서 빠져요.' : '프로필에 기재된 상담 가능 시점으로만 비교해요(확정 예약 아님).'}
              options={TIMINGS}
              labelOf={(v) => TIMING_LABEL[v]}
              isChecked={(v) => crit.timing === v}
              onToggle={(v) => update((c) => (c.timing = v))}
              disabled={crit.levels.timing === 'any'}
              level={{ value: crit.levels.timing, onChange: setLevel('timing') }}
            />
            <ChoiceGroup
              name={`${uid}-lang`}
              kind="radio"
              legend="언어"
              hint={
                crit.levels.language === 'must'
                  ? '꼭 필요 — 이 언어가 확인된 후보만 남겨요. 언어는 점수에 넣지 않아요.'
                  : '언어는 점수에 넣지 않고, 꼭 필요일 때만 후보를 걸러요.'
              }
              options={LANGS}
              labelOf={(v) => LANG_LABEL[v]}
              isChecked={(v) => crit.language === v}
              onToggle={(v) => update((c) => (c.language = v))}
              disabled={crit.levels.language === 'any'}
              level={{ value: crit.levels.language, onChange: setLevel('language') }}
            />
            <div className="lw-form-actions">
              <LiveStatus id={missingId} className={`lw-missing${missing.length > 0 ? '' : ' is-ready'}`} text={formStatus} />
              <button type="button" className="btn primary lw-submit" onClick={showResults} disabled={missing.length > 0} aria-describedby={missingId}>
                조건으로 후보 보기
              </button>
              <button type="button" className="btn" onClick={applyExample}>
                예시 조건으로 보기
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setCrit(cloneCriteria(EMPTY_CRITERIA))
                  setShowAll(false)
                }}
                disabled={isEmpty}
              >
                조건 지우기
              </button>
              <span className="small muted lw-example-note">예시: 원상회복 비용·보증금 반환 · 방문 · 서울 동북권 · 5만원 이하 · 3일 이내 (모두 선호)</span>
            </div>
          </div>
        </section>
      )}

      {/* 2단계: 결과 — 폼은 숨기고 후보가 화면을 채운다 */}
      {inResults && result && (
        <section id="lw-results" className="lw-results-sec" aria-labelledby="lw-results-title">
          <div className="lw-summary-bar">
            <p className="lw-summary">
              <span className="lw-summary-label">고른 조건</span>
              {summary.map((s, i) => (
                <span key={i} className="lw-chip">
                  {s}
                </span>
              ))}
            </p>
            <button type="button" className="btn lw-edit" onClick={editConditions}>
              조건 수정
            </button>
          </div>

          <div className="section-head">
            <h2 id="lw-results-title" ref={resultsTitleRef} tabIndex={-1}>
              2. 후보와 추천 이유
            </h2>
            <p className="muted small">
              꼭 필요 조건을 충족한 후보만, 조건 일치 높은 순 → 정보 확인일 최근 순. 조건 일치는 고른 조건과 확인된 프로필 정보가 맞는 정도이며, 변호사 실력이나 사건 결과를 평가한 값이 아니에요.
            </p>
          </div>

          <LiveStatus className={`lw-status${total > 0 ? ' is-ok' : ' is-none'}`} text={resultStatus} />

          <details className="lw-calc">
            <summary>조건 일치 계산 방법</summary>
            <p className="small">
              조건 일치 = 100 × (이번에 쓰는 기준의 가중치 × 일치값 합) ÷ (이번에 쓰는 기준의 가중치 합), 반올림.
            </p>
            <p className="small">
              이번 계산:{' '}
              {result.active.map((k) => `${CRITERION_LABEL[k]} ${WEIGHTS[k]}`).join(' · ')}
              {' '}(합 {result.active.reduce((n, k) => n + WEIGHTS[k], 0)}). 주제 일치값 = 확인된 취급 주제 수 ÷ 고른 주제 수, 나머지는 확인되면 1·불일치나 미확인이면 0.
            </p>
            <p className="small muted">상관없음과(방문을 고르지 않았을 때의) 지역은 모든 후보에서 빼요. 정보가 없는 후보의 분모를 줄여 유리하게 만들지 않아요. 가중치는 초기 설계 가설이에요.</p>
          </details>

          {total > 0 && (
            <>
              <p className="lw-count">
                {hasMore ? (
                  <>
                    후보 <span className="num">{total}</span>명 중 <span className="num">{showAll ? total : MAX_SHOWN}</span>명 표시
                  </>
                ) : (
                  <>
                    후보 <span className="num">{total}</span>명
                  </>
                )}
              </p>
              <ol className="lw-cands" id={listId}>
                {visible.map((c, i) => (
                  <CandidateCard key={c.profile.id} c={c} rank={i + 1} />
                ))}
              </ol>
              {hasMore && (
                <div className="lw-expand">
                  <button type="button" className="btn" aria-expanded={showAll} aria-controls={listId} onClick={() => setShowAll((v) => !v)}>
                    {showAll ? `상위 ${MAX_SHOWN}명만 보기` : `전체 후보 보기 (${total}명)`}
                  </button>
                </div>
              )}
            </>
          )}

          {total === 0 && (
            <div className="card lw-empty" role="group" aria-labelledby="lw-empty-title">
              <h3 id="lw-empty-title">현재 조건으로 확인된 후보가 없습니다</h3>
              {result.blocker && (
                <p className="lw-empty-hint">
                  {result.blocker.key === 'topic' ? (
                    <strong>고른 상담 주제의 취급 업무가 확인된 가상 후보가 없어요.</strong>
                  ) : (
                    <>
                      <strong>꼭 필요로 고른 조건 중 ‘{result.blocker.label}’에서 가장 많이 제외됐어요.</strong> 주제가 맞는 가상 후보 {result.blocker.base}명 중{' '}
                      {result.blocker.count}명{result.blocker.unknown > 0 ? `(그중 ${result.blocker.unknown}명은 정보 미확인)` : ''}이 이 조건에서 빠졌어요.
                    </>
                  )}
                </p>
              )}
              <p className="small muted">조건은 자동으로 바꾸지 않았어요. 직접 완화하거나(예: 꼭 필요 → 선호), 공식 검색·공공 무료 상담을 이용해 보세요.</p>
              <div className="lw-empty-actions">
                <button type="button" className="btn primary" onClick={editConditions}>
                  조건 수정
                </button>
                {KOREANBAR && (
                  <a className="btn" href={KOREANBAR.url} target="_blank" rel="noopener noreferrer" aria-label="대한변호사협회 공식 변호사 검색 (새 창)">
                    대한변협 공식 변호사 검색
                    <IconExternal />
                  </a>
                )}
                <button type="button" className="btn ghost" onClick={openPublic}>
                  공공 무료 상담 경로 보기
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. 공공 무료 상담 경로 — 기본 접힘(후보 0명이면 펼침). 변호사 후보 점수와 섞지 않는다 */}
      <section id="lw-public" className="lw-public-sec" aria-labelledby="lw-public-title" tabIndex={-1}>
        <h2 id="lw-public-title" className="lw-public-toggle-h">
          <button type="button" className="lw-public-toggle" aria-expanded={publicExpanded} aria-controls={publicBodyId} onClick={() => setPublicOpen(!publicExpanded)}>
            <span className="lw-public-toggle-text">
              <span>3. 공공 무료 상담 경로</span>
              <span className="lw-public-toggle-sub">
                무료로 먼저 물어볼 수 있는 곳 {PUBLIC_PATHS.length}곳 · {publicExpanded ? '접기' : '펼쳐 보기'}
              </span>
            </span>
            <svg className="lw-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </h2>
        <div id={publicBodyId} className="lw-public-body" hidden={!publicExpanded}>
          <p className="muted small lw-public-lead">변호사 후보 대신, 또는 그 전에 먼저 물어볼 수 있는 곳이에요. 위 후보 순위와 섞지 않아요. 공식 홈페이지에서 확인한 내용만 적었어요.</p>
          <ul className="lw-public">
            {PUBLIC_PATHS.map((a) => (
              <PublicPathCard key={a.id} a={a} />
            ))}
          </ul>
          <p className="lw-public-note small muted">링크는 새 창에서 열려요. 고른 조건이나 사건 정보를 다른 곳에 보내지 않아요.</p>
        </div>
      </section>

      {/* 다른 업무 */}
      <section aria-labelledby="lw-more-title">
        <div className="section-head">
          <h2 id="lw-more-title">다른 업무 보기</h2>
        </div>
        <ul className="lw-more">
          <li>
            <button type="button" className="btn" onClick={() => go('deduct')}>
              <span>공제 정리</span>
              <small>항목·금액·원문 정리와 문의 문구</small>
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => go('help')}>
              <span>상담 기관 상세</span>
              <small>무료 법률상담 기관·공식 링크</small>
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => go('record')}>
              <span>기록북</span>
              <small>입주·퇴실 사진을 한 문서로</small>
            </button>
          </li>
        </ul>
      </section>
    </section>
  )
}
