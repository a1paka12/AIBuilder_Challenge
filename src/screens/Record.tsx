// 방 상태 기록 · 기록북 (PRD FR-04) + 사진의 기기 내 개인정보 제거·전송본 확인 (PRD FR-01 사진 부분)
import { useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { useStore } from '../state'
import { go } from '../router'
import { ApiFailure, createReceipt, formatKST, postMetric } from '../api'
import type { DateSource, Phase, RoomPhoto, Zone } from '../types'
import { readExifDate } from '../lib/exif'
import { maskableType } from '../lib/imageMask'
import { usePromoUnlocked } from '../lib/promo'
import MaskEditor, { type ConfirmedTransfer } from '../components/record/MaskEditor'
import { useModalA11y } from '../components/record/useModalA11y'
import '../styles/record.css'

const ZONES: Zone[] = ['벽', '바닥', '욕실', '주방', '창문/문', '옵션 가전', '기타']
const PHASES: Phase[] = ['입주', '퇴실']
const FREE_LIMIT = 2
/** 출시 기념 이벤트 혜택의 범위 — 기록북 상품(가격 안내: 사진 30장)과 같게 */
const PROMO_LIMIT = 30
const PROMO_LIMIT_MSG = `기록북 범위(${PROMO_LIMIT}장)까지예요. 더 넣으려면 사진을 지운 뒤 추가해 주세요.`
const BOOK_PRICE = '4,900원'
const PRINT_CLASS = 'print-book'
const DATE_LABEL: { [K in DateSource]: string } = {
  exif: '원본 사진 정보상 날짜',
  manual: '직접 입력',
  none: '미입력',
}
const RECEIPT_NOTE = '서버 기록은 그 시각에 이 처리본 파일의 지문이 서버에 남았다는 뜻이에요. 촬영 시각이나 법적 효력을 보장하지 않아요.'
const MASK_NOTE = '사진은 기기 안에서 개인정보를 가리고 메타데이터를 제거한 처리본이에요. 원본은 서버로 보내지 않았어요.'

// 화면을 벗어났다 돌아와도 이번 접속 동안은 데모 해제를 유지한다(새로고침하면 처음 상태)
let demoUnlockedSession = false

const pad = (n: number) => String(n).padStart(2, '0')
function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
const toInputValue = (date: string | null) => (date ? date.replace(' ', 'T') : '')
const receiptText = (p: RoomPhoto) =>
  p.receipt ? `서버 기록 · ${formatKST(p.receipt.receivedAt)} · 지문 ${p.sha256.slice(0, 8)}` : null
/** 개인정보 가림 배지 문구 — 처리본만 기록북에 쓴다 */
const maskText = (p: RoomPhoto) =>
  p.masked ? ((p.maskCount ?? 0) > 0 ? `개인정보 가림 · 메타데이터 제거` : '메타데이터 제거 · 가린 곳 없음') : null
/** 같은 이름 버튼이 반복되므로 대상 이름을 붙인다 */
const photoName = (p: RoomPhoto, i: number) => `${p.zone} ${p.phase} 사진 ${i + 1}`

/* 선 아이콘 — 장식이라 스크린리더에는 숨긴다 (기관 로고·문장처럼 보이지 않게 선만 사용) */
const ICON = {
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 10.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  check: 'M20 6L9 17l-5-5',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  book: 'M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
}
function Icon({ name, size = 20, stroke = 2 }: { name: keyof typeof ICON; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={ICON[name]} />
    </svg>
  )
}

/* 단계 제목: 번호 원형 배지 (공제 정리 화면과 같은 꼴) */
function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h2 className="rc-step-title">
      <b>{n}</b> {children}
    </h2>
  )
}

