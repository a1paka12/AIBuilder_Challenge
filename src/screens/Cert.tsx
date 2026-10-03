import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../state'
import { go } from '../router'
import { postMetric } from '../api'
import '../styles/cert.css'

/** 보증금과 관계없는 압박 문구 */
const PRESSURE_RE = /커뮤니티|인터넷|블로그|리뷰|올리겠|세무서|국세청|신고하겠|직장|알리겠|가만두지|각오|고소하겠|사기꾼|씨발|병신|개새/
const PRESSURE_MSG = '보증금과 관계없는 압박 문구는 넣을 수 없어요.'
const BLANK = '＿＿＿'
const PRINT_CLASS = 'print-cert'

type FieldKey =
  | 'landlordName'
  | 'landlordAddr'
  | 'tenantName'
  | 'agentName'
  | 'senderAddr'
  | 'phone'
  | 'propertyAddr'
  | 'startDate'
  | 'endDate'
  | 'deposit'
  | 'returnDate'
  | 'noticeDate'
  | 'replyDue'
  | 'refundAmount'
  | 'bank'
  | 'account'
  | 'holder'
  | 'writtenDate'

type Form = Record<FieldKey, string>

interface FieldDef {
  key: FieldKey
  label: string
  kind: 'text' | 'date' | 'money'
  placeholder?: string
  hint?: string
  autoComplete?: string
}

interface FieldGroup {
  title: string
  fields: FieldDef[]
}

/* 문서 순서대로: 수신 → 발신 → 계약 → (공제 항목) → 반환 요청 → (선택 문단) */
const GROUPS: FieldGroup[] = [
  {
    title: '받는 사람',
    fields: [
      { key: 'landlordName', label: '임대인 이름', kind: 'text', placeholder: '예: 김집주' },
      { key: 'landlordAddr', label: '임대인 주소', kind: 'text', placeholder: '계약서에 적힌 임대인 주소' },
    ],
  },
  {
    title: '보내는 사람',
    fields: [
      { key: 'tenantName', label: '계약자 이름(발신인)', kind: 'text', placeholder: '계약서상 임차인', autoComplete: 'name' },
      { key: 'agentName', label: '대리인 이름(선택)', kind: 'text', placeholder: '비우면 대리 표기를 하지 않아요', hint: '계약자 대신 보내는 경우에만 적어 주세요.' },
      { key: 'senderAddr', label: '발신 주소', kind: 'text', placeholder: '회신을 받을 주소' },
      { key: 'phone', label: '연락처', kind: 'text', placeholder: '010-0000-0000', autoComplete: 'tel' },
    ],
  },
  {
    title: '계약 정보',
    fields: [
      { key: 'propertyAddr', label: '목적물 주소', kind: 'text', placeholder: '방 주소(동·호수까지)' },
      { key: 'startDate', label: '계약 시작일', kind: 'date' },
      { key: 'endDate', label: '계약 종료일', kind: 'date' },
      { key: 'deposit', label: '보증금(원)', kind: 'money', placeholder: '예: 5000000' },
      { key: 'returnDate', label: '열쇠 반납일', kind: 'date' },
      { key: 'noticeDate', label: '공제 통보일', kind: 'date' },
      { key: 'replyDue', label: '회신 기한', kind: 'date', hint: '반환 기한도 같은 날짜로 들어가요.' },
    ],
  },
  {
    title: '반환 요청',
    fields: [
      { key: 'refundAmount', label: '먼저 반환 요청 금액(원)', kind: 'money', placeholder: '물어볼 항목을 뺀 금액' },
      { key: 'bank', label: '은행', kind: 'text', placeholder: '예: 국민은행' },
      { key: 'account', label: '계좌번호', kind: 'text', placeholder: '숫자와 - 만' },
      { key: 'holder', label: '예금주', kind: 'text' },
      { key: 'writtenDate', label: '작성일', kind: 'date' },
    ],
  },
]

interface ManualRow {
  id: string
  name: string
  amount: string
}

