import { useEffect, useRef, useState } from 'react'
import { useSelection, useStore } from '../../state'
import { postMetric } from '../../api'
import type { Item } from '../../types'
import { IconCopy } from './icons'
import { findReferences, type Reference } from '../../data/references'

/** 고정 템플릿 한 종류 — 확인·체크한 항목과 금액만 들어간다 */
export function buildInquiry(opts: {
  items: Item[]
  myName: string
  place: string
  includeRest: boolean
  /** 체크한 참고 자료 인용 문장(질문 목록 다음, 나머지 보증금 문장 앞) */
  refLines?: string[]
}): string {
  const name = opts.myName.trim()
  const place = opts.place.trim()
  let first = '안녕하세요.'
  if (place && name) first = `안녕하세요, ${place}에 살았던 ${name}입니다.`
  else if (place) first = `안녕하세요, ${place}에 살았던 세입자입니다.`
  else if (name) first = `안녕하세요, ${name}입니다.`

  const lines = [
    first,
    '보내 주신 퇴실 공제 내역 잘 받았습니다.',
    '그중 아래 항목은 어떤 근거(사진, 견적서, 영수증 등)로 공제하시는지 알려 주실 수 있을까요?',
    ...opts.items.map((it) => `- ${it.name} ${(it.amount ?? 0).toLocaleString('ko-KR')}원`),
  ]
  if (opts.refLines?.length) lines.push(...opts.refLines)
  if (opts.includeRest) lines.push('확인하시는 동안 위 항목을 뺀 나머지 보증금은 먼저 돌려주실 수 있을까요?')
  lines.push('감사합니다.')
  if (name) lines.push(`${name} 드림`)
  return lines.join('\n')
}

/** 체크한 항목과 관련된, 문자 문장이 있는 자료만(세입자에게 불리한 자료 제외). 순서는 REFERENCES 기준 */
function messageRefs(items: Item[]): Reference[] {
  const seen = new Map<string, Reference>()
  for (const it of items) {
    for (const r of findReferences(it.name)) {
      if (!r.caution && r.messageLine && !seen.has(r.id)) seen.set(r.id, r)
    }
  }
  return [...seen.values()]
}