/* 3장째 안내 — 가격 가설(결제 미연결)과 무료 체험을 구분해 보여 준다 */
function LimitDialog({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const { dialogRef, onKeyDown } = useModalA11y<HTMLDivElement>(onClose, titleRef)
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} className="modal record-modal" role="dialog" aria-modal="true" aria-labelledby="limit-title" aria-describedby="limit-desc" onKeyDown={onKeyDown}>
        <h2 id="limit-title" ref={titleRef} tabIndex={-1}>
          무료 체험은 사진 {FREE_LIMIT}장까지예요
        </h2>
        <p id="limit-desc" className="rc-limit-desc">
          <span className="badge warn">가격 가설</span> 3장째부터는 기록북 상품 <b className="num">{BOOK_PRICE}</b>(방 1개·이사 1건)으로 제안하려고 해요. 결제는 아직 연결하지
          않았고, 대회 기간에는 데모로 계속 체험할 수 있어요.
        </p>
        <div className="record-modal-actions">
          <button type="button" className="btn" onClick={() => go('pricing')}>
            가격 안내
          </button>
          <button type="button" className="btn primary" onClick={onContinue}>
            데모로 계속
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

interface PendingPhoto {
  file: File
  /** 원본에서 브라우저 안에서 먼저 읽은 촬영 날짜 (처리본에는 메타데이터가 없다) */
  exifDate: string | null
  zone: Zone
  phase: Phase
}

export default function RecordScreen() {
  const { photos, setPhotos, roomNickname, setRoomNickname } = useStore()
  const promo = usePromoUnlocked()
  const [zone, setZone] = useState<Zone>('벽')
  const [phase, setPhase] = useState<Phase>('입주')
  const [unlocked, setUnlocked] = useState(demoUnlockedSession)
  const [limitOpen, setLimitOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPhoto | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState<{ [id: string]: boolean }>({})
  const [errors, setErrors] = useState<{ [id: string]: string }>({})
  const [showPreview, setShowPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const openPicker = () => fileRef.current?.click()
  const noLimit = unlocked || promo
  const limitReached = photos.length >= FREE_LIMIT && !noLimit
  const promoCapReached = promo && photos.length >= PROMO_LIMIT

  const onAddClick = () => {
    if (adding || pending) return
    setAddError(null)
    if (promoCapReached) {
      setAddError(PROMO_LIMIT_MSG)
      return
    }
    if (limitReached) {
      setLimitOpen(true)
      return
    }
    openPicker()
  }

  const continueDemo = () => {
    demoUnlockedSession = true
    setUnlocked(true)
    setLimitOpen(false)
    openPicker()
  }

  // 1) 사진 선택 → JPEG·PNG 확인 → 원본에서 촬영 날짜만 브라우저 안에서 읽기 → 개인정보 가리기 대화상자
  const addFile = async (file: File) => {
    if (!maskableType(file)) {
      setAddError('JPEG·PNG 사진만 가릴 수 있어요. HEIC·WebP 등은 사진 앱에서 JPEG로 저장한 뒤 올려 주세요. 서버로 보낸 것은 없어요.')
      return
    }
    setAdding(true)
    setAddError(null)
    setStatus('')
    try {
      const exifDate = await readExifDate(file)
      setPending({ file, exifDate, zone, phase })
    } catch {
      setAddError('사진을 불러오지 못했어요. 다른 사진으로 다시 시도해 주세요. 서버로 보낸 것은 없어요.')
    } finally {
      setAdding(false)
    }
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void addFile(file)
  }

  // 데스크톱에서 점선 영역에 끌어다 놓기 — 2장 무료 체험 문턱은 [사진 추가]와 똑같이 적용
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!dragging) setDragging(true)
  }
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
    setDragging(false)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (!file || adding || pending) return
    setAddError(null)
    if (promoCapReached) {
      setAddError(PROMO_LIMIT_MSG)
      return
    }
    if (limitReached) {
      setLimitOpen(true)
      return
    }
    void addFile(file)
  }

  const updatePhoto = (id: string, patch: Partial<RoomPhoto>) =>
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const removePhoto = (p: RoomPhoto) => {
    URL.revokeObjectURL(p.url)
    setPhotos((prev) => prev.filter((x) => x.id !== p.id))
  }

  const onDateChange = (p: RoomPhoto, value: string) => {
    if (value) updatePhoto(p.id, { date: value.replace('T', ' ').slice(0, 16), dateSource: 'manual' })
    else updatePhoto(p.id, { date: null, dateSource: 'none' })
  }

  // 서버로 가는 유일한 경로 — 처리본의 지문(SHA-256) 64자만. 사진 파일은 보내지 않는다.
  const recordReceipt = async (p: RoomPhoto) => {
    setBusy((b) => ({ ...b, [p.id]: true }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[p.id]
      return next
    })
    try {
      const receipt = await createReceipt(p.sha256)
      updatePhoto(p.id, { receipt })
    } catch (err) {
      const msg = err instanceof ApiFailure ? err.message : '잠시 후 다시 시도해 주세요.'
      setErrors((prev) => ({ ...prev, [p.id]: `서버 기록을 남기지 못했어요. ${msg}` }))
    } finally {
      setBusy((b) => ({ ...b, [p.id]: false }))
    }
  }

  // 2)~4) 가리기·처리본·전송본 확인은 MaskEditor 안에서. [확인하고 기록하기] 를 눌렀을 때만 여기로 온다.
  //      → 기록북에는 처리본(object URL)만 넣고, 그제야 처리본 지문을 서버에 기록한다.
  const onMaskConfirm = (r: ConfirmedTransfer) => {
    const p = pending
    if (!p) return
    const photo: RoomPhoto = {
      id: newId(),
      zone: p.zone,
      phase: p.phase,
      url: r.url,
      // 원본 파일명은 화면·기록북·서버 어디에도 쓰지 않는다 (임의 ID만)
      fileName: `photo-${newId().slice(0, 8)}`,
      sha256: r.sha256,
      memo: '',
      date: p.exifDate,
      dateSource: p.exifDate ? 'exif' : 'none',
      receipt: null,
      masked: true,
      maskCount: r.maskCount,
    }
    setPending(null)
    setPhotos((prev) => [...prev, photo])
    setStatus(`${p.zone} ${p.phase} 처리본을 추가했어요 (가림 상자 ${r.maskCount}개 · 메타데이터 제거). 서버에는 지문만 보내요.`)
    void recordReceipt(photo)
  }

  // 취소·Esc·닫기 — 사진 추가 자체를 취소, 아무것도 보내지 않음
  const onMaskCancel = () => {
    setPending(null)
    setStatus('사진 추가를 취소했어요. 서버로 보낸 것은 없어요.')
  }

  const openPreview = () => {
    setShowPreview(true)
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const printBook = () => {
    postMetric('book_pdf')
    document.body.classList.add(PRINT_CLASS)
    const done = () => {
      document.body.classList.remove(PRINT_CLASS)
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }

  const groups = ZONES.map((z) => ({ zone: z, items: photos.filter((p) => p.zone === z) })).filter((g) => g.items.length > 0)
  const roomTitle = roomNickname.trim() || '내 방'
  const usedFree = Math.min(photos.length, FREE_LIMIT)
  const bookStep = groups.length > 0 ? 4 : 3
  const pageCount = groups.length + 1
  const trialText = promo
    ? `이벤트 혜택 적용 중 · 기록북 범위(사진 ${PROMO_LIMIT}장)까지 체험해요 · 지금 ${photos.length}장`
    : unlocked
      ? `데모로 계속 중이에요 · 지금 사진 ${photos.length}장`
      : `사진 ${FREE_LIMIT}장까지 무료 체험이에요 · 지금 ${usedFree}/${FREE_LIMIT}장`

  return (
    <section className="record">
      <header className="rc-head">
        <h1>방 상태 기록</h1>
        <div className="notice rc-notice">
          <p>
            사진은 <b>기기 안에서 개인정보를 가리고 메타데이터를 제거한 처리본</b>만 써요. 서버로는 처리본의 지문(SHA-256) 64자만 가고, 사진 파일은 보내지 않아요.
          </p>
          <p className="muted small">전송본을 확인하기 전이나 처리에 실패하면 아무것도 보내지 않아요. 체험 데이터는 이 화면에서만 쓰여요. 새로고침하면 처음 상태로 돌아가요.</p>
        </div>
      </header>

      <div className="card">
        <StepTitle n={1}>사진 추가 · 개인정보 가리기</StepTitle>

        {/* 무료 체험 안내 — 아래 가격 가설과 시각적으로 구분 (PRD FR-04) */}
        <div className={`rc-trial${photos.length >= FREE_LIMIT && !noLimit ? ' at-limit' : ''}${promo ? ' is-promo' : ''}`}>
          <div className="rc-trial-top">
            <span className="badge ok">무료 체험</span>
            {promo && <span className="badge">이벤트 혜택</span>}
            <span className="rc-trial-count">{noLimit ? `사진 ${photos.length}장` : `${usedFree}/${FREE_LIMIT}장`}</span>
          </div>
          {!promo && (
            <div
              className="rc-meter"
              role="progressbar"
              aria-label={`무료 체험 ${usedFree}/${FREE_LIMIT}장`}
              aria-valuemin={0}
              aria-valuemax={FREE_LIMIT}
              aria-valuenow={usedFree}
              aria-valuetext={`${usedFree}/${FREE_LIMIT}장`}
            >
              <span className="rc-meter-fill" style={{ width: `${(usedFree / FREE_LIMIT) * 100}%` }} />
            </div>
          )}
          <p className="small muted rc-trial-text">{trialText}</p>
        </div>
        <div className="rc-price-hypo" role="note" aria-label="기록북 가격 가설">
          <span className="badge warn">가격 가설</span>
          <p>
            기록북 상품 <b className="num">{BOOK_PRICE}</b> · 방 1개·이사 1건 기준 · 결제는 연결하지 않았어요 (사용 의향만 확인 중)
          </p>
          <button type="button" className="linklike" onClick={() => go('pricing')}>
            가격 안내
          </button>
        </div>

        <div className="rc-fields">
          <fieldset className="rc-fieldset">
            <legend className="rc-legend">구역</legend>
            <div className="rc-chips">
              {ZONES.map((z, i) => (
                <span className="rc-opt" key={z}>
                  <input type="radio" name="zone" id={`zone-${i}`} value={z} checked={zone === z} onChange={() => setZone(z)} />
                  <label htmlFor={`zone-${i}`}>{z}</label>
                </span>
              ))}
            </div>
          </fieldset>

          <fieldset className="rc-fieldset">
            <legend className="rc-legend">단계</legend>
            <div className="rc-seg">
              {PHASES.map((ph, i) => (
                <span className="rc-opt" key={ph}>
                  <input type="radio" name="phase" id={`phase-${i}`} value={ph} checked={phase === ph} onChange={() => setPhase(ph)} />
                  <label htmlFor={`phase-${i}`}>{ph}</label>
                </span>
              ))}
            </div>
          </fieldset>

          <div
            className={`rc-drop${dragging ? ' is-dragging' : ''}${adding ? ' is-busy' : ''}`}
            onClick={onAddClick}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <span className="rc-drop-icon">
              <Icon name="camera" size={24} />
            </span>
            {/* disabled 대신 aria-disabled — 불러오는 동안에도 포커스를 잃지 않게 (onAddClick 이 중복 실행을 막는다) */}
            <button
              ref={addBtnRef}
              type="button"
              className="btn primary rc-drop-btn"
              onClick={(e) => {
                e.stopPropagation()
                onAddClick()
              }}
              aria-disabled={adding || pending !== null}
              aria-busy={adding}
            >
              {adding && <span className="rc-spin" aria-hidden="true" />}
              {adding ? '사진 불러오는 중…' : '사진 추가'}
            </button>
            <span className="muted small">
              {zone} · {phase} 사진으로 추가돼요 · JPEG·PNG
            </span>
            <span className="rc-drop-flow">
              <Icon name="shield" size={14} />
              추가하면 바로 <b>개인정보 가리기 → 처리본 만들기 → 전송본 확인</b> 순서로 진행돼요
            </span>
            <input ref={fileRef} className="record-file" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={onFile} tabIndex={-1} aria-hidden="true" />
          </div>
          {addError && (
            <p className="error-text" role="alert">
              {addError}
            </p>
          )}
          <p className="rc-status" role="status" aria-live="polite">
            {status}
          </p>
        </div>
      </div>

      <div className="card">
        <StepTitle n={2}>구역별 사진</StepTitle>
        <p className="muted small rc-note">{RECEIPT_NOTE}</p>
        {groups.length === 0 ? (
          <p className="muted rc-empty">아직 추가한 사진이 없어요. 구역과 단계를 고르고 [사진 추가]를 눌러 주세요.</p>
        ) : (
          groups.map((g) => (
            <div key={g.zone} className="zone-group">
              <h3>{g.zone}</h3>
              <div className="photo-grid">
                {g.items.map((p, i) => {
                  const rText = receiptText(p)
                  const mText = maskText(p)
                  const name = photoName(p, i)
                  return (
                    <article key={p.id} className="card photo-card" aria-label={name}>
                      <figure className="photo-thumb">
                        <img src={p.url} alt={`${name} (개인정보 가림 처리본)`} loading="lazy" />
                      </figure>
                      <div className="photo-body">
                        <div className="photo-badges">
                          <span className="badge">{p.zone}</span>
                          <span className={p.phase === '입주' ? 'badge ok' : 'badge warn'}>{p.phase}</span>
                          <span className="muted small photo-file">처리본 · 사진 {i + 1}</span>
                        </div>
                        {mText && (
                          <div className="photo-mask">
                            <span className="badge ok mask-badge">
                              <Icon name="shield" size={14} stroke={2.4} />
                              {mText}
                            </span>
                            {(p.maskCount ?? 0) > 0 && <span className="muted small">가림 상자 {p.maskCount}개</span>}
                          </div>
                        )}
                        <div className="photo-date">
                          <span className="photo-date-value">{p.date ?? '날짜 없음'}</span>
                          <span className={p.dateSource === 'none' ? 'badge warn' : 'badge'}>{DATE_LABEL[p.dateSource]}</span>
                        </div>
                        <div className="photo-field">
                          <label htmlFor={`date-${p.id}`}>날짜 직접 입력</label>
                          <input
                            id={`date-${p.id}`}
                            className="record-input"
                            type="datetime-local"
                            value={toInputValue(p.date)}
                            onChange={(e) => onDateChange(p, e.target.value)}
                          />
                        </div>
                        <div className="photo-field">
                          <label htmlFor={`memo-${p.id}`}>메모</label>
                          <textarea
                            id={`memo-${p.id}`}
                            className="record-memo"
                            value={p.memo}
                            maxLength={300}
                            placeholder="예: 입주 때부터 있던 벽지 얼룩"
                            onChange={(e) => updatePhoto(p.id, { memo: e.target.value })}
                          />
                        </div>
                        <div className="photo-receipt" aria-live="polite">
                          {rText && (
                            <span className="badge ok receipt-badge">
                              <Icon name="check" size={14} stroke={3} />
                              {rText}
                            </span>
                          )}
                        </div>
                        {errors[p.id] && (
                          <p className="error-text" role="alert">
                            {errors[p.id]}
                          </p>
                        )}
                        <div className="photo-actions">
                          {!p.receipt && (
                            <button type="button" className="btn" aria-label={`${name} 서버 기록 남기기 (지문만)`} onClick={() => recordReceipt(p)} disabled={!!busy[p.id]}>
                              {busy[p.id] ? '기록 남기는 중…' : '서버 기록 남기기'}
                            </button>
                          )}
                          <button type="button" className="btn ghost" aria-label={`${name} 삭제`} onClick={() => removePhoto(p)}>
                            삭제
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {groups.length > 0 && (
        <div className="card">
          <StepTitle n={3}>나란히 보기</StepTitle>
          <div className="compare">
            <div className="compare-head">
              <span className="compare-head-in">입주</span>
              <span className="compare-head-out">퇴실</span>
            </div>
            {groups.map((g) => {
              const moveIn = g.items.filter((p) => p.phase === '입주')
              const moveOut = g.items.filter((p) => p.phase === '퇴실')
              return (
                <div key={g.zone} className="compare-row">
                  <h3>{g.zone}</h3>
                  <div className="compare-cols">
                    <div className={`compare-cell${moveIn.length > 0 ? ' has' : ' none'}`} role="group" aria-label={`${g.zone} 입주`}>
                      {moveIn.length > 0 ? (
                        <div className="compare-thumbs">
                          {moveIn.map((p) => (
                            <img key={p.id} src={p.url} alt={`${g.zone} 입주 사진 (처리본)`} />
                          ))}
                        </div>
                      ) : moveOut.length > 0 ? (
                        <span className="compare-empty">입주 기록 없음</span>
                      ) : null}
                    </div>
                    <div className={`compare-cell${moveOut.length > 0 ? ' has' : ''}`} role="group" aria-label={`${g.zone} 퇴실`}>
                      {moveOut.length > 0 ? (
                        <div className="compare-thumbs">
                          {moveOut.map((p) => (
                            <img key={p.id} src={p.url} alt={`${g.zone} 퇴실 사진 (처리본)`} />
                          ))}
                        </div>
                      ) : (
                        <span className="compare-wait">퇴실 사진을 추가하면 여기에 보여요</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card rc-book-card" ref={previewRef}>
        <StepTitle n={bookStep}>기록북</StepTitle>
        <p className="muted small rc-note">구역별 처리본 사진·메모·서버 기록을 한 문서로 모아 보고 인쇄하거나 PDF로 저장할 수 있어요.</p>
        <div className="rc-book-row">
          <div className="rc-field">
            <label className="record-label" htmlFor="room-nickname">
              방 별칭
            </label>
            <input
              id="room-nickname"
              className="record-input"
              type="text"
              value={roomNickname}
              maxLength={40}
              placeholder="예: 정릉 원룸 302호 (비워 두면 '내 방')"
              onChange={(e) => setRoomNickname(e.target.value)}
            />
          </div>
          <button type="button" className="btn primary" onClick={openPreview}>
            <Icon name="book" size={18} />
            기록북 미리보기
          </button>
        </div>
        {showPreview &&
          (photos.length === 0 ? (
            <p className="muted rc-empty" role="status">
              사진을 먼저 추가해 주세요.
            </p>
          ) : (
            <>
              <div id="book-print" className="book">
                <div className="book-page book-cover">
                  <div className="book-cover-body">
                    <p className="book-room">{roomTitle}</p>
                    <h2>방 상태 기록북</h2>
                    <p className="muted">생성일 {todayYMD()}</p>
                    <p className="muted small">사진 {photos.length}장 · 구역 {groups.length}곳</p>
                  </div>
                  <p className="book-end">
                    이 기록북은 사용자가 남긴 사진과 메모를 정리한 것이에요. 법적 효력이나 진본을 보장하지 않아요.
                    <br />
                    {MASK_NOTE}
                    <br />
                    {RECEIPT_NOTE}
                  </p>
                  <div className="book-foot">
                    <span>{roomTitle} · 방 상태 기록북</span>
                    <span className="book-foot-num">1 / {pageCount}</span>
                  </div>
                </div>
                {groups.map((g, i) => (
                  <section key={g.zone} className="book-page book-section">
                    <h3>{g.zone}</h3>
                    <div className="book-entries">
                      {g.items.map((p, j) => {
                        const rText = receiptText(p)
                        const mText = maskText(p)
                        return (
                          <div key={p.id} className="book-photo">
                            <img src={p.url} alt={`${photoName(p, j)} (개인정보 가림 처리본)`} />
                            <div className="book-meta">
                              <p>
                                <b>단계</b> <span>{p.phase}</span>
                              </p>
                              <p>
                                <b>날짜</b>{' '}
                                <span>
                                  {p.date ?? '날짜 없음'} ({DATE_LABEL[p.dateSource]})
                                </span>
                              </p>
                              <p>
                                <b>메모</b> <span>{p.memo.trim() || '메모 없음'}</span>
                              </p>
                              {mText && (
                                <p>
                                  <b>가림</b> <span>{mText}{(p.maskCount ?? 0) > 0 ? ` (상자 ${p.maskCount}개)` : ''}</span>
                                </p>
                              )}
                              <p className="book-receipt">
                                {rText ? (
                                  <span className="badge ok">
                                    <Icon name="check" size={12} stroke={3} />
                                    {rText}
                                  </span>
                                ) : (
                                  <span className="muted">서버 기록 없음</span>
                                )}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="book-foot">
                      <span>{roomTitle} · 방 상태 기록북</span>
                      <span className="book-foot-num">
                        {i + 2} / {pageCount}
                      </span>
                    </div>
                  </section>
                ))}
              </div>
              <div className="book-actions">
                <button type="button" className="btn primary" onClick={printBook}>
                  <Icon name="download" size={18} />
                  인쇄 / PDF로 저장
                </button>
                <span className="muted small">인쇄 창에서 'PDF로 저장'을 고르면 파일로 저장돼요.</span>
              </div>
            </>
          ))}
      </div>

      {limitOpen && <LimitDialog onClose={() => setLimitOpen(false)} onContinue={continueDemo} />}

      {pending && <MaskEditor file={pending.file} label={`${pending.zone} · ${pending.phase}`} onCancel={onMaskCancel} onConfirm={onMaskConfirm} returnFocusRef={addBtnRef} />}
    </section>
  )
}
