import { useEffect, useMemo, useRef, useState } from 'react'
import { useSelection, useStore } from '../state'
import { ApiFailure, MAX_TEXT, SAMPLE_TEXT, extractItems, won } from '../api'
import { go } from '../router'
import type { Contractor } from '../types'
import { maskText, summarizeMask, type MaskResult, type MaskWord, type WordKind } from '../lib/mask'
import ItemTable from '../components/deduct/ItemTable'
import MessageBox from '../components/deduct/MessageBox'
import NextSteps from '../components/deduct/NextSteps'
import RefCards from '../components/deduct/RefCards'
import { REFERENCES, findReferences, type Reference } from '../data/references'
import { ReviewPanel, SentPanel } from '../components/deduct/ReviewPanel'
import { newManualItem } from '../components/deduct/newItem'
import { IconCheck } from '../components/deduct/icons'
import { scrollToEl } from '../components/deduct/motion'
import '../styles/deduct.css'

type Status = 'idle' | 'loading' | 'error'
/** 1 붙여넣기(input) → 2 전송본 확인(review) → 보낸 뒤(sent). 직접 입력·처음부터는 input 으로 돌아간다 */
type Phase = 'input' | 'review' | 'sent'

const SLOW_MS = 30_000
const ABORT_MS = 45_000

const CONTRACTOR_OPTIONS: { value: Contractor; label: string }[] = [
  { value: 'self', label: '본인' },
  { value: 'other', label: '가족 등 다른 사람' },
  { value: 'unknown', label: '확인 안 함' },
]

/** 진행 단계 — target 은 아래 섹션 제목(h2)의 id */
const STEPS = [
  { n: 1, label: '붙여넣기', target: 'dd-step1' },
  { n: 2, label: '전송본 확인', target: 'dd-step2' },
  { n: 3, label: '확인·선택', target: 'dd-step3' },
  { n: 4, label: '문의 문자', target: 'dd-step4' },
  { n: 5, label: '다음 단계', target: 'dd-step5' },
] as const

