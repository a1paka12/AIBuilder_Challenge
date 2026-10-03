import { useEffect, useRef, type ReactNode } from 'react'
import { StoreProvider } from './state'
import { documentTitle, hrefOf, useRoute, type Route } from './router'
import Home from './screens/Home'
import Deduct from './screens/Deduct'
import Record from './screens/Record'
import Cert from './screens/Cert'
import Pricing from './screens/Pricing'
import Privacy from './screens/Privacy'
import Event from './screens/Event'
import Help from './screens/Help'
import Lawyers from './screens/Lawyers'
import Signup from './screens/Signup'
import PromoPopup from './components/PromoPopup'
import FooterCompliance from './components/FooterCompliance'
import ServiceMarks from './components/ServiceMarks'
import { COMPANY } from './data/company'
import { useMe } from './lib/auth'
import { HOME_TASKS } from './components/home/tasks'
import { TaskIcon } from './components/home/icons'
import './styles/shell.css'
import './styles/signup.css'

/* ── 화면 전환 ───────────────────────────────────────────────────────── */

function Screen() {
  const { route, query } = useRoute()
  const prevRoute = useRef<Route | null>(null)

  /*
   * 화면이 바뀌면 ① 문서 제목을 바꾸고 ② 첫 로드가 아니면 새 화면의 h1(없으면 본문)으로 포커스를 옮긴다.
   * 해시 라우팅은 페이지를 새로 읽지 않아 화면낭독기가 제목·포커스를 그대로 두기 때문이다.
   * 스크롤은 라우터가 hashchange 때 이미 맨 위로 올렸으므로 포커스는 스크롤을 건드리지 않는다.
   */
  useEffect(() => {
    document.title = documentTitle(route)
    const moved = prevRoute.current !== null && prevRoute.current !== route
    prevRoute.current = route
    if (!moved) return
    const main = document.getElementById('main')
    if (!main) return
    const h1 = main.querySelector('h1')
    if (h1) {
      if (!h1.hasAttribute('tabindex')) h1.tabIndex = -1
      h1.focus({ preventScroll: true })
    } else {
      main.focus({ preventScroll: true })
    }
  }, [route])

  switch (route) {
    case 'deduct':
      return <Deduct sample={query.get('sample') === '1'} />
    case 'record':
      return <Record />
    case 'cert':
      return <Cert />
    case 'pricing':
      return <Pricing />
    case 'privacy':
      return <Privacy />
    case 'event':
      return <Event />
    case 'help':
      return <Help />
    case 'lawyer':
      return <Lawyers />
    case 'signup':
      return <Signup />
    default:
      return <Home />
  }
}

/* ── 선 아이콘 (장식, aria-hidden). 로고·문장·도장 모양은 쓰지 않는다 ─────────── */

/* 단순한 선 집 아이콘 (기관 로고·문장처럼 보이지 않게 선만 사용) */
function HouseMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 10.5L12 4l8.5 6.5" />
      <path d="M5.5 9v10.5h13V9" />
      <path d="M10 19.5v-5h4v5" />
    </svg>
  )
}

