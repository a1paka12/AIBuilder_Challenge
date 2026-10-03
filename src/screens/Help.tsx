import type { ReactNode } from 'react'
import { go } from '../router'
import { AGENCIES, AGENCIES_CHECKED_AT, AGENCY_KIND_LABEL, formatCheckedAt, type Agency } from '../data/agencies'
import '../styles/help.css'

/* ── 문구 ───────────────────────────────────────────── */

const CONSULT_CASES = [
  '특약에 해당 항목이 적혀 있다',
  '이미 집주인과 다툼이 커졌다',
  '공제 금액이 크다',
  '사진만으로는 손상 원인을 설명하기 어렵다',
]

interface Step {
  title: string
  desc: string
  action: ReactNode
}

/* ── 작은 도우미 ───────────────────────────────────── */

/** 화면 안의 요소로 이동 (해시 라우팅이라 #anchor 링크 대신 스크롤 + 포커스 이동) */
function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/* ── 선 아이콘 (장식용, aria-hidden). 도장·방패·문장 같은 인증 모양은 쓰지 않는다 ── */

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.3 4.3L19 7" />
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

/* 키 비주얼: 기관 건물에 묻고(물음표 말풍선) 정리된 답을 받는(문서 말풍선) 모습. 순수 SVG 선 그림, 로고·사진 없음. */
function HelpArt() {
  return (
    <div className="help-hero-art">
      <svg viewBox="0 0 240 160" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {/* 바닥선 */}
        <path d="M14 140h114" stroke="var(--line-strong)" />
        {/* 기관 건물 */}
        <rect x="24" y="52" width="92" height="88" rx="3" fill="#fff" />
        <path d="M18 52h104" />
        <path d="M36 42h68l6 10H30z" fill="var(--primary-soft)" />
        <rect x="36" y="64" width="16" height="14" rx="2" fill="var(--primary-soft)" />
        <rect x="62" y="64" width="16" height="14" rx="2" fill="var(--primary-soft)" />
        <rect x="88" y="64" width="16" height="14" rx="2" fill="var(--primary-soft)" />
        <rect x="36" y="88" width="16" height="14" rx="2" fill="var(--primary-soft)" />
        <rect x="62" y="88" width="16" height="14" rx="2" fill="var(--primary-soft)" />
        <rect x="88" y="88" width="16" height="14" rx="2" fill="var(--primary-soft)" />
        <path d="M58 140v-24a12 12 0 0 1 24 0v24" fill="#fff" />
        {/* 기관의 답(정리된 문서) 말풍선 */}
        <path d="M132 34h86a8 8 0 0 1 8 8v44a8 8 0 0 1-8 8h-62l-14 12v-12h-10a8 8 0 0 1-8-8V42a8 8 0 0 1 8-8z" fill="#fff" />
        <path d="M146 52h58M146 64h58M146 76h34" stroke="var(--line-strong)" />
        <rect x="190" y="70" width="14" height="14" rx="2" fill="var(--primary)" stroke="var(--primary)" />
        <path d="M193 77l3.5 3.5 5-6" stroke="#fff" />
        {/* 내 질문 말풍선 */}
        <path d="M150 112h60a7 7 0 0 1 7 7v18a7 7 0 0 1-7 7h-36l-12 10v-10h-12a7 7 0 0 1-7-7v-18a7 7 0 0 1 7-7z" fill="var(--primary)" stroke="var(--primary)" />
        <text x="180" y="135" textAnchor="middle" fontSize="19" fontWeight="800" fill="#fff" stroke="none">
          ?
        </text>
      </svg>
    </div>
  )
}

/* ── 기관 카드 ─────────────────────────────────────── */

function AgencyCard({ a }: { a: Agency }) {
  const isLawyer = a.kind === 'lawyer'
  return (
    <li id={`agency-${a.id}`} className={`card help-agency${isLawyer ? ' is-lawyer' : ''}`} tabIndex={-1}>
      <div className="help-agency-head">
        <h3 className="help-agency-name">{a.name}</h3>
        <span className="badge">{AGENCY_KIND_LABEL[a.kind]}</span>
      </div>
      <dl className="help-agency-rows">
        <div>
          <dt>무엇을</dt>
          <dd>{a.what}</dd>
        </div>
        <div>
          <dt>어떻게</dt>
          <dd>{a.how}</dd>
        </div>
        {a.cost && (
          <div>
            <dt>비용</dt>
            <dd>{a.cost}</dd>
          </div>
        )}
      </dl>
      {a.note && <p className="help-agency-note small">{a.note}</p>}
      <div className="help-agency-foot">
        <a className="btn" href={a.url} target="_blank" rel="noopener noreferrer">
          {isLawyer ? '대한변협 변호사 검색' : '공식 홈페이지'}
          <span className="help-sr-only"> (새 창)</span>
          <IconExternal />
        </a>
        <span className="help-agency-domain small muted">
          {host(a.url)} · 확인일 {formatCheckedAt(a.checkedAt)}
        </span>
      </div>
    </li>
  )
}

/* ── 화면 ─────────────────────────────────────────── */