function todayISO(): string {
  const d = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const digitsOnly = (s: string) => s.replace(/[^0-9]/g, '')

/** 미리보기 빈칸 — 화면에서는 흐리게, 인쇄에서는 검정 */
const Blank = () => <span className="cert-blank">{BLANK}</span>

function moneyNode(raw: string): ReactNode {
  const d = digitsOnly(raw)
  return d ? Number(d).toLocaleString('ko-KR') : <Blank />
}

function dateNode(iso: string): ReactNode {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : <Blank />
}

const hasPressure = (s: string) => PRESSURE_RE.test(s)
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

let rowSeq = 0
const newRowId = () => `cert-row-${Date.now()}-${rowSeq++}`

/** 번호 배지가 붙은 입력 그룹 */
function Group({ no, title, children }: { no: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="card cert-group">
      <legend>
        <b className="cert-step" aria-hidden="true">
          {no}
        </b>
        <span>{title}</span>
      </legend>
      {children}
    </fieldset>
  )
}

export default function Cert() {
  const { deduction } = useStore()

  const [form, setForm] = useState<Form>(() => ({
    landlordName: '',
    landlordAddr: '',
    tenantName: deduction.myName ?? '',
    agentName: '',
    senderAddr: '',
    phone: '',
    propertyAddr: deduction.place ?? '',
    startDate: '',
    endDate: '',
    deposit: '',
    returnDate: '',
    noticeDate: '',
    replyDue: '',
    refundAmount: '',
    bank: '',
    account: '',
    holder: '',
    writtenDate: todayISO(),
  }))
  const [optDelay, setOptDelay] = useState(false)
  const [optLegal, setOptLegal] = useState(false)
  const [manualRows, setManualRows] = useState<ManualRow[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  const modalBtnRef = useRef<HTMLButtonElement>(null)

  // 공제 정리에서 확인·체크한(금액이 숫자인) 항목만
  const autoItems = useMemo(
    () => deduction.items.filter((it) => it.confirmed && it.selected && typeof it.amount === 'number'),
    [deduction.items],
  )
  const askTotal = autoItems.reduce((s, it) => s + (it.amount ?? 0), 0)
  const manualTotal = manualRows.reduce((s, r) => s + (Number(digitsOnly(r.amount)) || 0), 0)

  const set = (key: FieldKey, value: string) => setForm((f) => ({ ...f, [key]: value }))

  /** 압박 문구가 들어간 칸이면 미리보기에 넣지 않는다 */
  const safe = (s: string) => (s.trim() && !hasPressure(s) ? s.trim() : '')
  const v = (key: FieldKey): ReactNode => safe(form[key]) || <Blank />

  const blockedFields = GROUPS.flatMap((g) => g.fields).filter((f) => f.kind === 'text' && hasPressure(form[f.key]))
  const blockedRows = manualRows.filter((r) => hasPressure(r.name))
  const blocked = blockedFields.length > 0 || blockedRows.length > 0
  const blockedNames = [
    ...blockedFields.map((f) => f.label),
    ...blockedRows.map((r) => `직접 추가 항목 ${manualRows.indexOf(r) + 1}`),
  ]

  // 화면을 떠나면 인쇄 클래스 정리
  useEffect(() => () => cleanupRef.current?.(), [])

  // 모달: 열리면 첫 버튼에 포커스, Esc로 닫기, 닫히면 연 버튼으로 복귀
  useEffect(() => {
    if (!modalOpen) return
    modalBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false)
        openerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen])

  function closeModal() {
    setModalOpen(false)
    openerRef.current?.focus()
  }

  function printCert() {
    setModalOpen(false)
    postMetric('cert_pdf') // 익명 횟수만 집계, 실패해도 인쇄에 영향 없음
    const body = document.body
    const done = () => {
      body.classList.remove(PRINT_CLASS)
      window.removeEventListener('afterprint', done)
      cleanupRef.current = null
    }
    cleanupRef.current = done
    window.setTimeout(() => {
      body.classList.add(PRINT_CLASS)
      window.addEventListener('afterprint', done)
      window.print()
    }, 60)
  }

  function addRow() {
    setManualRows((rows) => [...rows, { id: newRowId(), name: '', amount: '' }])
  }
  function updateRow(id: string, patch: Partial<ManualRow>) {
    setManualRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function removeRow(id: string) {
    setManualRows((rows) => rows.filter((r) => r.id !== id))
  }

  function fillRefundSuggestion() {
    const dep = Number(digitsOnly(form.deposit))
    if (!dep) return
    const rest = Math.max(0, dep - askTotal - manualTotal)
    set('refundAmount', String(rest))
  }

  function jumpToPreview() {
    document.getElementById('cert-preview')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }

  // ── 미리보기 문장 ──────────────────────────────────────────
  const agent = safe(form.agentName)
  const tenant = v('tenantName')
  const previewItems: { key: string; name: ReactNode; amount: ReactNode }[] = [
    ...autoItems.map((it) => ({ key: it.id, name: safe(it.name) || <Blank />, amount: (it.amount ?? 0).toLocaleString('ko-KR') })),
    ...manualRows
      .filter((r) => r.name.trim() || r.amount.trim())
      .map((r) => ({ key: r.id, name: safe(r.name) || <Blank />, amount: moneyNode(r.amount) })),
  ]
  const optional: string[] = []
  if (optDelay) optional.push('반환이 늦어지는 경우 민법에 따른 지연손해금을 청구할 수 있음을 알려 드립니다.')
  if (optLegal) optional.push('기한까지 회신이 없으면 주택임대차분쟁조정위원회 조정 신청 등 법적 절차를 검토하겠습니다.')

  const depositSuggestion = Number(digitsOnly(form.deposit))
    ? Math.max(0, Number(digitsOnly(form.deposit)) - askTotal - manualTotal)
    : null

  function renderField(f: FieldDef): ReactNode {
    const id = `cert-f-${f.key}`
    const errId = `${id}-err`
    const value = form[f.key]
    const bad = f.kind === 'text' && hasPressure(value)
    return (
      <div className="cert-field" key={f.key}>
        <label htmlFor={id}>{f.label}</label>
        {f.kind === 'date' ? (
          <input id={id} type="date" value={value} onChange={(e) => set(f.key, e.target.value)} />
        ) : f.kind === 'money' ? (
          <input
            id={id}
            type="text"
            inputMode="numeric"
            placeholder={f.placeholder}
            value={value ? Number(digitsOnly(value) || '0').toLocaleString('ko-KR') : ''}
            onChange={(e) => set(f.key, digitsOnly(e.target.value))}
          />
        ) : (
          <input
            id={id}
            type="text"
            placeholder={f.placeholder}
            autoComplete={f.autoComplete ?? 'off'}
            value={value}
            aria-invalid={bad}
            aria-describedby={bad ? errId : undefined}
            className={bad ? 'is-bad' : undefined}
            onChange={(e) => set(f.key, e.target.value)}
          />
        )}
        {f.kind === 'text' && (
          /* 항상 렌더링되는 조용한 알림 영역: 내용이 생길 때만 읽어 준다 */
          <p id={errId} className="cert-err" aria-live="polite">
            {bad ? PRESSURE_MSG : ''}
          </p>
        )}
        {f.hint && !bad && <p className="cert-hint">{f.hint}</p>}
        {f.key === 'refundAmount' && depositSuggestion !== null && (
          <p className="cert-hint">
            참고: 보증금 − 물어볼 항목 합계 = <b>{depositSuggestion.toLocaleString('ko-KR')}원</b>{' '}
            <button type="button" className="linklike" onClick={fillRefundSuggestion}>
              이 금액 넣기
            </button>
          </p>
        )}
      </div>
    )
  }

  const renderGroup = (g: FieldGroup, no: number) => (
    <Group no={no} title={g.title} key={g.title}>
      {g.title === '보내는 사람' && deduction.contractor === 'other' && (
        <p className="cert-hint cert-hint-top">계약자가 다른 사람이면 계약자 이름을 발신인으로 적고, 내 이름은 대리인 칸에 적어 주세요.</p>
      )}
      <div className="cert-grid">{g.fields.map(renderField)}</div>
    </Group>
  )

  return (
    <section className="cert">
      <header className="cert-head">
        <div className="cert-head-text">
          <p className="cert-eyebrow">다음 단계 · 선택</p>
          <h1>내용증명 서식</h1>
          <p className="muted">입력하신 내용이 그대로 들어가는 빈칸형 서식이에요. 이 화면은 AI를 쓰지 않아요.</p>
          <p className="muted small">입력값은 이 브라우저 안에서만 쓰이고 서버로 보내지 않아요. 새로고침하면 사라져요.</p>
        </div>
        <button type="button" className="btn ghost cert-jump" onClick={jumpToPreview}>
          미리보기로 이동
        </button>
      </header>

      <div className="cert-layout">
        {/* ── 입력 폼 ── */}
        <div className="cert-form">
          {GROUPS.slice(0, 3).map((g, i) => renderGroup(g, i + 1))}

          <Group no={4} title="물어볼 항목">
            <p className="muted small cert-group-lead">공제 정리에서 확인·체크한 항목이 들어가요.</p>
            {autoItems.length > 0 ? (
              <ul className="cert-auto-list">
                {autoItems.map((it) => (
                  <li key={it.id}>
                    <span>{it.name}</span>
                    <b>{(it.amount ?? 0).toLocaleString('ko-KR')}원</b>
                  </li>
                ))}
                <li className="cert-auto-total">
                  <span>합계</span>
                  <b>{askTotal.toLocaleString('ko-KR')}원</b>
                </li>
              </ul>
            ) : (
              <div className="cert-empty">
                <p>공제 정리에서 물어볼 항목을 먼저 체크해 주세요.</p>
                <button type="button" className="btn primary" onClick={() => go('deduct')}>
                  공제 내역 정리하기
                </button>
                <p className="muted small">또는 아래에서 항목을 직접 추가할 수 있어요.</p>
              </div>
            )}

            {manualRows.length > 0 && (
              <div className="cert-manual">
                {manualRows.map((r, i) => {
                  const bad = hasPressure(r.name)
                  const errId = `${r.id}-err`
                  return (
                    <div className="cert-manual-row" key={r.id}>
                      <div className="cert-manual-inputs">
                        <input
                          type="text"
                          aria-label={`직접 추가 항목 ${i + 1} 이름`}
                          placeholder="항목명"
                          value={r.name}
                          className={bad ? 'is-bad' : undefined}
                          aria-invalid={bad}
                          aria-describedby={bad ? errId : undefined}
                          onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          aria-label={`직접 추가 항목 ${i + 1} 금액(원)`}
                          placeholder="금액(원)"
                          value={r.amount ? Number(digitsOnly(r.amount) || '0').toLocaleString('ko-KR') : ''}
                          onChange={(e) => updateRow(r.id, { amount: digitsOnly(e.target.value) })}
                        />
                        <button type="button" className="btn ghost cert-del" onClick={() => removeRow(r.id)}>
                          삭제
                        </button>
                      </div>
                      <p id={errId} className="cert-err" aria-live="polite">
                        {bad ? PRESSURE_MSG : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
            <button type="button" className="btn cert-add" onClick={addRow}>
              항목 직접 추가
            </button>
          </Group>

          {renderGroup(GROUPS[3], 5)}

          <Group no={6} title="선택 문단">
            <label className="cert-check">
              <input type="checkbox" checked={optDelay} onChange={(e) => setOptDelay(e.target.checked)} />
              <span>선택 문단: 지연손해금 고지</span>
            </label>
            <label className="cert-check">
              <input type="checkbox" checked={optLegal} onChange={(e) => setOptLegal(e.target.checked)} />
              <span>선택 문단: 법적 절차 고지</span>
            </label>
          </Group>
        </div>

        {/* ── 실시간 미리보기 ── */}
        <div className="cert-preview-col" id="cert-preview">
          <div className="cert-preview-bar">
            <div className="cert-preview-tags">
              <span className="badge">실시간 미리보기</span>
              <span className="badge ok">AI 미사용</span>
            </div>
            <button ref={openerRef} type="button" className="btn primary" disabled={blocked} onClick={() => setModalOpen(true)}>
              PDF 받기
            </button>
          </div>
          {blocked && (
            <div className="cert-block">
              <p>{PRESSURE_MSG} 해당 칸을 고치면 PDF를 받을 수 있어요.</p>
              <p className="small">고칠 칸: {blockedNames.join(', ')}</p>
            </div>
          )}

          <div className="cert-desk">
            <article id="cert-print" className="cert-paper" aria-label="내용증명 미리보기">
              <h2 className="cert-title">임대차보증금 반환 및 공제 근거 요청</h2>

              <dl className="cert-parties">
                <div>
                  <dt>수신</dt>
                  <dd>
                    임대인 {v('landlordName')} / {v('landlordAddr')}
                  </dd>
                </div>
                <div>
                  <dt>발신</dt>
                  <dd>
                    임차인 {tenant}
                    {agent ? ` (대리인 ${agent})` : ''} / {v('senderAddr')} / {v('phone')}
                  </dd>
                </div>
              </dl>

              <ol className="cert-body">
                <li>
                  <span className="cert-no">1.</span> 임대차 목적물: {v('propertyAddr')}
                </li>
                <li>
                  <span className="cert-no">2.</span> 계약 기간: {dateNode(form.startDate)} ~ {dateNode(form.endDate)} / 보증금:{' '}
                  {moneyNode(form.deposit)}원
                </li>
                <li>
                  <span className="cert-no">3.</span> 목적물 반환일(열쇠 반납일): {dateNode(form.returnDate)}
                </li>
                <li>
                  <span className="cert-no">4.</span> 귀하가 {dateNode(form.noticeDate)}에 알려 주신 공제 내역 중 아래 항목의 공제 근거(사진,
                  견적서, 영수증 등)를 {dateNode(form.replyDue)}까지 알려 주시기 바랍니다.
                  <ul className="cert-item-lines">
                    {previewItems.length > 0 ? (
                      previewItems.map((it) => (
                        <li key={it.key}>
                          - {it.name} {it.amount}원
                        </li>
                      ))
                    ) : (
                      <li>
                        - <Blank /> <Blank />원
                      </li>
                    )}
                  </ul>
                </li>
                <li>
                  <span className="cert-no">5.</span> 위 항목을 제외한 보증금 {moneyNode(form.refundAmount)}원은 {dateNode(form.replyDue)}까지
                  아래 계좌로 반환해 주시기 바랍니다.
                  <p className="cert-account">
                    {v('bank')} {v('account')} {v('holder')}
                  </p>
                </li>
                {optional.map((text, i) => (
                  <li key={text}>
                    <span className="cert-no">{6 + i}.</span> {text}
                  </li>
                ))}
              </ol>

              <p className="cert-date">{dateNode(form.writtenDate)}</p>
              <p className="cert-sign">
                발신인 {tenant}
                {agent ? ` 대리인 ${agent}` : ''} (서명)
              </p>
            </article>
          </div>
          <p className="muted small cert-note">
            보증금 지킴이는 입력하신 내용을 서식에 채워 넣을 뿐, 내용이 맞는지 판단하지 않아요. 보내기 전에 날짜·금액·계좌를 다시 확인해 주세요.
          </p>
        </div>
      </div>

      <footer className="cert-foot card">
        <p>
          <a href="https://www.epost.go.kr" target="_blank" rel="noreferrer">
            인터넷우체국(epost.go.kr)
          </a>{' '}
          내용증명으로 보낼 수 있어요.
        </p>
        <p>법률 검토가 필요하면 무료 상담 기관을 이용하세요.</p>
        <ul className="cert-links">
          <li>
            <a href="https://www.klac.or.kr" target="_blank" rel="noreferrer">
              대한법률구조공단 132
            </a>
          </li>
          <li>
            <a href="https://www.hldcc.or.kr" target="_blank" rel="noreferrer">
              주택임대차분쟁조정위원회
            </a>
          </li>
          <li>
            <a href="https://legal.seoul.go.kr" target="_blank" rel="noreferrer">
              서울시 마을변호사
            </a>
          </li>
          <li>
            <a href="https://legalcc.kookmin.ac.kr" target="_blank" rel="noreferrer">
              국민대 법률상담센터
            </a>{' '}
            <span className="muted small">(법학관 1층 105호, 평일 10:00~16:00 · 방문 전 전화 확인 02-910-6397)</span>
          </li>
          <li>
            <a href="https://www.koreanbar.or.kr" target="_blank" rel="noreferrer">
              대한변협 변호사 검색 공식 홈페이지
            </a>
          </li>
        </ul>
        <p className="muted small">보증금 지킴이는 사건 정보를 다른 곳에 보내지 않아요.</p>
      </footer>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="modal cert-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cert-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cert-modal-title">PDF 받기</h2>
            <p>결제는 아직 연결하지 않았어요. 데모에서는 무료로 받을 수 있어요.</p>
            <p className="cert-price">
              <span className="badge warn">가격 가설</span> 내용증명 서식 PDF · 건당 2,900원(가격 가설)
            </p>
            <p className="muted small">인쇄 창에서 "PDF로 저장"을 고르면 파일로 저장돼요.</p>
            <div className="cert-modal-actions">
              <button ref={modalBtnRef} type="button" className="btn primary" onClick={printCert}>
                데모로 받기
              </button>
              <button type="button" className="btn" onClick={closeModal}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
