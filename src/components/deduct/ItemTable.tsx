import { Fragment, useState, type KeyboardEvent } from 'react'
import { useStore } from '../../state'
import { won } from '../../api'
import { clauseMatchesItem } from '../../data/references'
import type { Item } from '../../types'
import RefCards from './RefCards'
import { newManualItem, parseAmount } from './newItem'

interface Props {
  editingId: string | null
  setEditingId: (id: string | null) => void
}

/** 붙여 넣은 원문에서 인용 부분을 <mark>로 강조 */
function Highlighted({ text, quote }: { text: string; quote: string }) {
  if (!text) return <p className="small muted">붙여 넣은 원문이 없어요.</p>
  const q = quote.trim()
  let idx = q ? text.indexOf(q) : -1
  let len = q.length
  if (q && idx < 0) {
    // 공백만 다른 경우를 한 번 더 찾는다
    const pattern = q
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s*')
    const m = pattern ? new RegExp(pattern).exec(text) : null
    if (m) {
      idx = m.index
      len = m[0].length
    }
  }
  if (idx < 0) return <p className="dd-raw">{text}</p>
  return (
    <p className="dd-raw">
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + len)}</mark>
      {text.slice(idx + len)}
    </p>
  )
}

function QuoteCell({ item }: { item: Item }) {
  if (!item.quote) return <span className="small muted">{item.manual ? '직접 추가한 항목' : '-'}</span>
  return (
    <span className="dd-quote">
      <span>“{item.quote}”</span>
      {!item.quoteFound && <span className="badge warn">원문 확인 필요</span>}
    </span>
  )
}

