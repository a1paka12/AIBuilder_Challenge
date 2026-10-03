import { useState, type KeyboardEvent } from 'react'
import {
  MASK_LABEL,
  MASK_TOKEN,
  WORD_KIND_OPTIONS,
  spansFromProcessed,
  splitProcessed,
  summarizeMask,
  type MaskResult,
  type MaskSpan,
  type MaskWord,
  type WordKind,
} from '../../lib/mask'
import { IconCheck } from './icons'

/*
 * FR-01 전송본 확인 — "기기 내 개인정보 제거"를 거친 처리본(전송본)을 보여 주고 확인을 받는다.
 * 이 부품은 네트워크를 쓰지 않는다. 확인 버튼은 부모(Deduct)의 onConfirm 만 부르고, 거기서만 extractItems 가 호출된다.
 */

export const MASK_FAIL_MSG = '개인정보 제거에 실패해 보내지 않았어요. 원문을 고친 뒤 다시 정리하기를 눌러 주세요.'

/** 처리본 — 치환 토큰([전화번호 삭제] 등)만 <mark>로 강조 */
export function ProcessedView({ text, spans, labelledBy }: { text: string; spans: readonly MaskSpan[]; labelledBy?: string }) {
  const parts = splitProcessed(text, spans)
  return (
    <p className="dd-raw dd-processed" aria-labelledby={labelledBy}>
      {parts.map((p, i) =>
        p.span ? (
          <mark key={i} className="dd-mask" title={`${MASK_LABEL[p.span.kind]} 가림`}>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  )
}

interface ReviewProps {
  /** 기기 내 개인정보 제거 결과. 실패(failed)면 null */
  masked: MaskResult | null
  failed: boolean
  words: MaskWord[]
  /** 사용자가 "전송본을 확인했어요"를 체크했는지 — 원문·가릴 단어가 바뀌면 부모가 해제한다 */
  checked: boolean
  onCheck: (v: boolean) => void
  /** 보낼 수 없는 이유(비어 있음·길이 초과). 없으면 null */
  blockReason: string | null
  canConfirm: boolean
  busy: boolean
  onAddWord: (word: string, kind: WordKind) => void
  onRemoveWord: (word: string) => void
  onConfirm: () => void
  onEditRaw: () => void
}

export function ReviewPanel(p: ReviewProps) {
  const [wordDraft, setWordDraft] = useState('')
  const [wordKind, setWordKind] = useState<WordKind>('name')
  const summary = p.masked ? summarizeMask(p.masked.counts) : ''

  const add = () => {
    const t = wordDraft.trim()
    if (!t) return
    p.onAddWord(t, wordKind)
    setWordDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }

  return (
    <div className="dd-review">
      <p className="dd-review-lead">
        아래 처리본이 실제로 서버에 보내는 전송본이에요. 이 기기에서 가린 자리는 <mark className="dd-mask">[전화번호 삭제]</mark>처럼 표시돼요.
      </p>

      {p.failed ? (
        <div className="dd-errorbox" role="alert">
          <p>{MASK_FAIL_MSG}</p>
          <p className="small muted">처리에 실패해 전송을 막았어요. 서버로는 아무것도 보내지 않았어요.</p>
        </div>
      ) : (
        p.masked && (
          <div className="dd-review-box">
            <div className="dd-review-head">
              <span className="dd-label" id="dd-processed-label">
                서버로 보낼 처리본(전송본)
              </span>
              <span className="badge">기기 내 개인정보 제거</span>
            </div>
            <ProcessedView text={p.masked.text} spans={p.masked.spans} labelledBy="dd-processed-label" />
            <p className="dd-mask-summary" aria-live="polite">
              {summary ? (
                <>
                  가린 항목: <strong>{summary}</strong>
                </>
              ) : (
                '자동으로 가린 항목이 없어요. 이름·주소가 있으면 아래에서 가릴 단어로 추가해 주세요.'
              )}
            </p>
          </div>
        )
      )}

      <div className="dd-words">
        <label className="dd-label" htmlFor="dd-word-input">
          가릴 단어 추가(이름·주소·호수 등)
        </label>
        <div className="dd-word-row">
          <select
            className="dd-input dd-word-kind"
            aria-label="가릴 단어 종류"
            value={wordKind}
            onChange={(e) => setWordKind(e.target.value as WordKind)}
          >
            {WORD_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            id="dd-word-input"
            className="dd-input"
            value={wordDraft}
            maxLength={40}
            placeholder="예: 홍길동, 302호"
            autoComplete="off"
            onChange={(e) => setWordDraft(e.target.value)}
            onKeyDown={onKey}
          />
          <button type="button" className="btn dd-btn" aria-label="가릴 단어 추가" onClick={add}>
            추가
          </button>
        </div>
        {p.words.length > 0 && (
          <ul className="dd-word-chips" aria-label="가린 단어 목록">
            {p.words.map((w) => (
              <li key={w.text} className="dd-chip">
                <span className="dd-chip-kind">{MASK_LABEL[w.kind]}</span>
                <span className="dd-chip-text">{w.text}</span>
                <button type="button" className="dd-chip-x" aria-label={`${w.text} 가림 해제`} onClick={() => p.onRemoveWord(w.text)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted dd-words-note">추가하면 처리본에서 바로 {MASK_TOKEN.name} · {MASK_TOKEN.address} · {MASK_TOKEN.word}(기타)로 바뀌어요.</p>
      </div>

      <div className="notice dd-review-notice" role="note">
        <strong>이 처리본만 서버를 거쳐 OpenAI(미국)로 보내요. 원문은 이 기기에서만 써요.</strong>
        <span>
          확인 전에는 아무것도 보내지 않고, 개인정보 제거에 실패하면 전송을 막아요. 자동으로 찾는 것은 번호·이메일 패턴뿐이라 이름·주소는 직접 가려
          주세요. 서버는 받은 처리본을 한 번 더 가린 뒤 AI에 넘기고, 본문을 저장하지 않아요.
        </span>
      </div>

      <label className="dd-check dd-option dd-review-check">
        <input
          type="checkbox"
          checked={p.checked}
          disabled={p.failed || !p.masked || p.busy}
          onChange={(e) => p.onCheck(e.target.checked)}
        />
        <span>위 전송본을 확인했어요. 원문이나 가릴 단어를 바꾸면 다시 확인해야 해요.</span>
      </label>
      <p className="small muted dd-review-check-note" aria-live="polite">
        {p.checked ? '확인했어요. 아래 버튼을 누르면 이 전송본만 보내요.' : '확인란을 체크해야 보낼 수 있어요.'}
      </p>

      {p.blockReason && (
        <p className="dd-hint" role="alert">
          {p.blockReason}
        </p>
      )}

      <div className="dd-row-actions">
        <button type="button" className="btn primary" disabled={!p.canConfirm} onClick={p.onConfirm}>
          이 전송본으로 정리하기
        </button>
        <button type="button" className="btn" disabled={p.busy} onClick={p.onEditRaw}>
          원문 고치기
        </button>
      </div>
    </div>
  )
}

/** 보낸 뒤: 확인이 끝났고 처리본만 갔다는 것을 계속 보여 준다 */
export function SentPanel({ text, summary }: { text: string; summary: string }) {
  const spans = spansFromProcessed(text)
  return (
    <div className="dd-review dd-review-done">
      <p className="dd-review-ok">
        <IconCheck size={18} strokeWidth="2.5" />
        <span>전송본 확인 완료 — 확인한 처리본만 서버로 보냈어요. 원문은 이 기기에서만 써요.</span>
      </p>
      <p className="dd-mask-summary">
        가린 항목: <strong>{summary || '없음'}</strong>
      </p>
      <details className="dd-review-details" open>
        <summary>보낸 전송본(처리본) 보기</summary>
        <ProcessedView text={text} spans={spans} />
      </details>
    </div>
  )
}
