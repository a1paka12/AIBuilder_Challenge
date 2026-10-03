import { Fragment, useState, type KeyboardEvent } from 'react'
import { useStore } from '../../state'
import { won } from '../../api'
import { clauseMatchesItem } from '../../data/references'
import type { Item } from '../../types'
import RefCards from './RefCards'
import { IconChevronDown } from './icons'
import { newManualItem, parseAmount } from './newItem'

interface Props {
  editingId: string | null
  setEditingId: (id: string | null) => void
}

/** 행마다 반복되는 버튼·체크박스 이름에 넣을 항목 이름 */
const itemLabel = (it: Item) => it.name.trim() || '이름 없는 항목'

/** AI가 본 전송본(처리본)에서 인용 부분을 <mark>로 강조 — 인용은 처리본 기준으로 찾는다 */
function Highlighted({ text, quote }: { text: string; quote: string }) {
  if (!text) return <p className="small muted">대조할 글이 없어요.</p>
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
      <span className="dd-quote-text">“{item.quote}”</span>
      {!item.quoteFound && <span className="badge warn">원문 확인 필요</span>}
    </span>
  )
}

/** 카드 왼쪽 띠 색: 확인함=초록, 확인 필요(AI 표시·원문 못 찾음)=주황 */
function rowTone(it: Item): string {
  if (it.confirmed) return ' is-ok'
  if (it.needsCheck || (it.quote !== '' && !it.quoteFound)) return ' is-warn'
  return ''
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
  const label = item.manual && !item.name ? '새 항목' : itemLabel(item)

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
      <td data-label="항목" className="dd-td-name">
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
      <td data-label="청구액" className="dd-td-amount">
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
      <td data-label="원문" className="dd-td-quote">
        <QuoteCell item={item} />
      </td>
      <td data-label="상태" className="dd-td-status">
        {error ? (
          <span className="dd-error small" role="alert">
            {error}
          </span>
        ) : (
          <span className="small muted">수정 중</span>
        )}
      </td>
      <td data-label="버튼" className="dd-td-actions">
        <div className="dd-actions">
          <button type="button" className="btn primary dd-btn" aria-label={`${label} 저장`} onClick={save}>
            저장
          </button>
          <button type="button" className="btn dd-btn" aria-label={`${label} 수정 취소`} onClick={onCancel}>
            취소
          </button>
        </div>
      </td>
      <td data-label="물어볼 항목" className="dd-td-check">
        <label className="dd-check disabled" title="먼저 확인해 주세요">
          <input type="checkbox" checked={false} disabled readOnly aria-label={`${label} 물어볼 항목`} />
          <span className="dd-check-text">물어볼 항목</span>
        </label>
      </td>
    </tr>
  )
}

export default function ItemTable({ editingId, setEditingId }: Props) {
  const { deduction, setDeduction, updateItem } = useStore()
  const { items, rawText, processedText, clauseText } = deduction
  // 원문 대조는 AI가 실제로 본 처리본(전송본) 기준 — 인용이 처리본에서 찾아진다. 직접 입력(처리본 없음)이면 붙여 넣은 글
  const sourceText = processedText ?? rawText
  const sourceTitle = processedText !== undefined ? 'AI가 본 전송본(처리본)' : '붙여 넣은 원문'
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
            <th scope="col" className="dd-th-amount">청구액</th>
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
            const label = itemLabel(it)
            return (
              <Fragment key={it.id}>
                {editingId === it.id ? (
                  <EditRow
                    item={it}
                    onDone={(name, amount) => saveEdit(it, name, amount)}
                    onCancel={() => cancelEdit(it)}
                  />
                ) : (
                  <tr className={`dd-row${rowTone(it)}${it.selected ? ' selected' : ''}${expanded ? ' expanded' : ''}`}>
                    <td data-label="항목" className="dd-td-name">
                      <button
                        type="button"
                        className="dd-name"
                        aria-expanded={expanded}
                        onClick={() => setExpandedId(expanded ? null : it.id)}
                      >
                        <span className="dd-name-text">{it.name || '(이름 없음)'}</span>
                        <IconChevronDown size={14} className={`dd-caret${expanded ? ' open' : ''}`} />
                      </button>
                    </td>
                    <td data-label="청구액" className="dd-td-amount dd-amount">
                      {it.amount === null ? <span className="muted small dd-amount-none">금액 미정</span> : won(it.amount)}
                    </td>
                    <td data-label="원문" className="dd-td-quote">
                      <QuoteCell item={it} />
                    </td>
                    <td data-label="상태" className="dd-td-status">
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
                        {clauseHit && (
                          <span className="badge" title="특약 문구에 이 항목과 같은 말이 있어요. 효력·적용 여부는 판단하지 않아요.">
                            특약: 관련 문구 있음
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="버튼" className="dd-td-actions">
                      <div className="dd-actions">
                        <button type="button" className="btn dd-btn" aria-label={`${label} 수정`} onClick={() => setEditingId(it.id)}>
                          수정
                        </button>
                        <button
                          type="button"
                          className={it.confirmed ? 'btn dd-btn' : 'btn primary dd-btn'}
                          aria-pressed={it.confirmed}
                          aria-label={`${label} ${it.confirmed ? '확인 취소' : '확인'}`}
                          onClick={() => confirmToggle(it)}
                        >
                          {it.confirmed ? '확인 취소' : '확인'}
                        </button>
                        <button type="button" className="btn ghost dd-btn dd-del" aria-label={`${label} 삭제`} onClick={() => remove(it.id)}>
                          삭제
                        </button>
                      </div>
                      {notice[it.id] && (
                        <p className="small dd-notice" role="alert">
                          {notice[it.id]}
                        </p>
                      )}
                    </td>
                    <td data-label="물어볼 항목" className="dd-td-check">
                      <label
                        className={`dd-check${canSelect ? '' : ' disabled'}`}
                        title={canSelect ? undefined : '먼저 확인해 주세요'}
                      >
                        <input
                          type="checkbox"
                          checked={it.selected}
                          disabled={!canSelect}
                          aria-label={`${label} 물어볼 항목`}
                          title={canSelect ? undefined : '먼저 확인해 주세요'}
                          onChange={(e) => updateItem(it.id, { selected: e.target.checked })}
                        />
                        <span className="dd-check-text">물어볼 항목</span>
                      </label>
                    </td>
                  </tr>
                )}
                {expanded && editingId !== it.id && (
                  <tr className="dd-expand">
                    <td colSpan={6}>
                      <div className="dd-expand-inner">
                        <div className="dd-source">
                          <h4 className="dd-subhead">{sourceTitle}</h4>
                          <Highlighted text={sourceText} quote={it.quote} />
                          {processedText !== undefined && (
                            <p className="small muted">전송본은 이 기기에서 개인정보를 가린 처리본이에요. 가린 자리는 [전화번호 삭제]처럼 보여요.</p>
                          )}
                          {it.quote && !it.quoteFound && (
                            <p className="small muted">전송본에서 이 인용을 찾지 못했어요. 원문을 직접 확인해 주세요.</p>
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