function Stepper({ current, reviewOpen, hasResult }: { current: number; reviewOpen: boolean; hasResult: boolean }) {
  return (
    <ol className="dd-steps" aria-label="진행 단계">
      {STEPS.map((s) => {
        const state = s.n < current ? 'done' : s.n === current ? 'current' : 'todo'
        const inner = (
          <>
            <span className="dd-step-no">{state === 'done' ? <IconCheck size={14} strokeWidth="2.5" /> : s.n}</span>
            <span className="dd-step-label">{s.label}</span>
          </>
        )
        // 섹션이 있어야 눌러서 갈 수 있다: 2단계는 전송본 확인 패널이 열린 뒤, 3~5단계는 결과가 나온 뒤
        const jumpable = s.n === 1 || (s.n === 2 ? reviewOpen : hasResult)
        return (
          <li key={s.n} className={`dd-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            {jumpable ? (
              <button
                type="button"
                className="dd-step-btn"
                aria-label={`${s.n}단계 ${s.label}`}
                onClick={() => scrollToEl(document.getElementById(s.target))}
              >
                {inner}
              </button>
            ) : (
              <span className="dd-step-btn">{inner}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** 해시 주소의 쿼리(#/deduct?sample=1&auto=1) — App 이 넘기지 않는 값은 여기서 직접 읽는다 */
function hashQuery(): URLSearchParams {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '')
}

export default function Deduct({ sample = false }: { sample?: boolean }) {
  const { deduction, setDeduction, resetDeduction } = useStore()
  const { askTotal, itemSum, selected } = useSelection()

  const [draft, setDraft] = useState(deduction.rawText)
  const [phase, setPhase] = useState<Phase>(deduction.processedText ? 'sent' : 'input')
  const [words, setWords] = useState<MaskWord[]>([])
  /** 전송본 확인란 — 원문·가릴 단어가 바뀌면 해제한다(08 2절 6) */
  const [reviewChecked, setReviewChecked] = useState(false)
  const [refsOpen, setRefsOpen] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [slow, setSlow] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clauseOpen, setClauseOpen] = useState(deduction.clauseText.trim() !== '')
  const [nextOpen, setNextOpen] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const sampleRan = useRef(false)
  const resultRef = useRef<HTMLElement>(null)
  const reviewRef = useRef<HTMLElement>(null)
  const reviewTitleRef = useRef<HTMLHeadingElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const clauseRef = useRef<HTMLTextAreaElement>(null)

  const hasResult = deduction.source !== null
  const loading = status === 'loading'
  const overLimit = draft.length > MAX_TEXT
  const reviewOpen = phase !== 'input'
  // 1 붙여넣기 → 2 전송본 확인 → 3 확인·선택 → 4 문의 문자(체크한 항목이 생기면) → 5 다음 단계(열어 보면)
  const step = !hasResult ? (phase === 'review' ? 2 : 1) : nextOpen ? 5 : selected.length > 0 ? 4 : 3

  // 전송본(처리본): 원문·가릴 단어가 바뀌면 이 기기에서 즉시 다시 치환한다.
  // 치환 중 예외가 나면 masked 가 null 이 되어 확인 버튼이 잠기고(전송 차단), 패널이 실패 안내를 보여 준다.
  const review = useMemo<{ masked: MaskResult | null; failed: boolean }>(() => {
    if (phase !== 'review') return { masked: null, failed: false }
    try {
      return { masked: maskText(draft, words), failed: false }
    } catch {
      return { masked: null, failed: true }
    }
  }, [phase, draft, words])
  const masked = review.masked

  // 참고 자료 상시 블록: 체크한 항목의 이름과 키워드가 맞는 자료(공통 자료 포함). 맞는 게 없으면 전체 자료
  const refScope = useMemo(() => {
    const names = selected.map((it) => it.name.trim()).filter(Boolean)
    const seen = new Set<string>()
    const refs: Reference[] = []
    let matched = false
    for (const n of names) {
      for (const r of findReferences(n)) {
        if (!r.common) matched = true
        if (!seen.has(r.id)) {
          seen.add(r.id)
          refs.push(r)
        }
      }
    }
    return matched ? { matched: true, names, refs } : { matched: false, names, refs: REFERENCES }
  }, [selected])
  const blockReason = review.failed
    ? null
    : !draft.trim()
      ? '공제 내용을 붙여 넣어 주세요.'
      : overLimit
        ? '3,000자까지 붙여 넣을 수 있어요.'
        : masked && masked.text.length > MAX_TEXT
          ? '가린 뒤 글이 3,000자를 넘어요. 원문을 줄여 주세요.'
          : null
  const canConfirm = !loading && masked !== null && blockReason === null && reviewChecked

  const focusReview = () => {
    window.setTimeout(() => {
      scrollToEl(reviewRef.current)
      reviewTitleRef.current?.focus({ preventScroll: true })
    }, 60)
  }

  /** [정리하기]: 바로 보내지 않고 "전송본 확인" 패널을 연다 */
  const openReview = () => {
    if (!draft.trim()) {
      setInputError('공제 내용을 붙여 넣어 주세요.')
      return
    }
    if (draft.length > MAX_TEXT) {
      setInputError('3,000자까지 붙여 넣을 수 있어요.')
      return
    }
    setInputError(null)
    setErrorMsg(null)
    if (status === 'error') setStatus('idle')
    setReviewChecked(false)
    setPhase('review')
    focusReview()
  }

  /**
   * 확인한 전송본(처리본)만 서버로 보낸다. 이 함수가 extractItems 의 유일한 호출처이고,
   * extractItems 는 maskText 가 만든 ProcessedText 만 받으므로 원문이 서버로 가는 경로가 코드상 없다.
   */
  const send = async (m: MaskResult, raw: string) => {
    if (!m.text.trim()) {
      setInputError('공제 내용을 붙여 넣어 주세요.')
      return
    }
    if (m.text.length > MAX_TEXT) {
      setErrorMsg('가린 뒤 글이 3,000자를 넘어요. 원문을 줄여 주세요.')
      setStatus('error')
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let timedOut = false
    setInputError(null)
    setErrorMsg(null)
    setDoneMsg(null)
    setSlow(false)
    setStatus('loading')
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_MS)
    const abortTimer = window.setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, ABORT_MS)
    try {
      const res = await extractItems(m.text, ctrl.signal)
      if (abortRef.current !== ctrl) return
      const sum = res.items.reduce((acc, it) => acc + (typeof it.amount === 'number' ? it.amount : 0), 0)
      setDeduction({
        rawText: raw,
        processedText: m.text,
        maskSummary: summarizeMask(m.counts),
        items: res.items,
        statedTotal: res.statedTotal,
        source: res.source,
      })
      setEditingId(null)
      setStatus('idle')
      setPhase('sent')
      setDoneMsg(
        res.items.length > 0
          ? `${res.items.length}개 항목을 정리했어요. 공제 합계 ${won(sum)}`
          : '공제 항목을 찾지 못했어요. 행 추가로 직접 적을 수 있어요.',
      )
      window.setTimeout(() => scrollToEl(resultRef.current), 80)
    } catch (e) {
      if (abortRef.current !== ctrl) return
      const msg = timedOut
        ? 'AI 응답이 너무 늦어 요청을 멈췄어요. 다시 시도하거나 직접 입력해 주세요.'
        : e instanceof ApiFailure
          ? e.message
          : '정리하지 못했어요. 다시 시도하거나 직접 입력해 주세요.'
      setErrorMsg(msg)
      setStatus('error')
    } finally {
      window.clearTimeout(slowTimer)
      window.clearTimeout(abortTimer)
      if (abortRef.current === ctrl) abortRef.current = null
      setSlow(false)
    }
  }

  /** [다시 시도]: 지금 화면에 보이는 전송본을 다시 보낸다 */
  const retry = () => {
    if (masked) void send(masked, draft)
  }

  // [예시로 해보기]: 예시 메시지를 넣고 전송본 확인을 연다(StrictMode 중복 실행 방지).
  // ?sample=1&auto=1 은 우리 자동 점검용 — 확인을 자동 통과하지만 그래도 처리본만 보낸다.
  useEffect(() => {
    if (!sample || sampleRan.current) return
    sampleRan.current = true
    const auto = hashQuery().get('auto') === '1'
    setDraft(SAMPLE_TEXT)
    setWords([])
    setInputError(null)
    setPhase('review')
    if (auto) {
      try {
        void send(maskText(SAMPLE_TEXT), SAMPLE_TEXT)
      } catch {
        // 치환 실패: review 패널이 실패 안내를 보여 주고 전송은 막힌다
      }
    } else {
      focusReview()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample])

  const startManual = () => {
    abortRef.current?.abort()
    abortRef.current = null
    const row = newManualItem()
    // 직접 입력은 서버로 아무것도 보내지 않으므로 처리본이 없다
    setDeduction({ rawText: draft, processedText: undefined, maskSummary: undefined, items: [row], statedTotal: null, source: 'manual' })
    setEditingId(row.id)
    setErrorMsg(null)
    setDoneMsg(null)
    setStatus('idle')
    setPhase('input')
    window.setTimeout(() => scrollToEl(resultRef.current), 80)
  }

  /** [AI 없이 직접 입력]: 서버·AI로 아무것도 보내지 않고 빈 표에서 시작한다(국외 이전을 원하지 않을 때) */
  const startNoAI = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setDeduction({ rawText: draft, processedText: undefined, maskSummary: undefined, items: [], statedTotal: null, source: 'manual' })
    setEditingId(null)
    setInputError(null)
    setErrorMsg(null)
    setStatus('idle')
    setPhase('input')
    setReviewChecked(false)
    setDoneMsg('AI 없이 빈 표로 시작했어요. 서버로는 아무것도 보내지 않았어요. 행 추가로 항목을 적어 주세요.')
    window.setTimeout(() => scrollToEl(resultRef.current), 80)
  }

  const restart = () => {
    abortRef.current?.abort()
    abortRef.current = null
    resetDeduction()
    setDraft('')
    setWords([])
    setReviewChecked(false)
    setPhase('input')
    setStatus('idle')
    setSlow(false)
    setInputError(null)
    setErrorMsg(null)
    setDoneMsg(null)
    setEditingId(null)
    setClauseOpen(false)
    setNextOpen(false)
    setResetKey((k) => k + 1)
    if (sample) go('deduct')
    window.scrollTo(0, 0)
  }

  /** [원문 고치기]: 패널을 닫고 입력칸으로 돌아간다(다시 정리하기를 눌러야 전송본 확인이 열린다) */
  const editRaw = () => {
    setPhase('input')
    setErrorMsg(null)
    if (status === 'error') setStatus('idle')
    window.setTimeout(() => {
      scrollToEl(textareaRef.current, 'center')
      textareaRef.current?.focus({ preventScroll: true })
    }, 30)
  }

  const addWord = (w: string, kind: WordKind) => {
    const t = w.trim()
    if (!t || words.some((x) => x.text === t)) return
    setWords((prev) => [...prev, { text: t, kind }])
    setReviewChecked(false)
  }
  const removeWord = (w: string) => {
    setWords((prev) => prev.filter((x) => x.text !== w))
    setReviewChecked(false)
  }

  const openClause = () => {
    setClauseOpen(true)
    window.setTimeout(() => clauseRef.current?.focus(), 30)
  }

  return (
    <section className="dd" key={resetKey}>
      <div className="dd-top">
        <h1>공제 내역 정리</h1>
        <button type="button" className="btn ghost dd-btn" onClick={restart}>
          처음부터
        </button>
      </div>
      <p className="small muted dd-top-note">체험 데이터는 이 화면에서만 쓰여요. 새로고침하면 처음 상태로 돌아가요.</p>

      <Stepper current={step} reviewOpen={reviewOpen} hasResult={hasResult} />

      {/* 1) 입력 */}
      <section className="dd-section card" aria-labelledby="dd-step1">
        <h2 id="dd-step1" className="dd-step-title">
          <b>1</b> 공제 메시지 붙여 넣기
        </h2>
        <p className="dd-guide">붙여 넣은 글은 바로 보내지 않아요. 다음 단계에서 이 기기 안에서 개인정보를 가린 전송본을 확인한 뒤에만 보내요.</p>
        <p className="small muted dd-guide-sub">
          전화번호·계좌번호·주민등록번호·이메일은 자동으로 가려요(기기 내 개인정보 제거). 이름·주소처럼 자동으로 못 찾는 말은 전송본 확인에서 가릴 단어로 추가해 주세요.
        </p>
        <textarea
          ref={textareaRef}
          className={`dd-textarea${overLimit ? ' over' : ''}`}
          aria-label="공제 메시지"
          rows={6}
          value={draft}
          placeholder="예: 퇴실 정산입니다. 청소비 15만원, 도배 30만원… 총 78만원을 공제하려고 합니다."
          onChange={(e) => {
            setDraft(e.target.value)
            setInputError(null)
            setReviewChecked(false)
          }}
        />
        <div className="dd-input-foot">
          <span className={`small dd-counter ${overLimit ? 'dd-error' : 'muted'}`}>
            {draft.length.toLocaleString('ko-KR')} / {MAX_TEXT.toLocaleString('ko-KR')}자
          </span>
          <div className="dd-input-actions">
            <button type="button" className="btn" disabled={loading} onClick={startNoAI}>
              AI 없이 직접 입력
            </button>
            <button type="button" className="btn primary" disabled={loading} onClick={openReview} aria-describedby="dd-send-note">
              정리하기
            </button>
          </div>
        </div>
        <p id="dd-send-note" className="small muted dd-send-note">
          개인정보를 가린 처리본만 OpenAI(미국)로 보내요. 보내기 전에 전송본을 보여 드려요. 보내고 싶지 않으면 [AI 없이 직접 입력]으로 빈 표에서 시작할
          수 있어요(서버로 보내지 않음).
        </p>
        {inputError && (
          <p className="dd-hint" role="alert">
            {inputError}
          </p>
        )}
      </section>

      {/* 2) 전송본 확인 — 기기 내 개인정보 제거 (FR-01) */}
      {/* AI 없이 직접 입력을 골랐을 때의 상태 알림 — 입력 단계에서 늘 자리를 지키는 live 영역 */}
      {!reviewOpen && (
        <div className={`dd-live${doneMsg ? ' is-done' : ''}`} role="status" aria-live="polite">
          {hasResult && deduction.source === 'manual' && doneMsg && (
            <>
              <IconCheck size={18} strokeWidth="2.5" />
              <span>{doneMsg}</span>
            </>
          )}
        </div>
      )}

      {reviewOpen && (
        <section className="dd-section card dd-review-section" ref={reviewRef} aria-labelledby="dd-step2">
          <h2 id="dd-step2" ref={reviewTitleRef} tabIndex={-1} className="dd-step-title">
            <b>2</b> 전송본 확인
          </h2>
          {phase === 'review' ? (
            <ReviewPanel
              masked={masked}
              failed={review.failed}
              words={words}
              checked={reviewChecked}
              onCheck={setReviewChecked}
              blockReason={blockReason}
              canConfirm={canConfirm}
              busy={loading}
              onAddWord={addWord}
              onRemoveWord={removeWord}
              onConfirm={() => {
                if (masked) void send(masked, draft)
              }}
              onEditRaw={editRaw}
            />
          ) : (
            <SentPanel text={deduction.processedText ?? ''} summary={deduction.maskSummary ?? ''} />
          )}

          {/* 상태 알림: 패널이 열릴 때부터 자리를 지키는 live 영역 — 정리 중 / 정리 끝(개수·합계) */}
          <div className={`dd-live${!loading && doneMsg ? ' is-done' : ''}`} role="status" aria-live="polite">
            {loading && (
              <>
                <span className="dd-spinner" aria-hidden="true" />
                <span>정리하는 중…</span>
                {slow && <span className="small muted">AI 응답이 늦어지고 있어요. 조금만 기다려 주세요.</span>}
              </>
            )}
            {!loading && doneMsg && (
              <>
                <IconCheck size={18} strokeWidth="2.5" />
                <span>{doneMsg}</span>
              </>
            )}
          </div>
          {status === 'error' && errorMsg && (
            <div className="dd-errorbox" role="alert">
              <p>{errorMsg}</p>
              <p className="small muted">붙여 넣은 글은 그대로 남아 있어요.</p>
              <div className="dd-row-actions">
                <button type="button" className="btn primary" onClick={retry}>
                  다시 시도
                </button>
                <button type="button" className="btn" onClick={startManual}>
                  직접 입력
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 처리 중: 표 자리 스켈레톤 (상태 안내는 위 role="status" 가 맡는다) */}
      {loading && (
        <div className="dd-skeleton card" aria-hidden="true">
          <div className="dd-skel-head">
            <span className="dd-skel dd-skel-chip" />
            <span className="dd-skel dd-skel-title" />
          </div>
          <span className="dd-skel dd-skel-line" />
          <span className="dd-skel dd-skel-line" />
          <span className="dd-skel dd-skel-line short" />
        </div>
      )}

      {hasResult && (
        <>
          <section className="dd-results" ref={resultRef} aria-label="정리 결과">
            {/* 3) 공제 내역 표 + 특약·계약자 */}
            <section className="dd-section card" aria-labelledby="dd-step3">
              <h2 id="dd-step3" className="dd-step-title">
                <b>3</b> 공제 내역 확인하고 물어볼 항목 고르기
              </h2>

              <div className="dd-contract">
                <div className="dd-field">
                  <span className="dd-label">계약서 특약(선택)</span>
                  <div>
                    <button type="button" className="btn dd-btn" onClick={openClause} aria-expanded={clauseOpen}>
                      특약 문구 붙여넣기
                    </button>
                  </div>
                  {clauseOpen && (
                    <textarea
                      ref={clauseRef}
                      className="dd-textarea dd-textarea-sm"
                      aria-label="계약서 특약 문구"
                      rows={3}
                      maxLength={2000}
                      value={deduction.clauseText}
                      placeholder="예: 퇴실 시 청소비는 임차인이 부담한다."
                      onChange={(e) => setDeduction({ clauseText: e.target.value })}
                    />
                  )}
                  <span className="small muted">특약에 청소·도배·장판·원상복구 같은 말이 있으면 해당 항목에 ‘관련 문구 있음’으로 표시해요. 효력·적용 여부는 판단하지 않아요.</span>
                </div>
                <label className="dd-field">
                  <span className="dd-label">계약서상 임차인</span>
                  <select
                    className="dd-input"
                    value={deduction.contractor}
                    onChange={(e) => setDeduction({ contractor: e.target.value as Contractor })}
                  >
                    {CONTRACTOR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="dd-table-head">
                <h3 className="dd-table-title">공제 내역</h3>
                {deduction.source === 'manual' ? (
                  <span className="badge">직접 입력</span>
                ) : (
                  <span className="badge">AI</span>
                )}
                {!deduction.clauseText.trim() && <span className="badge">특약: 아직 확인 안 함</span>}
              </div>
              {deduction.source === 'cache' && (
                <p className="small muted dd-cache">저장된 예시 결과로 보여 드려요(AI 연결 지연)</p>
              )}
              <p className="small muted dd-help">
                항목 이름을 누르면 AI가 본 전송본(처리본)과 참고 자료가 펼쳐져요. 금액을 전송본과 대조한 뒤 확인을 누르면 물어볼 항목으로 체크할 수 있어요.
              </p>

              <ItemTable editingId={editingId} setEditingId={setEditingId} />

              <p className="small muted dd-basis">올리신 자료를 기준으로 정리했어요. 임대인이 다른 자료를 내면 달라질 수 있어요.</p>

              <div className="dd-sums">
                <p className="dd-sum-main">
                  <span>통보된 공제 합계(참고)</span>
                  <strong>{won(itemSum)}</strong>
                </p>
                {deduction.statedTotal !== null && (
                  <p className="small muted dd-sum-sub">메시지에 적힌 총액: {won(deduction.statedTotal)}</p>
                )}
              </div>

              {/* 참고 자료(공개 자료) — 결과 아래 상시 블록. 체크한 항목과 관련된 자료, 없으면 전체 */}
              <div className="dd-refs-block">
                <div className="dd-refs-block-head">
                  <h3 className="dd-table-title" id="dd-refs-title">
                    참고 자료(공개 자료)
                  </h3>
                  <button
                    type="button"
                    className="btn ghost dd-btn"
                    aria-expanded={refsOpen}
                    aria-controls="dd-refs-body"
                    onClick={() => setRefsOpen((v) => !v)}
                  >
                    {refsOpen ? '참고 자료 접기' : '참고 자료 펼치기'}
                  </button>
                </div>
                {refsOpen && (
                  <div id="dd-refs-body">
                    <p className="small muted dd-refs-scope">
                      {refScope.matched
                        ? `체크한 항목(${refScope.names.join(', ')})과 관련된 자료예요.`
                        : selected.length > 0
                          ? '체크한 항목과 바로 연결되는 자료가 없어 전체 자료를 보여 드려요.'
                          : '물어볼 항목을 체크하면 관련 자료만 추려 보여 드려요. 지금은 전체 자료예요.'}
                    </p>
                    <RefCards refs={refScope.refs} heading={null} />
                  </div>
                )}
              </div>
            </section>

            {/* 4) 문의 문자 */}
            <section className="dd-section card" aria-labelledby="dd-step4">
              <h2 id="dd-step4" className="dd-step-title">
                <b>4</b> 근거를 묻는 문의 문자
              </h2>
              <MessageBox key={resetKey} />
            </section>

            {/* 내가 근거를 물어볼 금액 — 하단 고정 */}
            <div className="dd-askbar" aria-live="polite">
              <div className="dd-askbar-main">
                <span className="dd-askbar-label">내가 근거를 물어볼 금액</span>
                <span className="dd-askbar-count">체크한 항목 {selected.length}개</span>
              </div>
              <strong className="dd-askbar-total">{won(askTotal)}</strong>
            </div>
          </section>

          {/* 5) 다음 단계 */}
          <section className="dd-section card" aria-labelledby="dd-step5">
            <h2 id="dd-step5" className="dd-step-title">
              <b>5</b> 다음 단계
            </h2>
            <NextSteps onOpen={() => setNextOpen(true)} />
          </section>
        </>
      )}
    </section>
  )
}
