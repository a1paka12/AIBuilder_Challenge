import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getStats, postMetric, type Stats } from '../api'
import { go, useRoute } from '../router'
import { closePopupForSession, hidePopupToday, popupClosedThisSession, popupHiddenToday, usePromoUnlocked } from '../lib/promo'
import '../styles/promo.css'

/*
 * 첫 화면 레이어 팝업 (은행 누리집 첫 화면 안내창 꼴)
 * - 첫 화면(route 'home')에서만, 첫 렌더 뒤 약 400ms에 연다.
 * - '오늘 하루 보지 않기'(KST 자정까지) · '닫기'(이번 탭) · URL 쿼리 nopopup=1(자동 점검용)이면 열지 않는다.
 * - 패널 2개: ① 출시 기념 이벤트 → #/event ② 혼자 묻기 어렵다면 → #/help. 자동 넘김 없음.
 * - 접근성: role=dialog + aria-modal, 열릴 때 제목으로 포커스, Tab 가둠, Esc·배경 클릭 닫기, 닫으면 이전 포커스 복귀,
 *   패널이 바뀌면 "2 / 2 · 제목"을 aria-live 로 알림. 숫자는 GET /api/stats 실제 값만(0이면 숨김).
 */

const OPEN_DELAY_MS = 400
const PANEL_COUNT = 2
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const n = (v: number) => v.toLocaleString('ko-KR')

/** 해시 쿼리(#/?nopopup=1) 또는 주소 쿼리(/?nopopup=1) — 자동 점검 때 팝업을 끈다 */
function suppressedByQuery(hashQuery: URLSearchParams): boolean {
  if (hashQuery.get('nopopup') === '1') return true
  try {
    return new URLSearchParams(window.location.search).get('nopopup') === '1'
  } catch {
    return false
  }
}

/* ── 키 비주얼: 선 그림(장식, aria-hidden). 사진·로고·외부 이미지 없음 ───────── */

/* ① 설문 응답 → 기록북 사진이 계속 쌓이는 모습 */
function EventKeyVisual() {
  return (
    <svg viewBox="0 0 328 128" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="70" cy="64" r="46" fill="currentColor" opacity="0.08" stroke="none" />
      <circle cx="236" cy="64" r="50" fill="currentColor" opacity="0.08" stroke="none" />
      {/* 휴대폰 속 30초 설문 */}
      <rect x="42" y="18" width="56" height="92" rx="9" fill="#fff" />
      <path d="M62 24h16" />
      <circle cx="55" cy="44" r="4.5" fill="#fff" />
      <path d="M64 44h24" />
      <circle cx="55" cy="62" r="4.5" fill="#fff" />
      <path d="M64 62h24" />
      <circle cx="55" cy="80" r="4.5" fill="currentColor" />
      <path d="M64 80h24" />
      <rect x="52" y="93" width="36" height="10" rx="3" fill="currentColor" stroke="none" />
      {/* 화살표 */}
      <path d="M118 64h34" />
      <path d="M143 55l10 9-10 9" />
      {/* 쌓이는 방 사진 */}
      <rect x="192" y="36" width="80" height="58" rx="5" fill="#fff" opacity="0.7" transform="rotate(-8 232 65)" />
      <rect x="192" y="36" width="80" height="58" rx="5" fill="#fff" opacity="0.85" transform="rotate(6 232 65)" />
      <rect x="192" y="38" width="80" height="58" rx="5" fill="#fff" />
      <circle cx="210" cy="54" r="5" />
      <path d="M196 90l20-20 14 12 12-14 26 22" fill="currentColor" fillOpacity="0.15" />
      {/* 더 추가 */}
      <circle cx="272" cy="38" r="12" fill="currentColor" stroke="none" />
      <path d="M272 32v12M266 38h12" stroke="#fff" strokeWidth="2.5" />
      {/* 확인 */}
      <circle cx="292" cy="98" r="13" fill="#fff" />
      <path d="M285 98l5 5 10-10" strokeWidth="2.5" />
    </svg>
  )
}

