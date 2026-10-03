import { go } from '../router'
import '../styles/pages.css'

export default function Privacy() {
  return (
    <section className="page privacy">
      <h1>개인정보 처리방침</h1>
      <p className="muted">
        보증금 지킴이(국민대 AI 빌더 챌린지 2026 데모)는 서비스에 꼭 필요한 정보만 처리하고, 로그인·회원가입을 받지 않습니다.
      </p>

      <article className="card policy">
        <section>
          <h2>1. 처리 목적</h2>
          <ul>
            <li>공제 내역 정리: 사용자가 붙여 넣은 공제 메시지에서 항목·청구액·원문 인용을 표로 정리합니다.</li>
            <li>사진 지문 서버 기록: 방 사진 파일의 지문(SHA-256)과 서버가 받은 시각을 기록해 "이 시각에 이 파일이 있었다"는 기록을 남깁니다.</li>
          </ul>
        </section>

        <section>
          <h2>2. 처리 항목</h2>
          <ul>
            <li>사용자가 붙여 넣은 공제 메시지 텍스트</li>
            <li>사진 파일 지문(SHA-256)과 서버 기록 시각. 사진 파일 자체는 받지 않습니다.</li>
            <li>이름·주소·계좌 등 문자·내용증명 입력값은 브라우저 안에서만 쓰고 서버로 보내지 않습니다.</li>
            <li>요청 속도 제한을 위한 접속 IP 주소(서버 메모리에서 1분 동안만 쓰고 파일에 저장하지 않습니다).</li>
          </ul>
        </section>

        <section>
          <h2>3. 보유·파기</h2>
          <ul>
            <li>공제 메시지 텍스트는 정리 응답 직후 서버에서 버리고 저장·로그하지 않습니다.</li>
            <li>사진 지문 기록은 데모 운영 기간 동안 보관한 뒤 삭제합니다.</li>
          </ul>
        </section>

        <section>
          <h2>4. 국외 이전</h2>
          <p>공제 내역 정리를 위해 아래와 같이 개인정보가 포함될 수 있는 텍스트를 국외로 이전합니다.</p>
          <div className="policy-table-wrap">
            <table className="policy-table">
              <tbody>
                <tr>
                  <th scope="row">받는 자</th>
                  <td>OpenAI, L.L.C.</td>
                </tr>
                <tr>
                  <th scope="row">국가</th>
                  <td>미국</td>
                </tr>
                <tr>
                  <th scope="row">항목</th>
                  <td>공제 메시지 텍스트(서버에서 전화번호·계좌번호·주민등록번호·이메일 패턴을 가린 뒤 전송)</td>
                </tr>
                <tr>
                  <th scope="row">시기·방법</th>
                  <td>정리 요청 시 암호화 통신</td>
                </tr>
                <tr>
                  <th scope="row">목적</th>
                  <td>정리 결과 생성</td>
                </tr>
                <tr>
                  <th scope="row">보유</th>
                  <td>제공사 정책에 따름</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="policy-callout">이름 등 개인정보는 지우고 붙여 넣어 주세요.</p>
        </section>

        <section>
          <h2>5. 정보주체의 권리</h2>
          <ul>
            <li>브라우저에서 쓰는 데이터(공제 메시지, 정리 결과, 사진, 문자·내용증명 입력값)는 새로고침하면 사라집니다.</li>
            <li>
              처리 정지·삭제 등 문의는 보증금 지킴이 팀에게 해 주세요(
              <a href="https://github.com/a1paka12/AIBuilder_Challenge" target="_blank" rel="noreferrer">
                GitHub 저장소
              </a>
              ).
            </li>
          </ul>
        </section>

        <section>
          <h2>6. 안전성 확보 조치</h2>
          <ul>
            <li>AI API 키는 서버에만 두고 브라우저로 보내지 않습니다.</li>
            <li>모든 통신은 HTTPS로 암호화합니다.</li>
            <li>공제 메시지 본문은 서버 로그에 남기지 않습니다.</li>
            <li>요청 속도 제한으로 과도한 요청을 막습니다.</li>
          </ul>
        </section>

        <section>
          <h2>7. 개인정보 보호책임자</h2>
          <p>보증금 지킴이 팀(국민대 AI 빌더 챌린지 2026 데모)</p>
        </section>

        <section>
          <h2>8. 위치정보·쿠키·분석 도구</h2>
          <p>위치정보, 쿠키, 방문 분석 도구를 쓰지 않습니다.</p>
        </section>

        <p className="policy-date">시행일: 2026-10-03</p>
      </article>

      <div className="page-actions">
        <button type="button" className="btn" onClick={() => go('home')}>
          처음으로
        </button>
        <button type="button" className="btn ghost" onClick={() => go('pricing')}>
          가격 안내
        </button>
      </div>
    </section>
  )
}
