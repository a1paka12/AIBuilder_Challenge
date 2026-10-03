// 방 상태 기록 · 기록북 (PRD FR-04) + 사진의 기기 내 개인정보 제거·전송본 확인 (PRD FR-01 사진 부분)
// - 로그아웃: 처리본은 이 기기 메모리에만, 서버에는 지문(SHA-256)만 (/api/receipt)
// - 로그인: 가린 처리본(메타데이터 제거됨)을 내 계정에만 보관 (/api/photos, 처음엔 [필수] 보관 동의). 원본은 어느 쪽이든 보내지 않는다
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { useStore } from '../state'
import { go, hrefOf } from '../router'
import { ApiFailure, createReceipt, formatKST, postMetric } from '../api'
import type { Phase, RoomPhoto, Zone } from '../types'
import { maskableType } from '../lib/imageMask'
import { usePromoUnlocked } from '../lib/promo'
import { refreshMe, TEST_ACCOUNT_NOTICE, useMe, type User } from '../lib/auth'
import {
  RETENTION_TEXT,
  SERVER_LIMIT,
  consentPhotos,
  deletePhoto,
  isLoginError,
  listPhotos,
  photoErrorCode,
  photoErrorText,
  updatePhoto as patchServerPhoto,
  uploadPhoto,
  type ServerPhoto,
} from '../lib/photos'
import MaskEditor, { TransferError, type ConfirmedTransfer } from '../components/record/MaskEditor'
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
const DATE_NOTE = '날짜는 서버에 지문을 기록한 시각이에요. 사진 속 촬영 정보는 지워서 쓰지 않아요.'
const RECEIPT_NOTE = '서버 기록은 그 시각에 이 처리본 파일의 지문이 서버에 남았다는 뜻이에요. 사진을 찍은 시각이나 법적 효력을 보장하지 않아요.'
const MASK_NOTE = '사진은 기기 안에서 개인정보를 가리고 메타데이터를 제거한 처리본이에요. 원본은 서버로 보내지 않았어요.'
const SERVER_LIMIT_MSG = `서버에는 사진 ${SERVER_LIMIT}장까지 보관해요. 사진을 지운 뒤 추가해 주세요.`
/** 메모 입력이 잠깐 멈추면 서버에 저장 */
const MEMO_SAVE_DELAY = 800

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
/** 기록 날짜 = 서버가 지문을 받은 시각(/api/receipt 수신 시각). 사진 메타데이터는 읽지 않는다 */
const dateText = (p: RoomPhoto) => (p.receipt ? `${formatKST(p.receipt.receivedAt)} · 서버 기록 시각` : '서버 기록 전 — 날짜 없음')
const receiptText = (p: RoomPhoto) => (p.receipt ? `서버 기록 완료 · 지문 ${p.sha256.slice(0, 8)}` : null)
/** 개인정보 가림 배지 문구 — 처리본만 기록북에 쓴다 (서버에서 불러온 사진은 상자 수를 모른다) */
const maskText = (p: RoomPhoto) =>
  p.masked
    ? p.maskCount === undefined
      ? '가림 처리본 · 메타데이터 제거'
      : p.maskCount > 0
        ? `개인정보 가림 · 메타데이터 제거`
        : '메타데이터 제거 · 가린 곳 없음'
    : null
/** 서버 보관 사진 → 화면용. 기록 날짜 = 서버가 처리본을 받은 시각(receivedAt) */
function fromServer(s: ServerPhoto, maskCount?: number): RoomPhoto {
  return {
    id: `srv-${s.id}`,
    serverId: s.id,
    zone: s.zone,
    phase: s.phase,
    url: s.url,
    fileName: `photo-${s.id}`,
    sha256: s.sha256,
    memo: s.memo ?? '',
    receipt: { sha256: s.sha256, receivedAt: s.receivedAt, sig: s.sig },
    masked: true,
    maskCount,
  }
}
/** /api/me 가 보관 동의 시각을 함께 주면 쓴다 (없으면 목록·업로드 결과로 판단) */
const userConsentAt = (u: User | null) => (u as (User & { photoConsentAt?: string | null }) | null)?.photoConsentAt ?? null
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

