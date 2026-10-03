import { REFERENCE_KIND_LABEL, findReferences, type Reference } from '../../data/references'
import { KoglType4, STD_CONTRACT_SOURCE_TEXT } from '../Marks'
import { IconAlert, IconExternal } from './icons'

/**
 * 참고 자료 카드 목록. itemName 을 주면 그 항목과 맞는 자료를 찾고, refs 를 주면 그 목록을 그대로 보여 준다.
 * heading=null 이면 소제목 없이(바깥에 제목이 있을 때) 그린다.
 */
export default function RefCards({
  itemName = '',
  refs: given,
  heading = '참고 자료',
}: {
  itemName?: string
  refs?: readonly Reference[]
  heading?: string | null
}) {
  const refs = given ?? findReferences(itemName)
  return (
    <div className="dd-refs">
      {heading && <h4 className="dd-subhead">{heading}</h4>}
      <p className="small muted">
        공개 자료의 원문·요지와 출처를 그대로 보여 드려요. 내 계약과 사안에 그대로 적용되는지는 직접 확인하거나 상담해 주세요.
      </p>
      <ul className="dd-ref-list">
        {refs.map((r) => {
          // 표준계약서 인용 카드만 공공누리 제4유형 마크 + 정해진 출처 문구(Marks.tsx)를 쓴다
          const isStdContract = r.id.startsWith('std-contract')
          return (
            <li key={r.id} className={`dd-ref${r.caution ? ' caution' : ''}`}>
              <div className="dd-ref-head">
                <span className="dd-ref-kind">{REFERENCE_KIND_LABEL[r.kind]}</span>
                <span className={`badge dd-ref-scope${r.caution ? ' warn' : ''}`}>범위: {r.scope}</span>
              </div>
              <strong className="dd-ref-title">{r.title}</strong>
              <p className="dd-ref-body">{r.kind === 'contract' ? `“${r.body}”` : r.body}</p>
              {r.note && (
                <p className="small dd-ref-note">
                  <IconAlert size={14} />
                  <span>{r.note}</span>
                </p>
              )}
              {isStdContract ? (
                <p className="small muted dd-ref-meta dd-ref-kogl">
                  <KoglType4 height={22}>
                    <span>{STD_CONTRACT_SOURCE_TEXT}</span>
                  </KoglType4>
                  <span className="dd-ref-kogl-links">
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${r.title} 원문 PDF(새 창)`}>
                      <span>원문 PDF</span>
                      <IconExternal size={13} />
                    </a>{' '}
                    <span className="dd-ref-date">· 확인일 {r.checkedAt}</span>
                  </span>
                </p>
              ) : (
                <p className="small muted dd-ref-meta">
                  출처:{' '}
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                    <span>{r.sourceLabel}</span>
                    <IconExternal size={13} />
                  </a>{' '}
                  <span className="dd-ref-date">· 확인일 {r.checkedAt}</span>
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
