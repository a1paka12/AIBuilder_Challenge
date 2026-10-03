import type { CSSProperties } from 'react'

/*
 * 메인 비주얼 그림: 공제 문자 → AI 정리 표 → 내가 근거를 물어볼 금액 550,000원.
 * 순수 HTML/CSS 일러스트(장식)라 role="img" 하나로 읽힌다. 스타일(.hero-preview .hp-*)은 index.css 에 있다.
 * 숫자는 PRD 예시 메시지와 같다(지어낸 숫자 아님).
 */
const PREVIEW_ROWS = [
  { name: '청소비', amount: '150,000원', quote: '청소비 15만원', picked: false },
  { name: '도배', amount: '300,000원', quote: '도배 전체 30만원', picked: true },
  { name: '장판', amount: '250,000원', quote: '장판 25만원', picked: true },
  { name: '싱크대 시트지', amount: '50,000원', quote: '싱크대 시트지 5만원', picked: false },
  { name: '샷시 손잡이', amount: '30,000원', quote: '샷시 손잡이 3만원', picked: false },
]

export default function HeroPreview() {
  return (
    <div
      className="hero-preview"
      role="img"
      aria-label="예시: 집주인이 보낸 공제 메시지가 항목·청구액·원문 인용 표로 정리되고, 도배와 장판을 고르면 내가 근거를 물어볼 금액 550,000원이 표시되는 모습"
    >
      <div className="hp-msg">
        <div className="hp-msg-meta">
          <span className="hp-avatar" />
          <span className="hp-sender">집주인</span>
          <span className="hp-time">오후 2:13</span>
        </div>
        <p className="hp-bubble">
          퇴실 정산입니다. 청소비 15만원, 도배 전체 30만원, 장판 25만원, 싱크대 시트지 5만원, 샷시 손잡이 3만원입니다. 총 78만원을 공제하려고 합니다.
        </p>
      </div>

      <div className="hp-arrow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M12 4v16" />
          <path d="M6 14l6 6 6-6" />
        </svg>
        <span>AI가 항목·금액·원문을 정리</span>
      </div>

      <div className="hp-table">
        <div className="hp-table-title">
          <span>정리 결과</span>
          <span className="badge">AI</span>
          <span className="hp-sum">
            5개 항목 · 합계 <span className="num">780,000원</span>
          </span>
        </div>
        <div className="hp-tr hp-th">
          <span />
          <span>항목</span>
          <span className="hp-amt">청구액</span>
          <span>원문</span>
        </div>
        {PREVIEW_ROWS.map((r, i) => (
          <div key={r.name} className={`hp-tr${r.picked ? ' is-picked' : ''}`} style={{ '--i': i } as CSSProperties}>
            <span className="hp-check" />
            <span className="hp-name">{r.name}</span>
            <span className="hp-amt num">{r.amount}</span>
            <span className="hp-quote">“{r.quote}”</span>
          </div>
        ))}
        <div className="hp-foot">
          <span>내가 근거를 물어볼 금액</span>
          <b className="num">550,000원</b>
        </div>
      </div>
    </div>
  )
}
