import ServiceGuide from '../components/home/ServiceGuide'
import { TaskIcon, type TaskIconName } from '../components/home/icons'
import { COMPANY } from '../data/company'
import { hrefOf, type Route } from '../router'
import '../styles/home.css'
import '../styles/support.css'

/*
 * 고객센터 (#/support) — 목차 → 업무별 안내(첫 화면에서 옮겨 옴, ServiceGuide 재사용) → 이용 안내(첫 화면에서 옮겨 옴) → 문의하기 → 자주 찾는 곳
 * 문의는 company.ts 의 온라인 문의(GitHub 이슈) 하나뿐이다. 전화번호는 없다(지어내지 않음).
 * 해시 라우팅이라 목차는 #anchor 링크 대신 스크롤 + 포커스 이동 버튼.
 */

const TOC: { id: string; label: string }[] = [
  { id: 'sp-guide', label: '업무별 안내' },
  { id: 'sp-notes', label: '이용 안내' },
  { id: 'sp-contact', label: '문의하기' },
  { id: 'sp-links', label: '자주 찾는 곳' },
]

/* 이용 안내 — 정보 제공 도구 · AI 사용 고지 · 무료/유료 (첫 화면에서 옮겨 옴) */
const NOTES = [
  { title: '정보 제공 도구', body: '보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다.' },
  { title: 'AI 사용 안내', body: '공제 문자 정리에만 생성형 AI를 사용하고, AI가 정리한 결과에는 AI 표시를 붙여요. 다른 업무는 AI를 쓰지 않아요.' },
  {
    title: '무료 / 유료',
    body: '공제 정리·참고 자료·문의 문자·변호사 조건 추천(가상 프로필 시연)은 무료예요. 방 상태 기록북(4,900원)과 내용증명 서식 PDF(2,900원)는 유료 상품 가설이고, 결제는 아직 연결하지 않았어요.',
  },
]

const LINKS: { route: Route; icon: TaskIconName; label: string; desc: string }[] = [
  { route: 'privacy', icon: 'lock', label: '개인정보 처리방침', desc: '어떤 정보를 어디에 얼마나 두는지' },
  { route: 'help', icon: 'building', label: '무료 상담 기관', desc: '무료 법률상담 창구와 공식 변호사 검색' },
  { route: 'signup', icon: 'person', label: '회원가입·내 계정', desc: '가입하거나 내 계정 정보를 확인해요' },
]

/** 화면 안의 요소로 이동 — 해시 라우팅이라 #anchor 링크 대신 스크롤 + 포커스 이동 */
function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

/* 말풍선 (온라인 문의) · 새 창 — 장식용 선 아이콘 */
function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 5h16v11h-9l-4.5 3.5V16H4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </svg>
  )
}

function IconExternal() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9.5 9.5" />
      <path d="M19 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.5" />
    </svg>
  )
}

export default function Support() {
  return (
    <div className="sp">
      <header className="sp-head">
        <h1>고객센터</h1>
        <p className="sp-lead">업무별 안내와 이용 안내를 보고, 궁금한 점은 온라인으로 문의해 주세요.</p>
      </header>

      <nav className="sp-toc" aria-label="이 화면 목차">
        <ul>
          {TOC.map((t) => (
            <li key={t.id}>
              <button type="button" className="btn ghost" onClick={() => jumpTo(t.id)}>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <ServiceGuide id="sp-guide" titleId="sp-guide-title" />

      <section id="sp-notes" className="sp-sec" tabIndex={-1} aria-labelledby="sp-notes-title">
        <div className="section-head">
          <h2 id="sp-notes-title">이용 안내</h2>
        </div>
        <ul className="notice-list">
          {NOTES.map((nt) => (
            <li key={nt.title} className="notice">
              <strong>{nt.title}</strong>
              <span>{nt.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="sp-contact" className="sp-sec" tabIndex={-1} aria-labelledby="sp-contact-title">
        <div className="section-head">
          <h2 id="sp-contact-title">문의하기</h2>
        </div>
        <div className="card sp-contact">
          <a className="sp-contact-link" href={COMPANY.contactUrl} target="_blank" rel="noopener noreferrer">
            <span className="sp-contact-icon">
              <IconChat />
            </span>
            <span>
              {COMPANY.contactLabel}
              <span className="shell-sr"> (새 창)</span>
            </span>
            <IconExternal />
          </a>
          <p className="sp-contact-note">{COMPANY.contactNote}</p>
        </div>
      </section>

      <section id="sp-links" className="sp-sec" tabIndex={-1} aria-labelledby="sp-links-title">
        <div className="section-head">
          <h2 id="sp-links-title">자주 찾는 곳</h2>
        </div>
        <ul className="sp-links">
          {LINKS.map((l) => (
            <li key={l.route}>
              <a className="sp-link card" href={hrefOf(l.route)}>
                <span className="sp-link-icon">
                  <TaskIcon name={l.icon} size={20} />
                </span>
                <span className="sp-link-text">
                  <b>{l.label}</b>
                  <span className="sp-link-desc">{l.desc}</span>
                </span>
                <span className="sp-link-arrow" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
