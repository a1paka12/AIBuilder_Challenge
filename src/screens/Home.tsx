import HeroPreview from '../components/home/HeroPreview'
import ServiceGuide from '../components/home/ServiceGuide'
import EventBand from '../components/home/EventBand'
import { TaskIcon } from '../components/home/icons'
import { go } from '../router'
import TrustBadges from '../components/TrustBadges'
import ServiceMarks from '../components/ServiceMarks'
import Survey from '../components/Survey'
import '../styles/home.css'

/*
 * 첫 화면 (#/) — 은행·공공 누리집 첫 화면 꼴
 * 메인 비주얼(제목 · 보조 문장 · 버튼 4개 · 공제 문자→정리 표 그림) → 서비스 원칙 마크 줄 → 이렇게 진행돼요(4단계, AI/내가)
 * → 업무별 안내(무엇을 / AI가 하는 일 / 내가 하는 일 / 비용 / 자세히 보기) → 이용 안내 → 이벤트 띠 → 보증금 지킴이의 약속 → 30초 현장 설문
 * 업무 바로가기는 모든 화면 공통으로 헤더 바로 아래 아이콘 줄(App.tsx TaskNav)에 있다.
 * h1 은 메인 비주얼 제목 하나. 레이어 팝업(PromoPopup)은 App 에서 route==='home' 일 때만 띄운다(이 파일이 아님).
 * 자동 넘김 캐러셀 없음(정적 한 장). 숫자는 PRD 예시·가격 가설·/api/stats 실제 값만.
 */

const FACTS = ['로그인 없이도 바로 시작', 'AI는 정리만, 판단은 하지 않아요', '붙여 넣은 문자는 서버에 저장하지 않아요']

const STEPS: { who: 'me' | 'ai'; title: string; desc: string }[] = [
  { who: 'me', title: '공제 문자 붙여넣기', desc: '집주인이 보낸 문자를 그대로 붙여 넣어요. 이름·전화번호·계좌번호는 지우고요.' },
  { who: 'ai', title: 'AI가 항목·금액·원문 정리', desc: '항목·청구액·원문 인용을 표로 옮겨 적어요. 맞는지는 판단하지 않아요.' },
  { who: 'me', title: '확인하고 물어볼 항목 체크', desc: '표를 원문과 견주어 확인한 뒤, 근거를 물어볼 항목만 골라요.' },
  { who: 'me', title: '문의 문자 복사', desc: '고정 서식의 문의 문자를 복사해 집주인에게 직접 보내요.' },
]

const NOTES = [
  { title: '정보 제공 도구', body: '보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다.' },
  { title: 'AI 사용 안내', body: '공제 문자 정리에만 생성형 AI를 사용하고, AI가 정리한 결과에는 AI 표시를 붙여요. 다른 업무는 AI를 쓰지 않아요.' },
  {
    title: '무료 / 유료',
    body: '공제 정리·참고 자료·문의 문자·변호사 조건 추천(가상 프로필 시연)은 무료예요. 방 상태 기록북(4,900원)과 내용증명 서식 PDF(2,900원)는 유료 상품 가설이고, 결제는 아직 연결하지 않았어요.',
  },
]

/** 화면 안의 요소로 이동 — 해시 라우팅이라 #anchor 링크 대신 스크롤 + 포커스 이동 */
function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

export default function Home() {
  return (
    <div className="home">
      {/* 1) 메인 비주얼 — 정적 한 장 */}
      <section className="home-hero" aria-labelledby="home-hero-title">
        <div className="home-hero-body">
          <p className="eyebrow">퇴실 공제 통보를 받은 자취생을 위한</p>
          <h1 id="home-hero-title">
            집주인이 보낸 공제 문자,
            <br />
            항목별로 정리해 드려요
          </h1>
          <p className="home-lead">
            문자를 붙여 넣으면 AI가 항목·금액·원문을 표로 옮겨 적어요. 공제가 맞는지는 판단하지 않아요. 어떤 항목을 물어볼지는 내가 고르고, 근거를
            묻는 문자는 복사해서 직접 보내요.
          </p>
          <div className="home-cta">
            <button type="button" className="btn primary home-cta-main" onClick={() => go('deduct')}>
              공제 문자 정리하기
            </button>
            <button type="button" className="btn" onClick={() => go('deduct', { sample: '1' })}>
              예시로 먼저 보기
            </button>
            <button type="button" className="btn" onClick={() => go('record')}>
              방 사진 기록하기
            </button>
            <button type="button" className="btn" onClick={() => go('lawyer')}>
              변호사 찾아보기
            </button>
          </div>
          <ul className="home-facts" aria-label="이용 조건">
            {FACTS.map((f) => (
              <li key={f}>
                <span className="home-fact-icon">
                  <TaskIcon name="check" size={14} strokeWidth={2.4} />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="home-hero-visual">
          <HeroPreview />
        </div>
      </section>

      <ServiceMarks variant="light" />

      {/* 2) 이렇게 진행돼요 — 진행 4단계 (업무 바로가기는 헤더 아래 아이콘 줄로 옮김) */}
      <section className="home-steps-sec" aria-labelledby="home-steps-title">
        <div className="section-head">
          <h2 id="home-steps-title">이렇게 진행돼요</h2>
          <p className="muted small">공제 문자만 있으면 돼요. AI가 하는 일과 내가 하는 일을 나눴어요.</p>
        </div>
        <ol className="home-steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="home-step">
              <span className="home-step-top">
                <span className="home-step-no" aria-hidden="true">
                  {i + 1}
                </span>
                <span className={`home-step-who is-${s.who}`}>{s.who === 'ai' ? 'AI가 해요' : '내가 해요'}</span>
              </span>
              <b className="home-step-title">{s.title}</b>
              <span className="home-step-desc">{s.desc}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 3) 아래 상세 — 업무별 안내 */}
      <ServiceGuide />

      {/* 이용 안내 (정보 제공 도구 · AI 사용 고지 · 무료/유료) */}
      <section className="home-notes" aria-labelledby="home-notes-title">
        <div className="section-head">
          <h2 id="home-notes-title">이용 안내</h2>
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

      {/* 4) 이벤트 띠 → 약속 → 설문 */}
      <EventBand onSurvey={() => jumpTo('home-survey')} />

      <TrustBadges />

      <div id="home-survey" className="home-survey" tabIndex={-1}>
        <Survey />
      </div>
    </div>
  )
}
