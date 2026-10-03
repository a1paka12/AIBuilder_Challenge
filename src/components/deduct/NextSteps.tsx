import { useRef, useState } from 'react'
import { go } from '../../router'

const ORGS = [
  { name: '대한법률구조공단', detail: '전화 132', url: 'https://www.klac.or.kr' },
  { name: '주택임대차분쟁조정위원회', detail: '보증금·원상회복 분쟁 조정 신청', url: 'https://www.hldcc.or.kr' },
  { name: '서울시 마을변호사', detail: '서울시 무료 법률상담', url: 'https://legal.seoul.go.kr' },
  { name: '국민대 법률상담센터', detail: '법학관 233호 · 평일 10:00~16:00', url: 'https://legalcc.kookmin.ac.kr' },
  { name: '대한변협 변호사 검색 공식 홈페이지', detail: '대한변호사협회', url: 'https://www.koreanbar.or.kr' },
]

const CONSULT_CASES = [
  '특약에 해당 항목이 적혀 있다',
  '이미 집주인과 다툼이 커졌다',
  '공제 금액이 크다',
  '사진만으로는 손상 원인을 설명하기 어렵다',
]

export default function NextSteps() {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const show = () => {
    setOpen(true)
    window.setTimeout(() => boxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  return (
    <div className="dd-next">
      <button type="button" className="btn" aria-expanded={open} onClick={show}>
        다음 단계 보기
      </button>
      {open && (
        <div className="dd-next-body" ref={boxRef}>
          <div className="dd-warnbox" role="note">
            <strong>키 반납 전에 공제 내역과 금액을 문자로 받아 두세요.</strong>
          </div>
          <ul className="dd-list">
            <li>다툼 없는 금액은 먼저 돌려 달라고 요청할 수 있어요.</li>
            <li>답이 없거나 거절하면 내용증명, 분쟁조정 순서로 진행할 수 있어요.</li>
          </ul>

          <h3>상담을 고려해 볼 상황</h3>
          <ul className="dd-list">
            {CONSULT_CASES.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>

          <h3>무료 상담 기관·공식 링크</h3>
          <ul className="dd-orgs">
            {ORGS.map((o) => (
              <li key={o.name} className="dd-org">
                <div>
                  <strong>{o.name}</strong>
                  <span className="small muted"> · {o.detail}</span>
                </div>
                <a className="small" href={o.url} target="_blank" rel="noopener noreferrer">
                  {o.url.replace(/^https:\/\//, '')}
                </a>
              </li>
            ))}
          </ul>
          <p className="small muted">사건 정보를 다른 곳에 보내지 않아요. 링크는 새 탭에서 열려요.</p>

          <div className="dd-row-actions">
            <button type="button" className="btn primary" onClick={() => go('cert')}>
              내용증명 서식 만들기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