function EditRow({
  item,
  onDone,
  onCancel,
}: {
  item: Item
  onDone: (name: string, amount: number | null) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(item.amount === null ? '' : String(item.amount))
  const [error, setError] = useState<string | null>(null)
  const parsed = parseAmount(amount)

  const save = () => {
    const n = name.trim()
    if (!n) {
      setError('항목 이름을 적어 주세요.')
      return
    }
    if (!parsed.ok) {
      setError(parsed.message)
      return
    }
    onDone(n.slice(0, 40), parsed.value)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') onCancel()
  }

  return (
    <tr className="dd-row editing">
      <td data-label="항목">
        <input
          className="dd-input"
          aria-label="항목 이름"
          value={name}
          maxLength={40}
          autoFocus
          placeholder="예: 청소비"
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={onKey}
        />
      </td>
      <td data-label="청구액">
        <input
          className="dd-input dd-amount-input"
          aria-label="청구액(원)"
          inputMode="numeric"
          value={amount}
          placeholder="예: 150000"
          onChange={(e) => {
            setAmount(e.target.value)
            setError(null)
          }}
          onKeyDown={onKey}
        />
        <span className="small muted dd-amount-preview">
          {parsed.ok ? (parsed.value === null ? '비우면 금액 미정' : won(parsed.value)) : ''}
        </span>
      </td>
      <td data-label="원문">
        <QuoteCell item={item} />
      </td>
      <td data-label="상태">
        {error ? (
          <span className="dd-error small" role="alert">
            {error}
          </span>
        ) : (
          <span className="small muted">수정 중</span>
        )}
      </td>
      <td data-label="버튼">
        <div className="dd-actions">
          <button type="button" className="btn primary dd-btn" onClick={save}>
            저장
          </button>
          <button type="button" className="btn dd-btn" onClick={onCancel}>
            취소
          </button>
        </div>
      </td>
      <td data-label="물어볼 항목">
        <label className="dd-check disabled" title="먼저 확인해 주세요">
          <input type="checkbox" checked={false} disabled readOnly />
          물어볼 항목
        </label>
      </td>
    </tr>
  )
}

export default function ItemTable({ editingId, setEditingId }: Props) {
  const { deduction, setDeduction, updateItem } = useStore()
  const { items, rawText, clauseText } = deduction
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Record<string, string>>({})

  const setRowNotice = (id: string, msg: string | null) =>
    setNotice((prev) => {
      const next = { ...prev }
      if (msg) next[id] = msg
      else delete next[id]
      return next
    })

  const remove = (id: string) => {
    setDeduction({ items: items.filter((it) => it.id !== id) })
    if (expandedId === id) setExpandedId(null)
    if (editingId === id) setEditingId(null)
    setRowNotice(id, null)
  }

  const addRow = () => {
    const row = newManualItem()
    setDeduction({ items: [...items, row] })
    setEditingId(row.id)
  }

  const confirmToggle = (it: Item) => {
    if (it.confirmed) {
      updateItem(it.id, { confirmed: false })
      setRowNotice(it.id, null)
      return
    }
    if (it.amount === null) {
      setRowNotice(it.id, '금액이 없어 확인할 수 없어요. 수정 버튼으로 금액을 먼저 적어 주세요.')
      return
    }
    updateItem(it.id, { confirmed: true })
    setRowNotice(it.id, null)
  }

  const saveEdit = (it: Item, name: string, amount: number | null) => {
    const amountChanged = amount !== it.amount
    updateItem(it.id, {
      name,
      amount,
      confirmed: false,
      selected: false,
      // 사용자가 금액을 직접 고쳤으면 AI의 "확인 필요" 표시는 내린다(확인은 다시 눌러야 함)
      ...(amountChanged && amount !== null ? { needsCheck: false, checkReason: null } : {}),
    })
    setEditingId(null)
    setRowNotice(it.id, null)
  }

  const cancelEdit = (it: Item) => {
    // 방금 추가하고 아무것도 적지 않은 행은 지운다
    if (it.manual && !it.name && it.amount === null) remove(it.id)
    setEditingId(null)
  }

  return (
    <div className="dd-table-wrap">
      <table className="dd-table">
        <thead>
          <tr>
            <th scope="col">항목</th>
            <th scope="col">청구액</th>
            <th scope="col">원문</th>
            <th scope="col">상태</th>
            <th scope="col">버튼</th>
            <th scope="col">물어볼 항목</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr className="dd-empty">
              <td colSpan={6}>항목이 없어요. 아래 행 추가 버튼으로 직접 적을 수 있어요.</td>
            </tr>
          )}
          {items.map((it) => {
            const expanded = expandedId === it.id
            const clauseHit = clauseMatchesItem(clauseText, it.name)
            const canSelect = it.confirmed && it.amount !== null
            return (
              <Fragment key={it.id}>
                {editingId === it.id ? (
                  <EditRow
                    item={it}
                    onDone={(name, amount) => saveEdit(it, name, amount)}
                    onCancel={() => cancelEdit(it)}
                  />
                ) : (
                  <tr className={`dd-row${it.selected ? ' selected' : ''}${expanded ? ' expanded' : ''}`}>
                    <td data-label="항목">
                      <button
                        type="button"
                        className="dd-name"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : it.id)}
                      >
                        <span>{it.name || '(이름 없음)'}</span>
                        <span className="dd-caret" aria-hidden="true">
                          {expanded ? '▲' : '▼'}
                        </span>
                      </button>
                    </td>
                    <td data-label="청구액" className="dd-amount">
                      {it.amount === null ? <span className="muted small">금액 미정</span> : won(it.amount)}
                    </td>
                    <td data-label="원문">
                      <QuoteCell item={it} />
                    </td>
                    <td data-label="상태">
                      <div className="dd-status">
                        {it.confirmed ? (
                          <span className="badge ok">확인함</span>
                        ) : it.needsCheck ? (
                          <>
                            <span className="badge warn">확인 필요</span>
                            {it.checkReason && <span className="small muted">{it.checkReason}</span>}
                          </>
                        ) : (
                          <span className="small muted">확인 전</span>
                        )}
                        {clauseHit && <span className="badge warn">특약 있음 · 상담 필요</span>}
                      </div>
                    </td>
                    <td data-label="버튼">
                      <div className="dd-actions">
                        <button type="button" className="btn dd-btn" onClick={() => setEditingId(it.id)}>
                          수정
                        </button>
                        <button
                          type="button"
                          className={it.confirmed ? 'btn dd-btn' : 'btn primary dd-btn'}
                          aria-pressed={it.confirmed}
                          onClick={() => confirmToggle(it)}
                        >
                          {it.confirmed ? '확인 취소' : '확인'}
                        </button>
                        <button type="button" className="btn ghost dd-btn dd-del" onClick={() => remove(it.id)}>
                          삭제
                        </button>
                      </div>
                      {notice[it.id] && (
                        <p className="small dd-notice" role="alert">
                          {notice[it.id]}
                        </p>
                      )}
                    </td>
                    <td data-label="물어볼 항목">
                      <label
                        className={`dd-check${canSelect ? '' : ' disabled'}`}
                        title={canSelect ? undefined : '먼저 확인해 주세요'}
                      >
                        <input
                          type="checkbox"
                          checked={it.selected}
                          disabled={!canSelect}
                          title={canSelect ? undefined : '먼저 확인해 주세요'}
                          onChange={(e) => updateItem(it.id, { selected: e.target.checked })}
                        />
                        물어볼 항목
                      </label>
                    </td>
                  </tr>
                )}
                {expanded && editingId !== it.id && (
                  <tr className="dd-expand">
                    <td colSpan={6}>
                      <div className="dd-expand-inner">
                        <div className="dd-source">
                          <h4 className="dd-subhead">붙여 넣은 원문</h4>
                          <Highlighted text={rawText} quote={it.quote} />
                          {it.quote && !it.quoteFound && (
                            <p className="small muted">원문에서 이 인용을 찾지 못했어요. 원문을 직접 확인해 주세요.</p>
                          )}
                        </div>
                        <RefCards itemName={it.name} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      <div className="dd-table-foot">
        <button type="button" className="btn dd-btn" onClick={addRow}>
          행 추가
        </button>
      </div>
    </div>
  )
}