/* 무료 체험 vs 기록북(가격 가설) 비교 — 데스크톱은 표, 모바일은 두 칸 카드 (PRD FR-04) */
const PLAN_ROWS: { label: string; free: string; book: string }[] = [
  { label: '가격', free: '0원', book: `${BOOK_PRICE} (방 1개·이사 1건, 결제 미연결)` },
  { label: '사진', free: `${FREE_LIMIT}장`, book: `${PROMO_LIMIT}장` },
  { label: '기록북 미리보기·PDF 저장', free: '✓', book: '✓' },
  { label: '서버 보관·다시 보기', free: `로그인하면 ${FREE_LIMIT}장까지`, book: `로그인하면 ${PROMO_LIMIT}장까지` },
  { label: '재다운로드', free: '—', book: '✓' },
]

function PlanCompare() {
  return (
    <div className="rc-plan">
      <table className="rc-plan-table">
        <caption>무료 체험 vs 기록북(가격 가설) 비교 · 결제는 연결하지 않았어요</caption>
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">
              <span className="badge ok">무료 체험</span>
            </th>
            <th scope="col">
              기록북 <span className="badge warn">가격 가설</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {PLAN_ROWS.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td aria-label={r.free === '—' ? '제공 안 함' : undefined}>{r.free}</td>
              <td aria-label={r.book === '—' ? '제공 안 함' : undefined}>{r.book}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rc-plan-cards" aria-hidden="true">
        {(['free', 'book'] as const).map((k) => (
          <div className={`rc-plan-card is-${k}`} key={k}>
            <div className="rc-plan-card-head">
              {k === 'free' ? <span className="badge ok">무료 체험</span> : <>기록북 <span className="badge warn">가격 가설</span></>}
            </div>
            <dl>
              {PLAN_ROWS.map((r) => (
                <div key={r.label}>
                  <dt>{r.label}</dt>
                  <dd>{r[k]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
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
  zone: Zone
  phase: Phase
  /** 추가를 시작할 때 로그인 상태였는지 — 대화상자가 열린 동안 모드가 바뀌지 않게 고정 */
  server: boolean
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export default function RecordScreen() {
  const { photos, setPhotos, roomNickname, setRoomNickname } = useStore()
  const promo = usePromoUnlocked()
  const [zone, setZone] = useState<Zone>('벽')
  const [phase, setPhase] = useState<Phase>('입주')
  const [unlocked, setUnlocked] = useState(demoUnlockedSession)
  const [limitOpen, setLimitOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPhoto | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState<{ [id: string]: boolean }>({})
  const [errors, setErrors] = useState<{ [id: string]: string }>({})
  const [showPreview, setShowPreview] = useState(false)
  const [memoState, setMemoState] = useState<{ [id: string]: 'saving' | 'saved' }>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // ── 로그인 = 서버 보관 모드 ──
  const me = useMe()
  const user = me.user
  const userId = user?.id ?? null
  const serverMode = userId !== null
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [consentKnown, setConsentKnown] = useState(false)
  const memoTimers = useRef(new Map<number, number>())
  const memoQueue = useRef(new Map<number, string>())

  // 화면 진입·로그인 사용자 변경 시 저장된 사진을 불러온다. 로그아웃하면 서버 사진은 화면에서 뺀다(이 기기 사진은 그대로)
  useEffect(() => {
    if (userId === null) {
      setPhotos((prev) => (prev.some((p) => p.serverId !== undefined) ? prev.filter((p) => p.serverId === undefined) : prev))
      setLoadState('idle')
      setLoadError(null)
      setConsentKnown(false)
      return
    }
    let alive = true
    setLoadState('loading')
    setLoadError(null)
    listPhotos()
      .then((list) => {
        if (!alive) return
        setPhotos((prev) => {
          const known = new Map(prev.filter((p) => p.serverId !== undefined).map((p) => [p.serverId, p]))
          const server = list.map((s) => {
            const old = known.get(s.id)
            // 입력 중이라 아직 저장 전인 메모는 덮어쓰지 않는다
            const memo = memoQueue.current.has(s.id) && old ? old.memo : (s.memo ?? '')
            return { ...fromServer(s, old?.maskCount), memo }
          })
          return [...server, ...prev.filter((p) => p.serverId === undefined)]
        })
        if (list.length > 0) setConsentKnown(true)
        setLoadState('ready')
      })
      .catch((err: unknown) => {
        if (!alive) return
        if (isLoginError(err)) void refreshMe()
        setLoadError(`저장된 사진을 불러오지 못했어요. ${photoErrorText(err)}`)
        setLoadState('error')
      })
    return () => {
      alive = false
    }
    // setPhotos 는 상태 묶음이 바뀔 때마다 새로 만들어지지만 하는 일은 같다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloadKey])

  useEffect(() => {
    if (userConsentAt(user)) setConsentKnown(true)
  }, [user])

  // 화면을 떠날 때 아직 안 보낸 메모는 바로 저장
  useEffect(() => {
    const timers = memoTimers.current
    const queue = memoQueue.current
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers.clear()
      queue.forEach((memo, sid) => void patchServerPhoto(sid, { memo }).catch(() => undefined))
      queue.clear()
    }
  }, [])

  const openPicker = () => fileRef.current?.click()
  const noLimit = unlocked || promo
  const limitReached = photos.length >= FREE_LIMIT && !noLimit
  const promoCapReached = promo && photos.length >= PROMO_LIMIT
  const serverCount = photos.filter((p) => p.serverId !== undefined).length
  const serverCapReached = serverMode && serverCount >= SERVER_LIMIT

  /** 한도 확인 — 막혔으면 true (서버 보관 사진도 같은 한도로 센다) */
  const blockedByLimit = () => {
    if (serverCapReached) {
      setAddError(SERVER_LIMIT_MSG)
      return true
    }
    if (promoCapReached) {
      setAddError(PROMO_LIMIT_MSG)
      return true
    }
    if (limitReached) {
      setLimitOpen(true)
      return true
    }
    return false
  }

  const onAddClick = () => {
    if (pending) return
    setAddError(null)
    if (blockedByLimit()) return
    openPicker()
  }

  const continueDemo = () => {
    demoUnlockedSession = true
    setUnlocked(true)
    setLimitOpen(false)
    openPicker()
  }

  // 1) 사진 선택 → JPEG·PNG 확인 → 개인정보 가리기 대화상자 (사진 메타데이터는 읽지 않고 처리본에서 지운다)
  const addFile = (file: File) => {
    if (!maskableType(file)) {
      setAddError('JPEG·PNG 사진만 가릴 수 있어요. HEIC·WebP 등은 사진 앱에서 JPEG로 저장한 뒤 올려 주세요. 서버로 보낸 것은 없어요.')
      return
    }
    setAddError(null)
    setStatus('')
    setPending({ file, zone, phase, server: serverMode })
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    addFile(file)
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
    if (!file || pending) return
    setAddError(null)
    if (blockedByLimit()) return
    addFile(file)
  }

  const updatePhoto = (id: string, patch: Partial<RoomPhoto>) =>
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const clearError = (id: string) =>
    setErrors((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })

  const dropMemoQueue = (sid: number) => {
    const t = memoTimers.current.get(sid)
    if (t !== undefined) window.clearTimeout(t)
    memoTimers.current.delete(sid)
    memoQueue.current.delete(sid)
  }

  // 삭제 — 서버 보관 사진은 서버에서 파일·행을 지운 뒤 카드에서 뺀다
  const removePhoto = async (p: RoomPhoto) => {
    const sid = p.serverId
    if (sid === undefined) {
      URL.revokeObjectURL(p.url)
      setPhotos((prev) => prev.filter((x) => x.id !== p.id))
      setStatus(`${p.zone} ${p.phase} 사진을 이 화면에서 지웠어요.`)
      addBtnRef.current?.focus()
      return
    }
    setBusy((b) => ({ ...b, [p.id]: true }))
    clearError(p.id)
    try {
      await deletePhoto(sid)
    } catch (err) {
      const code = photoErrorCode(err)
      if (code !== 'not_found' && code !== 'http_404') {
        if (isLoginError(err)) void refreshMe()
        setErrors((prev) => ({ ...prev, [p.id]: `삭제하지 못했어요. ${photoErrorText(err)}` }))
        setBusy((b) => ({ ...b, [p.id]: false }))
        return
      }
    }
    dropMemoQueue(sid)
    setPhotos((prev) => prev.filter((x) => x.id !== p.id))
    setBusy((b) => {
      const next = { ...b }
      delete next[p.id]
      return next
    })
    setStatus(`${p.zone} ${p.phase} 사진을 서버에서 삭제했어요.`)
    addBtnRef.current?.focus()
  }

  // 메모 — 서버 보관 사진은 입력이 잠깐 멈추거나 칸을 벗어나면 PATCH
  const flushMemo = (p: RoomPhoto) => {
    const sid = p.serverId
    if (sid === undefined) return
    const t = memoTimers.current.get(sid)
    if (t !== undefined) window.clearTimeout(t)
    memoTimers.current.delete(sid)
    const memo = memoQueue.current.get(sid)
    if (memo === undefined) return
    memoQueue.current.delete(sid)
    setMemoState((m) => ({ ...m, [p.id]: 'saving' }))
    patchServerPhoto(sid, { memo })
      .then(() => {
        clearError(p.id)
        if (!memoQueue.current.has(sid)) setMemoState((m) => ({ ...m, [p.id]: 'saved' }))
      })
      .catch((err: unknown) => {
        if (isLoginError(err)) void refreshMe()
        setMemoState((m) => {
          const next = { ...m }
          delete next[p.id]
          return next
        })
        setErrors((prev) => ({ ...prev, [p.id]: `메모를 저장하지 못했어요. ${photoErrorText(err)}` }))
      })
  }

  const onMemoChange = (p: RoomPhoto, memo: string) => {
    updatePhoto(p.id, { memo })
    const sid = p.serverId
    if (sid === undefined) return
    memoQueue.current.set(sid, memo)
    const t = memoTimers.current.get(sid)
    if (t !== undefined) window.clearTimeout(t)
    memoTimers.current.set(
      sid,
      window.setTimeout(() => flushMemo(p), MEMO_SAVE_DELAY),
    )
    setMemoState((m) => {
      if (!(p.id in m)) return m
      const next = { ...m }
      delete next[p.id]
      return next
    })
  }

  // 로그아웃 상태에서 서버로 가는 유일한 경로 — 처리본의 지문(SHA-256) 64자만. 사진 파일은 보내지 않는다.
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

  // 로그인: [확인하고 기록하기] → (처음이면 보관 동의) → 처리본 Blob 업로드. 실패하면 대화상자에 안내하고 그대로 둔다
  const saveToServer = async (r: ConfirmedTransfer, p: PendingPhoto, consent: boolean) => {
    try {
      if (consent) {
        await consentPhotos()
        setConsentKnown(true)
      }
      const { photo } = await uploadPhoto(r.blob, r.type, { zone: p.zone, phase: p.phase })
      setConsentKnown(true)
      const existed = photos.some((x) => x.serverId === photo.id)
      URL.revokeObjectURL(r.url) // 화면은 서버 파일(/api/photos/<id>/file)로 보여 준다
      setPhotos((prev) => (prev.some((x) => x.serverId === photo.id) ? prev : [...prev, fromServer(photo, r.maskCount)]))
      setPending(null)
      setStatus(
        existed
          ? '같은 처리본이 이미 서버에 저장돼 있어요. 새로 보관하지 않았어요.'
          : `${p.zone} ${p.phase} 처리본을 서버에 저장했어요 (가림 상자 ${r.maskCount}개 · 메타데이터 제거). 내 계정에만 보관돼요.`,
      )
    } catch (err) {
      const code = photoErrorCode(err)
      if (isLoginError(err)) void refreshMe()
      if (code === 'photo_consent_required') setConsentKnown(false)
      if (code === 'limit_reached') setReloadKey((k) => k + 1)
      const msg = isLoginError(err) ? `${photoErrorText(err)} 아무것도 저장되지 않았어요.` : photoErrorText(err)
      throw new TransferError(msg, {
        redo: code === 'metadata_present' || code === 'unsupported_type',
        needConsent: code === 'photo_consent_required',
      })
    }
  }

  // 2)~4) 가리기·처리본·전송본 확인은 MaskEditor 안에서. 확인 버튼을 눌렀을 때만 여기로 온다.
  //      로그아웃: 기록북에는 처리본(object URL)만 넣고, 그제야 처리본 지문을 서버에 기록한다.
  const onMaskConfirm = (r: ConfirmedTransfer, opts: { consent: boolean }): void | Promise<void> => {
    const p = pending
    if (!p) return
    if (p.server) return saveToServer(r, p, opts.consent)
    const photo: RoomPhoto = {
      id: newId(),
      zone: p.zone,
      phase: p.phase,
      url: r.url,
      // 원본 파일명은 화면·기록북·서버 어디에도 쓰지 않는다 (임의 ID만)
      fileName: `photo-${newId().slice(0, 8)}`,
      sha256: r.sha256,
      memo: '',
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

  const retryLoad = () => setReloadKey((k) => k + 1)

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
        {user?.isTestAccount && (
          <p className="notice warn rc-notice" role="note">
            <b>{TEST_ACCOUNT_NOTICE}</b>
          </p>
        )}
        {serverMode ? (
          <div className="notice rc-notice">
            <p>
              사진은 <b>기기 안에서 개인정보를 가리고 메타데이터를 제거한 처리본</b>만 써요. 로그인 중이라 [확인하고 기록하기]를 누르면 그 처리본을 <b>내 계정에만</b>{' '}
              보관해요. 원본은 보내지 않고, 공개 링크도 만들지 않아요.
            </p>
            <p className="muted small">
              다음에 로그인해도 이어서 볼 수 있어요. 보관: {RETENTION_TEXT} 전송본을 확인하기 전이나 처리에 실패하면 아무것도 보내지 않아요.
            </p>
          </div>
        ) : (
          <>
            <div className="notice rc-notice">
              <p>
                사진은 <b>기기 안에서 개인정보를 가리고 메타데이터를 제거한 처리본</b>만 써요. 서버로는 처리본의 지문(SHA-256) 64자만 가고, 사진 파일은 보내지 않아요.
              </p>
              <p className="muted small">전송본을 확인하기 전이나 처리에 실패하면 아무것도 보내지 않아요. 체험 데이터는 이 화면에서만 쓰여요. 새로고침하면 처음 상태로 돌아가요.</p>
            </div>
            {me.status === 'ready' && (
              <div className="rc-login-cta" role="note" aria-label="서버 저장 안내">
                <p>로그인하면 가린 사진을 서버에 저장해 다음에도 이어서 볼 수 있어요</p>
                <a className="btn rc-login-btn" href={hrefOf('signup')}>
                  로그인·회원가입
                </a>
              </div>
            )}
          </>
        )}
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
          <p className="small muted rc-trial-text">
            {trialText}
            {serverMode && ` · 서버 보관 ${serverCount}/${SERVER_LIMIT}장`}
          </p>
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
        <PlanCompare />

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
            className={`rc-drop${dragging ? ' is-dragging' : ''}`}
            onClick={onAddClick}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <span className="rc-drop-icon">
              <Icon name="camera" size={24} />
            </span>
            {/* disabled 대신 aria-disabled — 가리기 대화상자가 열린 동안에도 포커스를 잃지 않게 (onAddClick 이 중복 실행을 막는다) */}
            <button
              ref={addBtnRef}
              type="button"
              className="btn primary rc-drop-btn"
              onClick={(e) => {
                e.stopPropagation()
                onAddClick()
              }}
              aria-disabled={pending !== null}
            >
              사진 추가
            </button>
            <span className="muted small">
              {zone} · {phase} 사진으로 추가돼요 · JPEG·PNG{serverMode ? ' · 확인하면 내 계정에 저장' : ''}
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
        {serverMode && loadState === 'loading' && (
          <p className="muted small rc-load" role="status">
            저장된 사진을 불러오는 중…
          </p>
        )}
        {serverMode && loadError && (
          <div className="rc-load-error" role="alert">
            <p className="error-text">{loadError}</p>
            <button type="button" className="btn" onClick={retryLoad}>
              다시 불러오기
            </button>
          </div>
        )}
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
                        {p.serverId !== undefined ? (
                          <p className="photo-store">
                            <span className="badge ok store-badge">
                              <Icon name="check" size={14} stroke={3} />
                              서버에 저장됨
                            </span>
                            <span className="muted small">내 계정에만 보관</span>
                          </p>
                        ) : (
                          serverMode && (
                            <p className="photo-store">
                              <span className="badge warn">이 기기에만</span>
                              <span className="muted small">로그인 전에 추가한 사진이라 새로고침하면 사라져요</span>
                            </p>
                          )
                        )}
                        {mText && (
                          <div className="photo-mask">
                            <span className="badge ok mask-badge">
                              <Icon name="shield" size={14} stroke={2.4} />
                              {mText}
                            </span>
                            {(p.maskCount ?? 0) > 0 && <span className="muted small">가림 상자 {p.maskCount}개</span>}
                          </div>
                        )}
                        <p className="photo-date">
                          <span className="photo-date-label">기록 날짜</span>{' '}
                          <span className={p.receipt ? 'photo-date-value' : 'photo-date-value none'}>{dateText(p)}</span>
                        </p>
                        <div className="photo-field">
                          <label htmlFor={`memo-${p.id}`}>메모</label>
                          <textarea
                            id={`memo-${p.id}`}
                            className="record-memo"
                            value={p.memo}
                            maxLength={300}
                            placeholder="예: 입주 때부터 있던 벽지 얼룩"
                            aria-describedby={p.serverId !== undefined ? `memo-state-${p.id}` : undefined}
                            onChange={(e) => onMemoChange(p, e.target.value)}
                            onBlur={() => flushMemo(p)}
                          />
                          {p.serverId !== undefined && (
                            <span id={`memo-state-${p.id}`} className="muted small memo-state" aria-live="polite">
                              {memoState[p.id] === 'saving' ? '메모 저장 중…' : memoState[p.id] === 'saved' ? '메모를 서버에 저장했어요' : ''}
                            </span>
                          )}
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
                          <button
                            type="button"
                            className="btn ghost"
                            aria-label={p.serverId !== undefined ? `${name} 서버에서 삭제` : `${name} 삭제`}
                            onClick={() => void removePhoto(p)}
                            disabled={p.serverId !== undefined && !!busy[p.id]}
                          >
                            {p.serverId !== undefined && busy[p.id] ? '삭제하는 중…' : '삭제'}
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
                    {DATE_NOTE}
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
                                <b>기록 날짜</b> <span>{dateText(p)}</span>
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

      {pending && (
        <MaskEditor
          file={pending.file}
          label={`${pending.zone} · ${pending.phase}`}
          onCancel={onMaskCancel}
          onConfirm={onMaskConfirm}
          returnFocusRef={addBtnRef}
          save={pending.server ? { consentNeeded: !consentKnown, retention: RETENTION_TEXT } : undefined}
        />
      )}
    </section>
  )
}
