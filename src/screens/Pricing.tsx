import { go } from '../router'
import '../styles/pages.css'

interface Row {
  name: string
  price: string
  detail: string
  status?: string
}

const FREE: Row[] = [
  { name: '공제 정리', price: '무료', detail: '공제 메시지를 붙여 넣으면 항목·청구액·원문 인용을 표로 정리' },
  { name: '참고 자료', price: '무료', detail: '항목별 공개 자료 카드(원문 인용·범위 태그·출처·확인일)' },
  { name: '문의 문자', price: '무료', detail: '확인·체크한 항목의 근거를 묻는 문자 만들기·복사' },
  { name: '다음 단계 안내', price: '무료', detail: '키 반납 전 주의, 무료 상담 기관·변호사 검색 공식 링크' },
  { name: '기록북 사진 2장 체험', price: '무료', detail: '구역별 사진 기록·서버 기록·기록북 미리보기' },
]

const PAID: Row[] = [
  { name: '방 상태 기록북', price: '4,900원', detail: '방 1개·이사 1건: 사진 30장, PDF, 재다운로드' },
  { name: '내용증명 서식 PDF', price: '건당 2,900원', detail: '입력한 내용이 그대로 들어가는 빈칸형 서식 PDF' },
  { name: '기관(대학 생활관·지자체)용 기록 관리', price: '—', detail: '여러 방의 입주·퇴실 기록 관리', status: '출시 예정' },
]

function PriceTable({ caption, rows, kind }: { caption: string; rows: Row[]; kind: 'free' | 'paid' }) {
  return (
    <div className={`card price-card price-${kind}`}>
      <h2>{caption}</h2>
      <table className="price-table">
        <thead>
          <tr>
            <th scope="col">상품</th>
            <th scope="col">가격</th>
            <th scope="col">포함 내용</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <th scope="row">{r.name}</th>
              <td className="price-cell">
                {r.status ? <span className="badge warn">{r.status}</span> : <b>{r.price}</b>}
              </td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Pricing() {
  return (
    <section className="page pricing">
      <h1>가격 안내</h1>
      <p className="muted">로그인 없이 쓸 수 있어요. 가격은 아직 검증 중인 가설이에요.</p>

      <ul className="page-notes">
        <li>공제 정리·참고 자료·문의 문자는 영구 무료이며 어떤 유료 상품과도 묶지 않습니다.</li>
        <li>
          <strong>결제는 아직 연결하지 않았어요.</strong> 유료 상품은 데모에서 무료로 체험할 수 있어요.
        </li>
        <li>성공보수·변호사 소개비를 받지 않습니다.</li>
      </ul>

      <div className="price-grid">
        <PriceTable caption="무료(영구, 누구나)" rows={FREE} kind="free" />
        <PriceTable caption="유료(가설)" rows={PAID} kind="paid" />
      </div>

      <p className="muted small">
        보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다. 공제 정리 결과나 판단을 따로 판매하지 않아요.
      </p>

      <div className="page-actions">
        <button type="button" className="btn primary" onClick={() => go('deduct')}>
          공제 내역 정리하기
        </button>
        <button type="button" className="btn" onClick={() => go('record')}>
          방 상태 기록하기
        </button>
      </div>
    </section>
  )
}
