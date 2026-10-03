import { go } from '../router'

export default function Home() {
  return (
    <section className="home">
      <div className="hero">
        <p className="eyebrow">퇴실 공제 통보를 받은 자취생을 위한</p>
        <h1>공제 통보 메시지 하나로,<br />물어볼 근거를 3분 만에.</h1>
        <p className="lead">
          집주인이 보낸 공제 메시지를 붙여 넣으면 AI가 항목과 금액을 원문 근거와 함께 표로 정리해요.
          어떤 항목을 물어볼지는 내가 고르고, 근거를 묻는 문자는 복사해서 직접 보내요.
        </p>
        <div className="cta-row">
          <button type="button" className="btn primary" onClick={() => go('deduct')}>공제 내역 정리하기</button>
          <button type="button" className="btn" onClick={() => go('record')}>방 상태 기록하기</button>
          <button type="button" className="btn ghost" onClick={() => go('deduct', { sample: '1' })}>예시로 해보기</button>
          <button type="button" className="btn ghost" onClick={() => go('pricing')}>가격 안내</button>
        </div>
      </div>

      <ul className="notice-list" aria-label="이용 안내">
        <li className="notice">
          <strong>정보 제공 도구</strong>
          <span>보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다.</span>
        </li>
        <li className="notice">
          <strong>AI 사용 안내</strong>
          <span>공제 내역 정리에 생성형 AI를 사용합니다.</span>
        </li>
        <li className="notice">
          <strong>무료 / 유료</strong>
          <span>공제 정리·참고 자료·문의 문자는 영구 무료예요. 방 상태 기록북(4,900원)과 내용증명 서식 PDF는 유료 상품이에요(결제는 아직 연결하지 않았어요).</span>
        </li>
      </ul>

      <div className="steps">
        <div className="step"><b>1</b><span>공제 메시지 붙여넣기</span></div>
        <div className="step"><b>2</b><span>AI가 항목·금액·원문 정리</span></div>
        <div className="step"><b>3</b><span>물어볼 항목은 내가 선택</span></div>
        <div className="step"><b>4</b><span>근거 문의 문자 복사</span></div>
      </div>
    </section>
  )
}
