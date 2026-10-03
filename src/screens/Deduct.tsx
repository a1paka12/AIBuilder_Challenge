import { useEffect, useRef, useState } from 'react'
import { useSelection, useStore } from '../state'
import { ApiFailure, MAX_TEXT, SAMPLE_TEXT, extractItems, won } from '../api'
import { go } from '../router'
import type { Contractor } from '../types'
import ItemTable from '../components/deduct/ItemTable'
import MessageBox from '../components/deduct/MessageBox'
import NextSteps from '../components/deduct/NextSteps'
import { newManualItem } from '../components/deduct/newItem'
import '../styles/deduct.css'

type Status = 'idle' | 'loading' | 'error'

const SLOW_MS = 30_000
const ABORT_MS = 45_000

const CONTRACTOR_OPTIONS: { value: Contractor; label: string }[] = [
  { value: 'self', label: '본인' },
  { value: 'other', label: '가족 등 다른 사람' },
  { value: 'unknown', label: '확인 안 함' },
]

export default function Deduct({ sample = false }: { sample?: boolean }) {
  const { deduction, setDeduction, resetDeduction } = useStore()
  const { askTotal, itemSum, selected } = useSelection()

  const [draft, setDraft] = useState(deduction.rawText)
  const [status, setStatus] = useState<Status>('idle')
  const [slow, setSlow] = useState(false)
  const [inputError, setInputError] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clauseOpen, setClauseOpen] = useState(deduction.clauseText.trim() !== '')
  const [resetKey, setResetKey] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const sampleRan = useRef(false)
  const resultRef = useRef<HTMLElement>(null)
  const clauseRef = useRef<HTMLTextAreaElement>(null)

  const hasResult = deduction.source !== null
  const loading = status === 'loading'
  const overLimit = draft.length > MAX_TEXT

  const run = async (text: string) => {
    if (!text.trim()) {
      setInputError('공제 내용을 붙여 넣어 주세요.')
      return
    }
    if (text.length > MAX_TEXT) {
      setInputError('3,000자까지 붙여 넣을 수 있어요.')
      return
    }
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let timedOut = false
    setInputError(null)
    setErrorMsg(null)
    setSlow(false)
    setStatus('loading')
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_MS)
    const abortTimer = window.setTimeout(() => {
      timedOut = true
      ctrl.abort()
    }, ABORT_MS)
    try {
      const res = await extractItems(text, ctrl.signal)
      if (abortRef.current !== ctrl) return
      setDeduction({ rawText: text, items: res.items, statedTotal: res.statedTotal, source: res.source })
      setEditingId(null)
      setStatus('idle')
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
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

  // [예시로 해보기]: 예시 메시지를 넣고 한 번만 자동 정리 (StrictMode 중복 호출 방지)
  useEffect(() => {
    if (!sample || sampleRan.current) return
    sampleRan.current = true
    setDraft(SAMPLE_TEXT)
    void run(SAMPLE_TEXT)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sample])

  const startManual = () => {
    abortRef.current?.abort()
    abortRef.current = null
    const row = newManualItem()
    setDeduction({ rawText: draft, items: [row], statedTotal: null, source: 'manual' })
    setEditingId(row.id)
    setErrorMsg(null)
    setStatus('idle')
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  const restart = () => {
    abortRef.current?.abort()
    abortRef.current = null
    resetDeduction()
    setDraft('')
    setStatus('idle')
    setSlow(false)
    setInputError(null)
    setErrorMsg(null)
    setEditingId(null)
    setClauseOpen(false)
    setResetKey((k) => k + 1)
    if (sample) go('deduct')
    window.scrollTo(0, 0)
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

      {/* 1) 입력 */}
      <section className="dd-section card" aria-labelledby="dd-step1">
        <h2 id="dd-step1" className="dd-step-title">
          <b>1</b> 공제 메시지 붙여 넣기
        </h2>
        <p className="dd-guide">이름·전화번호·계좌번호는 지우고 붙여 넣어 주세요.</p>
        <textarea
          className={`dd-textarea${overLimit ? ' over' : ''}`}
          aria-label="공제 메시지"
          rows={6}
          value={draft}
          placeholder="예: 퇴실 정산입니다. 청소비 15만원, 도배 30만원… 총 78만원을 공제하려고 합니다."
          onChange={(e) => {
            setDraft(e.target.value)
            setInputError(null)
          }}
        />
        <div className="dd-input-meta">
          <span className={`small ${overLimit ? 'dd-error' : 'muted'}`}>
            {draft.length.toLocaleString('ko-KR')} / {MAX_TEXT.toLocaleString('ko-KR')}자
          </span>
        </div>
        <div className="dd-row-actions">
          <button type="button" className="btn primary" disabled={loading} onClick={() => void run(draft)}>
            정리하기
          </button>
        </div>
        {inputError && (
          <p className="dd-hint" role="alert">
            {inputError}
          </p>
        )}
        {loading && (
          <div className="dd-loading" role="status" aria-live="polite">
            <span className="dd-spinner" aria-hidden="true" />
            <span>정리하는 중…</span>
            {slow && <span className="small muted">AI 응답이 늦어지고 있어요. 조금만 기다려 주세요.</span>}
          </div>
        )}
        {status === 'error' && errorMsg && (
          <div className="dd-errorbox" role="alert">
            <p>{errorMsg}</p>
            <p className="small muted">붙여 넣은 글은 그대로 남아 있어요.</p>
            <div className="dd-row-actions">
              <button type="button" className="btn primary" onClick={() => void run(draft)}>
                다시 시도
              </button>
              <button type="button" className="btn" onClick={startManual}>
                직접 입력
              </button>
            </div>
          </div>
        )}
      </section>

      {hasResult && (
        <>
          <section className="dd-results" ref={resultRef} aria-label="정리 결과">
            {/* 2) 공제 내역 표 + 4) 특약·계약자 */}
            <section className="dd-section card" aria-labelledby="dd-step2">
              <h2 id="dd-step2" className="dd-step-title">
                <b>2</b> 공제 내역 확인하고 물어볼 항목 고르기
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
                      className="dd-textarea"
                      aria-label="계약서 특약 문구"
                      rows={3}
                      maxLength={2000}
                      value={deduction.clauseText}
                      placeholder="예: 퇴실 시 청소비는 임차인이 부담한다."
                      onChange={(e) => setDeduction({ clauseText: e.target.value })}
                    />
                  )}
                  <span className="small muted">특약에 청소·도배·장판·원상복구 같은 말이 있으면 해당 항목에 표시해요.</span>
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
                {deduction.source === 'manual' ? (
                  <span className="badge">직접 입력</span>
                ) : (
                  <span className="badge">AI</span>
                )}
                <h3 className="dd-table-title">공제 내역</h3>
                {!deduction.clauseText.trim() && <span className="badge">특약 확인 안 함</span>}
              </div>
              {deduction.source === 'cache' && (
                <p className="small muted dd-cache">저장된 예시 결과로 보여 드려요(AI 연결 지연)</p>
              )}
              <p className="small muted">
                항목 이름을 누르면 원문과 참고 자료가 펼쳐져요. 금액을 원문과 대조한 뒤 확인을 누르면 물어볼 항목으로 체크할 수 있어요.
              </p>

              <ItemTable editingId={editingId} setEditingId={setEditingId} />

              <p className="small muted dd-basis">올리신 자료를 기준으로 정리했어요. 임대인이 다른 자료를 내면 달라질 수 있어요.</p>

              <div className="dd-sums">
                <p className="dd-sum-main">
                  <span>통보된 공제 합계(참고)</span>
                  <strong>{won(itemSum)}</strong>
                </p>
                {deduction.statedTotal !== null && (
                  <p className="small muted">메시지에 적힌 총액: {won(deduction.statedTotal)}</p>
                )}
              </div>
            </section>

            {/* 5) 문의 문자 */}
            <section className="dd-section card" aria-labelledby="dd-step3">
              <h2 id="dd-step3" className="dd-step-title">
                <b>3</b> 근거를 묻는 문의 문자
              </h2>
              <MessageBox key={resetKey} />
            </section>

            {/* 3) 내가 근거를 물어볼 금액 — 하단 고정 */}
            <div className="dd-askbar" aria-live="polite">
              <div>
                <span className="dd-askbar-label">내가 근거를 물어볼 금액</span>
                <span className="small dd-askbar-count">체크한 항목 {selected.length}개</span>
              </div>
              <strong className="dd-askbar-total">{won(askTotal)}</strong>
            </div>
          </section>

          {/* 6) 다음 단계 */}
          <section className="dd-section card" aria-labelledby="dd-step4">
            <h2 id="dd-step4" className="dd-step-title">
              <b>4</b> 다음 단계
            </h2>
            <NextSteps />
          </section>
        </>
      )}
    </section>
  )
}
