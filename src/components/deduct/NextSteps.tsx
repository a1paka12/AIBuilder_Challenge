import { useRef, useState } from 'react'
import { go } from '../../router'
import { AGENCIES, AGENCIES_CHECKED_AT, formatCheckedAt } from '../../data/agencies'
import { IconAlert, IconCheck, IconExternal } from './icons'
import { scrollToEl } from './motion'

const CONSULT_CASES = [
  '특약에 해당 항목이 적혀 있다',
  '이미 집주인과 다툼이 커졌다',
  '공제 금액이 크다',
  '사진만으로는 손상 원인을 설명하기 어렵다',
]

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export default function NextSteps({ onOpen }: { onOpen?: () => void }) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const show = () => {
    setOpen(true)
    onOpen?.()
    window.setTimeout(() => scrollToEl(boxRef.current), 50)
  }

  return (
    <div className="dd-next">
      <button type="button" className="btn" aria-expanded={open} onClick={show}>
        다음 단계 보기
      </button>
      {open && (
        <div className="dd-next-body" ref={boxRef}>
          <div className="dd-warnbox" role="note">
            <IconAlert size={20} />
            <strong>키 반납 전에 공제 내역과 금액을 문자로 받아 두세요.</strong>
          </div>
          <ul className="dd-list">
            <li>다툼 없는 금액은 먼저 돌려 달라고 요청할 수 있어요.</li>
            <li>답이 없거나 거절하면 내용증명, 분쟁조정 순서로 진행할 수 있어요.</li>
          </ul>

          <h3>상담을 고려해 볼 상황</h3>
          <ul className="dd-checklist">
            {CONSULT_CASES.map((c) => (
              <li key={c}>
                <IconCheck size={16} strokeWidth="2.5" />
                <span>{c}</span>
              </li>
            ))}
          </ul>

          <h3>무료 상담 기관·공식 링크</h3>
          <ul className="dd-orgs">
            {AGENCIES.map((a) => (
              <li key={a.id} className="dd-org">
                <strong className="dd-org-name">{a.name}</strong>
                <span className="dd-org-detail">{a.how}</span>
                <a
                  className="dd-org-link"
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${a.name} 공식 홈페이지(새 창)`}
                >
                  <span>{host(a.url)}</span>
                  <IconExternal size={14} />
                </a>
                <span className="small muted dd-org-checked">확인일 {formatCheckedAt(a.checkedAt)}</span>
              </li>
            ))}
          </ul>
          <p className="small muted">
            공식 홈페이지에서 확인한 내용만 적었어요(확인일 {formatCheckedAt(AGENCIES_CHECKED_AT)}). 사건 정보를 다른 곳에 보내지 않아요. 링크는 새 탭에서 열려요.
          </p>

          <div className="dd-row-actions">
            <button type="button" className="btn primary" onClick={() => go('cert')}>
              내용증명 서식 만들기
            </button>
            <button type="button" className="btn" onClick={() => go('lawyer')}>
              변호사 찾아보기
            </button>
            <button type="button" className="btn" onClick={() => go('help')}>
              상담 기관 자세히 보기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