function LineIcon({ size = 16, className, children }: { size?: number; className?: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/* 새 창(외부 링크) */
const IconExternal = ({ className }: { className?: string }) => (
  <LineIcon size={14} className={className}>
    <path d="M14 4h6v6" />
    <path d="M20 4l-9.5 9.5" />
    <path d="M19 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.5" />
  </LineIcon>
)

/* 말풍선 (온라인 문의) */
const IconChat = () => (
  <LineIcon size={18}>
    <path d="M4 5h16v11h-9l-4.5 3.5V16H4z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </LineIcon>
)

/* 사람 (계정) */
const IconUser = () => (
  <LineIcon size={16}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5" />
  </LineIcon>
)

/* ── 상단: 고지 띠 + 헤더(로고·계정) + 업무 바로가기 아이콘 줄 ─────────────────────────────────────────── */

/** 헤더 오른쪽 계정 버튼 — 로그인 전 "로그인·회원가입", 로그인 후 "내 계정" (둘 다 #/signup) */
function AccountLink({ active }: { active: boolean }) {
  const { status, user } = useMe()
  return (
    <a className="account-link" href={hrefOf('signup')} aria-current={active ? 'page' : undefined} data-loading={status === 'loading' || undefined}>
      <IconUser />
      <span>{user ? '내 계정' : '로그인·회원가입'}</span>
    </a>
  )
}

/*
 * 업무 바로가기 — 헤더 바로 아래 아이콘 줄. 순서·아이콘은 첫 화면 업무 목록(home/tasks.ts)과 같다.
 * 보이는 이름은 짧게(2~4글자), 화면낭독기에는 뒤에 나머지 이름을 이어 읽힌다(보이는 글자가 접근 이름의 앞에 오도록).
 */
const TASK_NAV: { route: Route; short: string; more: string }[] = [
  { route: 'deduct', short: '공제', more: ' 문자 정리' },
  { route: 'record', short: '기록', more: ' (방 상태 기록)' },
  { route: 'lawyer', short: '변호사', more: ' 찾아보기' },
  { route: 'help', short: '상담', more: ' 기관 안내' },
  { route: 'cert', short: '내용증명', more: ' 서식' },
  { route: 'event', short: '이벤트', more: ' (출시 기념)' },
  { route: 'pricing', short: '가격', more: ' 안내' },
]
const TASK_ICON = new Map(HOME_TASKS.map((t) => [t.route, t.icon]))

/** 아이콘 줄이 넘칠 때(좁은 화면) 양끝 흐림 표시용 — 스크롤 위치를 data-edge 로 적는다 */
function markEdges(nav: HTMLElement, wrap: HTMLElement) {
  const max = nav.scrollWidth - nav.clientWidth
  let edge = 'none'
  if (max > 1) edge = nav.scrollLeft <= 1 ? 'start' : nav.scrollLeft >= max - 1 ? 'end' : 'mid'
  wrap.dataset.edge = edge
}

/** 업무 바로가기 아이콘 줄 — 좁은 화면에서는 줄만 가로 스크롤(페이지는 스크롤되지 않음) */
function TaskNav({ route }: { route: Route }) {
  const navRef = useRef<HTMLElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 넘침 여부는 창 크기·글꼴 로딩에 따라 달라진다
  useEffect(() => {
    const refresh = () => {
      const nav = navRef.current
      const wrap = wrapRef.current
      if (nav && wrap) markEdges(nav, wrap)
    }
    refresh()
    window.addEventListener('resize', refresh)
    document.fonts?.ready.then(refresh, () => {})
    return () => window.removeEventListener('resize', refresh)
  }, [])

  // 줄이 스크롤될 때는 현재 화면 항목이 보이도록 가운데로 옮긴다
  useEffect(() => {
    const nav = navRef.current
    if (!nav || nav.scrollWidth - nav.clientWidth <= 1) return
    const el = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!el) return
    const r = el.getBoundingClientRect()
    const nr = nav.getBoundingClientRect()
    const left = nav.scrollLeft + (r.left - nr.left) - (nr.width - r.width) / 2
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    nav.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' })
  }, [route])

  return (
    <div className="tasknav-wrap" ref={wrapRef}>
      <nav
        className="tasknav"
        aria-label="업무 바로가기"
        ref={navRef}
        onScroll={(e) => {
          if (wrapRef.current) markEdges(e.currentTarget, wrapRef.current)
        }}
      >
        <ul className="tasknav-list">
          {TASK_NAV.map((t) => {
            const icon = TASK_ICON.get(t.route)
            return (
              <li key={t.route}>
                <a className="tasknav-item" href={hrefOf(t.route)} aria-current={route === t.route ? 'page' : undefined}>
                  <span className="tasknav-icon">{icon && <TaskIcon name={icon} size={24} />}</span>
                  <span className="tasknav-label">
                    {t.short}
                    <span className="shell-sr">{t.more}</span>
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function Header() {
  const { route } = useRoute()
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <p className="utility-note">
            민간 학생 팀 서비스
            <span className="utility-note-more"> · 정부·공공기관 서비스가 아니에요</span>
          </p>
        </div>
      </div>
      <header className="topbar">
        <div className="container topbar-inner">
          <a className="brand" href={hrefOf('home')} aria-current={route === 'home' ? 'page' : undefined}>
            <HouseMark />
            <span className="brand-name">보증금 지킴이</span>
          </a>
          <AccountLink active={route === 'signup'} />
        </div>
        <TaskNav route={route} />
      </header>
    </>
  )
}

/* ── 바닥글: 링크 줄 · 고객센터 · 사업자 정보 · 고지 · 서비스 메뉴 + 준수 표시 · 저작권 ───────── */

/* 사업자 정보 — src/data/company.ts 의 값을 그대로 보여 준다(지어낸 번호 없음) */
const BIZ_ROWS: { label: string; value: string; note?: string }[] = [
  { label: '서비스명', value: COMPANY.serviceName },
  { label: '운영', value: COMPANY.operator, note: COMPANY.operatorNote },
  { label: '주소', value: COMPANY.address, note: COMPANY.addressNote },
  { label: '사업자등록', value: COMPANY.bizReg },
  { label: '통신판매업', value: COMPANY.mailOrder },
  { label: '호스팅', value: COMPANY.hosting },
  { label: '개인정보 보호 담당', value: COMPANY.privacyOfficer },
]

/* 서비스 메뉴 — 예전 상단 글자 메뉴. 가격 안내는 바닥글에 두지 않는다(헤더 아이콘 줄·첫 화면에서 연결) */
const FOOTER_MENU: { route: Route; label: string }[] = [
  { route: 'deduct', label: '공제 정리' },
  { route: 'record', label: '방 상태 기록' },
  { route: 'lawyer', label: '변호사 찾아보기' },
  { route: 'help', label: '상담 기관' },
  { route: 'cert', label: '내용증명' },
]

function Footer() {
  const { route } = useRoute()
  const current = (r: Route) => (route === r ? 'page' : undefined)
  return (
    <footer className="footer">
      <div className="container">
        <nav className="footer-links" aria-label="바닥글 메뉴">
          <ul>
            <li>
              <a className="footer-privacy" href={hrefOf('privacy')} aria-current={current('privacy')}>
                개인정보 처리방침
              </a>
            </li>
            <li>
              <a href={hrefOf('event')} aria-current={current('event')}>
                이벤트
              </a>
            </li>
            <li>
              <a href={COMPANY.repoUrl} target="_blank" rel="noopener noreferrer">
                GitHub 저장소<span className="shell-sr"> (새 창)</span>
                <IconExternal className="footer-ext" />
              </a>
            </li>
          </ul>
        </nav>

        <div className="footer-grid">
          <div className="footer-about">
            <p className="footer-brand">
              <HouseMark size={22} />
              보증금 지킴이
            </p>
            <p className="footer-desc">퇴실 공제 통보를 받은 자취생을 위한 공제 내역 정리·근거 문의·방 상태 기록 서비스</p>
          </div>

          <section className="footer-cs" aria-labelledby="footer-cs-title">
            <h2 id="footer-cs-title" className="footer-cs-title">
              고객센터
            </h2>
            <a className="footer-cs-link" href={COMPANY.contactUrl} target="_blank" rel="noopener noreferrer">
              <IconChat />
              <span>
                {COMPANY.contactLabel}
                <span className="shell-sr"> (새 창)</span>
              </span>
              <IconExternal className="footer-ext" />
            </a>
            <p className="footer-cs-note">{COMPANY.contactNote}</p>
          </section>
        </div>

        <section className="footer-biz-sec" aria-labelledby="footer-biz-title">
          <h2 id="footer-biz-title" className="footer-biz-title">
            사업자 정보
          </h2>
          <dl className="footer-biz">
            {BIZ_ROWS.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>
                  {r.value}
                  {r.note && <span className="footer-biz-note">{r.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="footer-legal">
          <p>보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않아요.</p>
          <p>
            보증금 지킴이는 민간 학생 팀의 서비스이며 정부·공공기관 서비스가 아니고, 정보보호 관련 인증을 받지 않았어요. AI는 공제 내역을 정리만
            하고 법률 판단은 하지 않아요.
          </p>
        </div>

        <ServiceMarks variant="dark" />
        <div className="footer-comply-area">
          <nav className="footer-svc" aria-labelledby="footer-svc-title">
            <h2 id="footer-svc-title" className="footer-svc-title">
              서비스 메뉴
            </h2>
            <ul>
              {FOOTER_MENU.map((m) => (
                <li key={m.route}>
                  <a href={hrefOf(m.route)} aria-current={current(m.route)}>
                    {m.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <FooterCompliance />
        </div>
        <p className="footer-copy">© 2026 보증금 지킴이 팀 · KOOKMIN AI BUILDER CHALLENGE 2026 출품작</p>
      </div>
    </footer>
  )
}

/* ── 앱 ─────────────────────────────────────────────────────────────── */

export default function App() {
  return (
    <StoreProvider>
      <div className="app">
        <a
          className="skip-link"
          href="#main"
          onClick={(e) => {
            // 해시 라우팅이라 #main 으로 이동하지 않고 본문에 포커스만 옮긴다
            e.preventDefault()
            document.getElementById('main')?.focus()
          }}
        >
          본문 바로가기
        </a>
        <Header />
        <main className="main" id="main" tabIndex={-1}>
          <Screen />
        </main>
        <Footer />
      </div>
      {/* 첫 화면 레이어 팝업 — 포털이라 위치 무관, 한 번만 마운트 */}
      <PromoPopup />
    </StoreProvider>
  )
}