/* ② 묻고 싶은 말풍선 → 상담 기관(건물) → 공식 검색(돋보기) */
function HelpKeyVisual() {
  return (
    <svg viewBox="0 0 328 128" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="78" cy="64" r="46" fill="currentColor" opacity="0.08" stroke="none" />
      <circle cx="262" cy="64" r="46" fill="currentColor" opacity="0.08" stroke="none" />
      {/* 말풍선 + 물음표 */}
      <path d="M38 30h74a8 8 0 0 1 8 8v38a8 8 0 0 1-8 8H72l-16 14V84H38a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8z" fill="#fff" />
      <path d="M66 50a9 9 0 1 1 13 8c-3 1.7-4 3-4 6.5" strokeWidth="2.5" />
      <circle cx="75" cy="71" r="1.8" fill="currentColor" stroke="none" />
      {/* 상담 기관 건물 */}
      <path d="M140 50l40-20 40 20z" fill="#fff" />
      <rect x="146" y="50" width="68" height="8" fill="#fff" />
      <rect x="152" y="58" width="8" height="38" fill="#fff" />
      <rect x="168" y="58" width="8" height="38" fill="#fff" />
      <rect x="184" y="58" width="8" height="38" fill="#fff" />
      <rect x="200" y="58" width="8" height="38" fill="#fff" />
      <rect x="138" y="96" width="84" height="7" fill="#fff" />
      {/* 공식 검색 돋보기 */}
      <circle cx="268" cy="58" r="22" fill="#fff" strokeWidth="2.5" />
      <path d="M284 74l18 18" strokeWidth="5" />
      <circle cx="268" cy="52" r="6" />
      <path d="M257 71a11 11 0 0 1 22 0" />
    </svg>
  )
}