export default function MessageBox() {
  const { deduction, setDeduction } = useStore()
  const { selected } = useSelection()
  const [requested, setRequested] = useState(false)
  const [includeRest, setIncludeRest] = useState(false)
  const [refIds, setRefIds] = useState<string[]>([])
  const [canShare] = useState(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  // 문자 앱 열기는 휴대폰에서만 — 터치 기기이면서 모바일 브라우저일 때
  const [isMobile] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches === true,
  )
  const [toast, setToast] = useState(false)
  const [copyFail, setCopyFail] = useState(false)
  const [emptyHint, setEmptyHint] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const hasSelection = selected.length > 0
  const availableRefs = messageRefs(selected)
  // 체크해 둔 자료라도 지금 항목과 관련 없으면 문자에 넣지 않는다
  const refLines = availableRefs.filter((r) => refIds.includes(r.id)).map((r) => r.messageLine as string)
  const toggleRef = (id: string, on: boolean) =>
    setRefIds((prev) => (on ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id)))
  // 문자를 만든 뒤에는 항목·금액·입력이 바뀌면 자동으로 다시 만든다
  const message =
    requested && hasSelection
      ? buildInquiry({ items: selected, myName: deduction.myName, place: deduction.place, includeRest, refLines })
      : ''
  const showHint = emptyHint || (requested && !hasSelection)

  const make = () => {
    setCopyFail(false)
    if (!hasSelection) {
      setEmptyHint(true)
      setRequested(false)
      return
    }
    setEmptyHint(false)
    setRequested(true)
  }

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(message)
      // 익명 횟수 집계(문자 내용은 보내지 않음) — 실패해도 복사 흐름에 영향 없음
      postMetric('copy_message')
      setCopyFail(false)
      setToast(true)
      window.clearTimeout(toastTimer.current)
      toastTimer.current = window.setTimeout(() => setToast(false), 2000)
    } catch {
      setCopyFail(true)
      taRef.current?.focus()
      taRef.current?.select()
    }
  }

  const share = async () => {
    try {
      await navigator.share({ text: message })
    } catch {
      // 사용자가 공유창을 닫은 경우 등 — 조용히 무시
    }
  }

  return (
    <div className="dd-message">
      <div className="dd-grid2">
        <label className="dd-field">
          <span className="dd-label">내 이름(선택)</span>
          <input
            className="dd-input"
            value={deduction.myName}
            maxLength={30}
            placeholder="예: 김국민"
            onChange={(e) => setDeduction({ myName: e.target.value })}
          />
        </label>
        <label className="dd-field">
          <span className="dd-label">집 주소 또는 원룸 이름(선택)</span>
          <input
            className="dd-input"
            value={deduction.place}
            maxLength={60}
            placeholder="예: 정릉 OO원룸 302호"
            onChange={(e) => setDeduction({ place: e.target.value })}
          />
        </label>
      </div>
      <p className="small muted">이름과 주소는 이 브라우저 안에서만 문자에 넣는 데 쓰고, 서버로 보내지 않아요.</p>

      <label className="dd-check dd-option">
        <input type="checkbox" checked={includeRest} onChange={(e) => setIncludeRest(e.target.checked)} />
        <span className="dd-check-text">확인하는 동안 나머지 보증금은 먼저 돌려 달라는 문장 넣기</span>
      </label>

      {availableRefs.length > 0 && (
        <fieldset className="dd-refpick">
          <legend className="dd-label">참고 자료 문장 넣기(선택) — 판단이 아니라 공개 자료를 인용하는 문장이에요</legend>
          {availableRefs.map((r) => (
            <label key={r.id} className="dd-check dd-option dd-refpick-item">
              <input
                type="checkbox"
                checked={refIds.includes(r.id)}
                onChange={(e) => toggleRef(r.id, e.target.checked)}
              />
              <span className="dd-check-text">
                <span className="dd-refpick-title">{r.title}</span>
                {r.messageNote && <span className="dd-refpick-note">{r.messageNote}</span>}
                <span className="dd-refpick-line">“{r.messageLine}”</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="dd-row-actions">
        <button type="button" className="btn primary" onClick={make}>
          문자 만들기
        </button>
      </div>

      {showHint && (
        <p className="dd-hint" role="alert">
          물어볼 항목을 먼저 체크해 주세요.
        </p>
      )}

      {message && (
        <div className="dd-message-out">
          {deduction.contractor === 'other' && (
            <p className="dd-warnbox small" role="note">
              계약자에게 이 내용을 전달해 확인받으세요. 문자는 계약자 본인 이름으로 보내는 것이 좋아요.
            </p>
          )}
          <label className="dd-label" htmlFor="dd-message-text">
            문의 문자
          </label>
          {/* 말풍선 미리보기 — 자동 복사가 막혀도 길게 눌러 고를 수 있게 textarea 그대로 둔다 */}
          <div className="dd-bubble">
            <textarea
              id="dd-message-text"
              ref={taRef}
              className="dd-textarea dd-message-text"
              readOnly
              value={message}
              rows={Math.min(12, message.split('\n').length + 1)}
            />
          </div>
          <p className="small muted">항목·금액이나 위 입력을 바꾸면 문자도 함께 바뀌어요. 복사해서 직접 보내 주세요.</p>
          <div className="dd-row-actions dd-copy-row">
            <button type="button" className="btn primary dd-copy" onClick={copy}>
              <IconCopy size={18} />
              복사
            </button>
            {canShare && (
              <button type="button" className="btn dd-send" onClick={share}>
                공유하기
              </button>
            )}
            {isMobile && (
              <a className="btn dd-send" href={'sms:?&body=' + encodeURIComponent(message)}>
                문자 앱 열기
              </a>
            )}
          </div>
          <p className="small muted">보내기는 직접 해요. 보증금 지킴이는 대신 보내지 않아요.</p>
          {copyFail && (
            <p className="dd-hint" role="alert">
              자동 복사가 안 돼요. 문장을 길게 눌러 직접 복사해 주세요.
            </p>
          )}
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          복사했어요
        </div>
      )}
    </div>
  )
}