export default function Help() {
  const steps: Step[] = [
    {
      title: '집주인에게 근거 문의',
      desc: '공제 항목과 금액의 근거를 문자로 물어봐요. 문의 문자 서식은 공제 정리 화면에서 만들 수 있어요.',
      action: (
        <button type="button" className="btn primary" onClick={() => go('deduct')}>
          문의 문자 서식 만들기
        </button>
      ),
    },
    {
      title: '무료 상담 기관에 묻기',
      desc: '대한법률구조공단(전화 132), 서울시 마을변호사 같은 무료 상담 창구나 학교 법률상담센터에 물어봐요.',
      action: (
        <button type="button" className="btn ghost" onClick={() => jumpTo('help-agencies')}>
          상담 기관 목록 보기
        </button>
      ),
    },
    {
      title: '분쟁조정 신청',
      desc: '답이 없거나 의견이 계속 다르면 주택임대차분쟁조정위원회에 조정을 신청할 수 있어요.',
      action: (
        <button type="button" className="btn ghost" onClick={() => jumpTo('agency-hldcc')}>
          분쟁조정위원회 안내 보기
        </button>
      ),
    },
    {
      title: '변호사 상담',
      desc: '변호사가 필요하면 대한변호사협회 공식 검색에서 찾거나, 상담 조건으로 후보를 먼저 볼 수 있어요. 변호사 조건 추천은 무료이고, 고른 조건으로만 정렬한 가상 프로필 시연이에요. 연락은 직접 해요.',
      action: (
        <>
          <button type="button" className="btn ghost" onClick={() => go('lawyer')}>
            조건으로 변호사 후보 보기
          </button>
          <button type="button" className="btn ghost" onClick={() => jumpTo('agency-koreanbar')}>
            변호사 검색 안내 보기
          </button>
        </>
      ),
    },
  ]

  return (
    <section className="help">
      <nav className="help-crumb" aria-label="현재 위치">
        <ol>
          <li>
            <button type="button" className="linklike" onClick={() => go('home')}>
              처음
            </button>
          </li>
          <li aria-current="page">무료 법률상담 기관·변호사 찾기</li>
        </ol>
      </nav>

      {/* 키 비주얼 */}
      <div className="help-hero">
        <div className="help-hero-body">
          <p className="eyebrow">혼자 묻기 어렵다면</p>
          <h1>무료 법률상담 기관·변호사 찾기</h1>
          <p className="lead">보증금 공제가 이해되지 않을 때, 혼자 묻기 어렵다면 아래 기관에 먼저 물어보세요.</p>
          <div className="help-hero-actions">
            <button type="button" className="btn primary" onClick={() => jumpTo('help-agencies')}>
              상담 기관 바로 보기
            </button>
            <button type="button" className="btn ghost" onClick={() => go('deduct')}>
              공제 정리로 돌아가기
            </button>
          </div>
        </div>
        <HelpArt />
      </div>

      {/* 운영 원칙 고지 */}
      <div className="notice help-notice" role="note">
        <strong>보증금 지킴이의 운영 원칙</strong>
        <p>보증금 지킴이는 특정 변호사를 소개·알선하지 않고 어떤 대가(소개비·수수료·광고비)도 받지 않아요. 변호사 조건 추천은 무료이고, 고른 조건으로만 정렬한 가상 프로필 시연이에요. 연락은 직접 해요. 법률 판단은 하지 않아요.</p>
        <p className="small muted help-law">(변호사법 제34조·제109조를 고려한 운영 원칙)</p>
      </div>

      {/* 이럴 땐 상담 */}
      <section aria-labelledby="help-cases-title">
        <div className="section-head">
          <h2 id="help-cases-title">이럴 땐 상담을 받아 보세요</h2>
          <p className="muted small">하나라도 해당되면 먼저 상담 창구에 물어보세요.</p>
        </div>
        <ul className="help-cases">
          {CONSULT_CASES.map((c) => (
            <li key={c} className="help-case">
              <span className="help-case-icon">
                <IconCheck />
              </span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 어디에 물어볼까요 */}
      <section aria-labelledby="help-steps-title">
        <div className="section-head">
          <h2 id="help-steps-title">어디에 물어볼까요</h2>
          <p className="muted small">일반적인 흐름이에요. 상황에 따라 순서가 달라질 수 있어요.</p>
        </div>
        <ol className="help-steps">
          {steps.map((s, i) => (
            <li key={s.title} className="help-step">
              <span className="help-step-no" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="help-step-title">{s.title}</h3>
              <p className="help-step-desc">{s.desc}</p>
              <div className="help-step-action">{s.action}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* 기관 카드 */}
      <section id="help-agencies" className="help-agencies-sec" aria-labelledby="help-agencies-title" tabIndex={-1}>
        <div className="section-head">
          <h2 id="help-agencies-title">무료 상담 기관·공식 링크</h2>
          <p className="muted small">공식 홈페이지에서 확인한 내용만 적었어요. 자세한 조건은 각 홈페이지에서 확인해 주세요.</p>
        </div>
        <ul className="help-agencies">
          {AGENCIES.map((a) => (
            <AgencyCard key={a.id} a={a} />
          ))}
        </ul>
        <p className="help-checked">
          <span>확인일 {formatCheckedAt(AGENCIES_CHECKED_AT)}</span>
          <span>링크는 새 창에서 열려요. 사건 정보를 다른 곳에 보내지 않아요.</span>
        </p>
      </section>

      {/* 다른 업무 */}
      <section aria-labelledby="help-more-title">
        <div className="section-head">
          <h2 id="help-more-title">다른 업무 보기</h2>
        </div>
        <ul className="help-more">
          <li>
            <button type="button" className="btn" onClick={() => go('deduct')}>
              <span>공제 메시지 정리</span>
              <small>항목·금액·원문 정리와 문의 문자</small>
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => go('record')}>
              <span>방 상태 기록</span>
              <small>원본은 안 보내요 · 로그인 저장 시 가린 처리본만, 아니면 지문만</small>
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => go('cert')}>
              <span>내용증명 빈칸 서식</span>
              <small>입력한 내용이 그대로 들어가요</small>
            </button>
          </li>
          <li>
            <button type="button" className="btn" onClick={() => go('event')}>
              <span>이벤트</span>
              <small>출시 기념 설문 이벤트</small>
            </button>
          </li>
        </ul>
      </section>
    </section>
  )
}
