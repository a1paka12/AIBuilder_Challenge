import { go } from '../router'
import Survey from '../components/Survey'
import { usePromoUnlocked } from '../lib/promo'
import '../styles/event.css'

/*
 * 이벤트 상세 (#/event) — 은행 누리집 이벤트 상세 꼴
 * 출시 기념 · 30초 설문 참여 이벤트: 설문에 답한 기기·브라우저에서 기록북 범위(사진 30장)까지 체험하게 한다(결제 미연결 데모 기간).
 * 설문 응답 성공 시 unlockPromo() 는 Survey.tsx 안에서 호출한다(통합 단계). 이 화면은 usePromoUnlocked() 로 결과만 보여 준다.
 * 금지: 지어낸 숫자·후기, "N원 상당", 판단·보장 문구, 특정 변호사 소개·알선.
 */

const STEPS = [
  '아래 ‘30초 현장 설문’에서 보기를 고르고 [응답 보내기]를 눌러요.',
  '‘응답해 주셔서 고마워요’가 보이면 이 기기·브라우저에 혜택이 바로 적용돼요.',
  '[방 상태 기록]에서 사진을 3장째부터 기록북 범위(사진 30장)까지 추가하고, 기록북 PDF를 만들어요.',
]

const NOTES = [
  '결제를 아직 연결하지 않은 데모 기간의 혜택이에요. 정식 결제가 열리면 안내가 바뀔 수 있어요.',
  '혜택은 설문에 답한 기기·브라우저 기준이에요. 다른 기기, 사생활(시크릿) 모드, 브라우저 데이터를 지운 뒤에는 다시 참여해야 해요.',
  '설문은 이름·연락처를 묻지 않고, 응답은 익명으로 집계해 서비스 근거로만 써요.',
  '같은 기기에서 다시 응답하면 1번으로 처리돼요. 답은 고칠 수 있어요.',
  '이벤트 내용이 바뀌거나 끝나면 이 화면에 먼저 알려 드려요.',
]

const OTHER_TASKS: { route: 'deduct' | 'record' | 'help'; title: string; desc: string }[] = [
  { route: 'deduct', title: '공제 메시지 정리', desc: '집주인 문자를 붙여 넣으면 항목·금액·원문을 표로' },
  { route: 'record', title: '방 상태 기록', desc: '원본은 안 보내요 · 로그인 저장 시 가린 처리본만 보관, 아니면 지문만' },
  { route: 'help', title: '상담 기관 안내', desc: '무료 법률상담 기관 · 대한변협 공식 변호사 검색' },
]