interface Panel {
  key: 'event' | 'help'
  eyebrow: string
  title: string
  visual: ReactNode
  body: string
  sub: string
  extra?: ReactNode
  actionLabel: string
  onAction: () => void
  /** 보조 버튼(선택) — 주 버튼 아래에 테두리 버튼으로 */
  secondaryLabel?: string
  onSecondary?: () => void
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
function ChevronIcon({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

export default function PromoPopup() {
  const { route, query } = useRoute()
  const unlocked = usePromoUnlocked()
  const uid = useId()
  // 열린 화면 이름을 기억해 두고, 지금 화면과 같을 때만 보인다 → 다른 화면으로 가면 저절로 닫힌다
  const [openRoute, setOpenRoute] = useState<string | null>(null)
  const open = openRoute !== null && openRoute === route
  const [index, setIndex] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)
  const downOnBackdrop = useRef(false)

  // 첫 화면에서만, 첫 렌더 뒤 약 400ms에 연다 (다른 화면에서는 open 이 false 로 계산된다)
  useEffect(() => {
    if (route !== 'home') return
    if (suppressedByQuery(query) || popupClosedThisSession() || popupHiddenToday()) return
    const t = window.setTimeout(() => setOpenRoute('home'), OPEN_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [route, query])

  // 열릴 때: 이전 포커스 기억 → 제목으로 포커스 → 참여 수 불러오기. 닫힐 때: 이전 포커스 복귀.
  useEffect(() => {
    if (!open) return
    prevFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const raf = window.requestAnimationFrame(() => titleRef.current?.focus())
    let alive = true
    getStats()
      .then((s) => {
        if (alive) setStats(s)
      })
      .catch(() => {
        /* 집계를 못 불러오면 숫자만 숨긴다 */
      })
    return () => {
      alive = false
      window.cancelAnimationFrame(raf)
      const prev = prevFocusRef.current
      if (prev && prev.isConnected) prev.focus()
    }
  }, [open])

  const close = () => {
    closePopupForSession()
    setOpenRoute(null)
  }
  const hideToday = () => {
    hidePopupToday()
    closePopupForSession()
    setOpenRoute(null)
  }
  const goDetail = (target: 'event' | 'help' | 'record' | 'lawyer') => {
    // 변호사 찾아보기는 ② 상담 패널에서 가므로 같은 지표(popup_help)를 쓴다
    postMetric(target === 'help' || target === 'lawyer' ? 'popup_help' : 'popup_event')
    closePopupForSession()
    setOpenRoute(null)
    go(target)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (e.key !== 'Tab') return
    const root = dialogRef.current
    if (!root) return
    const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    if (nodes.length === 0) {
      e.preventDefault()
      return
    }
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement
    const inside = active instanceof HTMLElement && nodes.includes(active)
    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault()
        last.focus()
      }
    } else if (!inside || active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // 배경(딤) 클릭 닫기 — 글자 선택 중 바깥에서 손을 떼는 경우는 닫지 않는다
  const onBackdropMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    downOnBackdrop.current = e.target === e.currentTarget
  }
  const onBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && downOnBackdrop.current) close()
    downOnBackdrop.current = false
  }

  const total = stats?.survey.total ?? 0
  const panels: Panel[] = [
    {
      key: 'event',
      eyebrow: '출시 기념 이벤트',
      title: '출시 기념 이벤트',
      visual: <EventKeyVisual />,
      body: '30초 현장 설문에 답하면, 이 기기에서 기록북 범위(사진 30장)까지 체험할 수 있어요.',
      sub: '결제는 아직 연결 전이에요 · 이름·연락처는 묻지 않아요',
      extra:
        total >= 1 ? (
          <p className="promo-count">
            <span className="badge">
              지금까지 <b className="num">{n(total)}</b>명 참여
            </span>
          </p>
        ) : null,
      actionLabel: unlocked ? '혜택이 적용됐어요 · 기록북 만들기' : '이벤트 자세히 보기',
      onAction: () => goDetail(unlocked ? 'record' : 'event'),
    },
    {
      key: 'help',
      eyebrow: '상담 기관 안내',
      title: '혼자 묻기 어렵다면',
      visual: <HelpKeyVisual />,
      body: '무료 법률상담 기관과 변호사 조건 추천(가상 프로필 시연)을 한곳에 모았어요.',
      sub: '특정 변호사를 소개·알선하지 않고 어떤 대가(소개비·수수료·광고비)도 받지 않아요. 연락은 직접 해요.',
      actionLabel: '상담 기관 자세히 보기',
      onAction: () => goDetail('help'),
      secondaryLabel: '변호사 찾아보기',
      onSecondary: () => goDetail('lawyer'),
    },
  ]

  if (!open) return null

  const panel = panels[index]
  const titleId = `${uid}-title`
  const descId = `${uid}-desc`

  return createPortal(
    <div className="promo-backdrop" role="presentation" onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="promo-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
      >
        <div className="promo-head">
          <span className="promo-head-label">보증금 지킴이 안내</span>
          <button type="button" className="promo-x" aria-label="닫기" onClick={close}>
            <CloseIcon />
          </button>
        </div>

        <div className="promo-body">
          <div key={panel.key} className="promo-panel">
            <div className="promo-visual" aria-hidden="true">
              {panel.visual}
            </div>
            <p className="promo-eyebrow">
              <span className="badge">{panel.eyebrow}</span>
            </p>
            <h2 id={titleId} className="promo-title" tabIndex={-1} ref={titleRef}>
              {panel.title}
            </h2>
            <p id={descId} className="promo-text">
              {panel.body}
            </p>
            <p className="promo-sub small muted">{panel.sub}</p>
            {panel.extra}
            <button type="button" className="btn primary promo-cta" onClick={panel.onAction}>
              {panel.actionLabel}
            </button>
            {panel.secondaryLabel && panel.onSecondary && (
              <button type="button" className="btn promo-cta" onClick={panel.onSecondary}>
                {panel.secondaryLabel}
              </button>
            )}
          </div>
        </div>

        <div className="promo-pager">
          <button type="button" className="promo-pager-btn" aria-label="이전 안내" onClick={() => setIndex((i) => (i + PANEL_COUNT - 1) % PANEL_COUNT)}>
            <ChevronIcon dir="left" />
          </button>
          <span className="promo-pager-status" aria-live="polite" aria-atomic="true">
            <span className="num">
              {index + 1} / {PANEL_COUNT}
            </span>
            <span className="promo-dots" aria-hidden="true">
              {panels.map((p, i) => (
                <span key={p.key} className={`promo-dot${i === index ? ' is-on' : ''}`} />
              ))}
            </span>
            <span className="promo-sr"> · {panel.title}</span>
          </span>
          <button type="button" className="promo-pager-btn" aria-label="다음 안내" onClick={() => setIndex((i) => (i + 1) % PANEL_COUNT)}>
            <ChevronIcon dir="right" />
          </button>
        </div>

        <div className="promo-foot">
          <button type="button" className="promo-foot-btn" onClick={hideToday}>
            <span className="promo-checkbox" aria-hidden="true" />
            오늘 하루 보지 않기
          </button>
          <button type="button" className="promo-foot-btn" onClick={close}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
