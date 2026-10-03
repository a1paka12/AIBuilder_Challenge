import { REFERENCE_KIND_LABEL, findReferences } from '../../data/references'

export default function RefCards({ itemName }: { itemName: string }) {
  const refs = findReferences(itemName)
  return (
    <div className="dd-refs">
      <h4 className="dd-subhead">참고 자료</h4>
      <p className="small muted">
        공개 자료의 원문·요지와 출처를 그대로 보여 드려요. 내 계약과 사안에 그대로 적용되는지는 직접 확인하거나 상담해 주세요.
      </p>
      <ul className="dd-ref-list">
        {refs.map((r) => (
          <li key={r.id} className="dd-ref">
            <div className="dd-ref-head">
              <strong className="dd-ref-title">{r.title}</strong>
              <span className={r.caution ? 'badge warn' : 'badge'}>{r.scope}</span>
            </div>
            <p className="dd-ref-body">
              <span className="dd-ref-kind">{REFERENCE_KIND_LABEL[r.kind]}</span>
              {r.kind === 'contract' ? `“${r.body}”` : r.body}
            </p>
            {r.note && <p className="small dd-ref-note">{r.note}</p>}
            <p className="small muted dd-ref-meta">
              출처:{' '}
              <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                {r.sourceLabel}
              </a>{' '}
              · 확인일 {r.checkedAt}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