/* 키 비주얼 배너 그림 — 집 → 휴대폰 설문 → 쌓이는 방 사진 → 확인 (장식, aria-hidden) */
function EventBanner() {
  return (
    <svg viewBox="0 0 640 180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="92" cy="92" r="62" fill="currentColor" opacity="0.08" stroke="none" />
      <circle cx="420" cy="90" r="70" fill="currentColor" opacity="0.08" stroke="none" />
      {/* 집 */}
      <path d="M48 96l44-38 44 38" />
      <rect x="60" y="92" width="64" height="48" fill="#fff" />
      <rect x="84" y="112" width="16" height="28" rx="2" fill="#fff" />
      <rect x="66" y="100" width="12" height="10" fill="#fff" />
      {/* 휴대폰 속 30초 설문 */}
      <rect x="196" y="36" width="70" height="108" rx="10" fill="#fff" />
      <path d="M222 44h18" />
      <circle cx="212" cy="66" r="5" fill="#fff" />
      <path d="M223 66h30" />
      <circle cx="212" cy="86" r="5" fill="#fff" />
      <path d="M223 86h30" />
      <circle cx="212" cy="106" r="5" fill="currentColor" />
      <path d="M223 106h30" />
      <rect x="208" y="122" width="46" height="12" rx="3" fill="currentColor" stroke="none" />
      {/* 집 → 휴대폰 */}
      <path d="M144 92h36" />
      <path d="M171 82l10 10-10 10" />
      {/* 휴대폰 → 사진 */}
      <path d="M286 90h50" />
      <path d="M327 80l10 10-10 10" />
      {/* 쌓이는 방 사진 */}
      <rect x="372" y="46" width="96" height="72" rx="6" fill="#fff" opacity="0.7" transform="rotate(-8 420 82)" />
      <rect x="372" y="46" width="96" height="72" rx="6" fill="#fff" opacity="0.85" transform="rotate(5 420 82)" />
      <rect x="372" y="52" width="96" height="72" rx="6" fill="#fff" />
      <circle cx="392" cy="70" r="6" />
      <path d="M378 118l24-26 16 14 14-16 30 28" fill="currentColor" fillOpacity="0.15" />
      <circle cx="468" cy="52" r="14" fill="currentColor" stroke="none" />
      <path d="M468 45v14M461 52h14" stroke="#fff" strokeWidth="2.5" />
      {/* 사진 → 확인 */}
      <path d="M490 90h30" />
      <path d="M511 80l10 10-10 10" />
      <circle cx="568" cy="90" r="30" fill="#fff" />
      <path d="M553 90l11 11 21-22" strokeWidth="4" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function Event() {
  const unlocked = usePromoUnlocked()

  return (
    <section className="event">
      <header className="event-head">
        <p className="event-status">
          <span className="badge ok">진행 중</span>
          <span className="small muted">2026. 10. 3.(토)부터</span>
        </p>
        <h1>출시 기념 · 30초 설문 참여 이벤트</h1>
        <p className="event-summary">
          퇴실 경험을 묻는 30초 설문에 답하면, 이 기기·브라우저에서 기록북 범위(사진 30장)까지 체험할 수 있어요. 이름·연락처는 묻지 않아요.
        </p>
      </header>

      {/* 혜택 적용 안내 — 설문 응답 성공(unlockPromo) 즉시 나타난다 */}
      <div className="event-done-wrap" role="status" aria-live="polite">
        {unlocked && (
          <div className="notice event-done">
            <strong>혜택이 적용됐어요</strong>
            <span>이 기기·브라우저에서 기록북 사진을 3장째부터 기록북 범위(사진 30장)까지 유료 안내 없이 추가하고, 기록북 PDF를 만들 수 있어요.</span>
            <div className="event-done-actions">
              <button type="button" className="btn primary" onClick={() => go('record')}>
                기록북 만들러 가기
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="event-banner">
        <div className="event-banner-text">
          <p className="event-banner-kicker">참여 혜택</p>
          <p className="event-banner-title">설문은 30초, 기록북 범위(사진 30장)까지 체험</p>
          <p className="event-banner-sub small">이 기기·브라우저에서 · 결제 연결 전 체험</p>
        </div>
        <EventBanner />
      </div>

      <div className="card event-card">
        <h2>이벤트 안내</h2>
        <dl className="event-dl">
          <div>
            <dt>기간</dt>
            <dd>2026. 10. 3.(토)부터 · 끝날 때는 이 화면에 미리 알려 드려요</dd>
          </div>
          <div>
            <dt>대상</dt>
            <dd>보증금 지킴이를 쓰는 누구나</dd>
          </div>
          <div>
            <dt>혜택</dt>
            <dd>
              설문에 답한 기기·브라우저에서 기록북 사진 3장째부터 나오는 유료 안내 없이 기록북 범위(사진 30장)까지 추가하고 기록북 PDF를 만들 수 있어요(정식 결제 전 체험)
            </dd>
          </div>
          <div>
            <dt>참여 방법</dt>
            <dd>
              <ol className="event-steps">
                {STEPS.map((s, i) => (
                  <li key={s}>
                    <b aria-hidden="true">{i + 1}</b>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </dd>
          </div>
        </dl>
      </div>

      <div className="section-head">
        <h2>바로 참여하기</h2>
        <p className="muted small">아래 설문에 답하면 바로 적용돼요.</p>
      </div>
      <Survey />

      <div className="card event-card">
        <h2>유의사항</h2>
        <ul className="event-notes">
          {NOTES.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="section-head">
        <h2>다른 업무 보기</h2>
      </div>
      <ul className="event-links">
        {OTHER_TASKS.map((t) => (
          <li key={t.route}>
            <button type="button" className="event-link" onClick={() => go(t.route)}>
              <span className="event-link-text">
                <b>{t.title}</b>
                <span>{t.desc}</span>
              </span>
              <ChevronRight />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
