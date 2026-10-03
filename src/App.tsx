import { StoreProvider } from './state'
import { go, useRoute } from './router'
import Home from './screens/Home'
import Deduct from './screens/Deduct'
import Record from './screens/Record'
import Cert from './screens/Cert'
import Pricing from './screens/Pricing'
import Privacy from './screens/Privacy'

function Screen() {
  const { route, query } = useRoute()
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
    default:
      return <Home />
  }
}

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

function Header() {
  const { route } = useRoute()
  const current = (r: string) => (route === r ? 'page' : undefined)
  return (
    <>
      <div className="utility-bar">
        <div className="container utility-inner">
          <p>민간 학생 팀 서비스 · 국민대 AI 빌더 챌린지 2026 출품작</p>
        </div>
      </div>
      <header className="topbar">
        <div className="container topbar-inner">
          <button type="button" className="brand" onClick={() => go('home')}>
            <HouseMark />
            <span className="brand-name">보증금 지킴이</span>
          </button>
          <nav className="topnav" aria-label="주 메뉴">
            <button type="button" aria-current={current('deduct')} onClick={() => go('deduct')}>공제 정리</button>
            <button type="button" aria-current={current('record')} onClick={() => go('record')}>방 상태 기록</button>
            <button type="button" aria-current={current('pricing')} onClick={() => go('pricing')}>가격</button>
          </nav>
        </div>
      </header>
    </>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-about">
            <p className="footer-brand">
              <HouseMark size={22} />
              보증금 지킴이
            </p>
            <p>퇴실 공제 통보를 받은 자취생을 위한 공제 내역 정리·근거 문의·방 상태 기록 서비스</p>
          </div>
          <nav className="footer-links" aria-label="바닥글 메뉴">
            <h2 className="footer-title">바로가기</h2>
            <ul>
              <li>
                <button type="button" className="linklike footer-privacy" onClick={() => go('privacy')}>개인정보 처리방침</button>
              </li>
              <li>
                <button type="button" className="linklike" onClick={() => go('pricing')}>가격 안내</button>
              </li>
              <li>
                <a href="/slides/" target="_blank" rel="noopener noreferrer">발표자료</a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="footer-legal">
          <p>보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다.</p>
          <p>보증금 지킴이는 민간 학생 팀의 서비스이며 정부·공공기관 서비스가 아니고, ISMS-P 등 인증을 받지 않았습니다.</p>
          <p className="footer-copy">© 2026 보증금 지킴이 · 국민대 AI 빌더 챌린지 2026 출품작</p>
        </div>
      </div>
    </footer>
  )
}

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
    </StoreProvider>
  )
}
