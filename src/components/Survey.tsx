import { useEffect, useId, useState } from 'react'
import { getStats, postSurvey, SURVEY_REASON_LABEL, type Stats, type SurveyReason } from '../api'
import { unlockPromo } from '../lib/promo'
import '../styles/survey.css'

/*
 * 30초 현장 설문 — 선택지만 받고 이름·연락처는 묻지 않는다.
 * 질문 1 → '있어요'면 질문 2 → '안 물어봤어요'면 질문 3 (단계별 노출).
 * 전송 실패해도 화면은 그대로 두고 안내만 띄운다.
 */

type Deducted = 'yes' | 'no' | 'not_yet'
type Asked = 'yes' | 'no'
type Status = 'idle' | 'sending' | 'done'

const DEDUCTED_OPTIONS: { value: Deducted; label: string }[] = [
  { value: 'yes', label: '있어요' },
  { value: 'no', label: '없어요' },
  { value: 'not_yet', label: '아직 퇴실 전이에요' },
]
const ASKED_OPTIONS: { value: Asked; label: string }[] = [
  { value: 'yes', label: '물어봤어요' },
  { value: 'no', label: '안 물어봤어요' },
]
const REASON_OPTIONS = (Object.keys(SURVEY_REASON_LABEL) as SurveyReason[]).map((value) => ({
  value,
  label: SURVEY_REASON_LABEL[value],
}))

const n = (v: number) => v.toLocaleString('ko-KR')

interface OptionGroupProps<T extends string> {
  name: string
  number: number
  question: string
  options: { value: T; label: string }[]
  value: T | null
  onPick: (v: T) => void
  follow?: boolean
}

/* 라디오 묶음 — fieldset/legend 로 질문과 선택지를 묶는다 (접근성) */
function OptionGroup<T extends string>({ name, number, question, options, value, onPick, follow }: OptionGroupProps<T>) {
  return (
    <fieldset className={`survey-q${follow ? ' survey-q-follow' : ''}`}>
      <legend>
        <span className="survey-legend">
          <span className="survey-n" aria-hidden="true">{number}</span>
          <span>{question}</span>
        </span>
      </legend>
      <div className="survey-opts">
        {options.map((o) => (
          <label key={o.value} className="survey-opt">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onPick(o.value)} />
            <span className="survey-opt-label">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function Survey() {
  const uid = useId()
  const [deducted, setDeducted] = useState<Deducted | null>(null)
  const [asked, setAsked] = useState<Asked | null>(null)
  const [reason, setReason] = useState<SurveyReason | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [stats, setStats] = useState<Stats | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // 지금까지 응답 수 — 못 불러와도 조용히 넘어간다
  useEffect(() => {
    let alive = true
    getStats()
      .then((s) => {
        if (alive) setStats(s)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const needAsked = deducted === 'yes'
  const needReason = needAsked && asked === 'no'
  const complete = deducted !== null && (!needAsked || asked !== null) && (!needReason || reason !== null)

  const pickDeducted = (v: Deducted) => {
    setDeducted(v)
    if (v !== 'yes') {
      setAsked(null)
      setReason(null)
    }
    setMessage(null)
  }
  const pickAsked = (v: Asked) => {
    setAsked(v)
    if (v !== 'no') setReason(null)
    setMessage(null)
  }
  const pickReason = (v: SurveyReason) => {
    setReason(v)
    setMessage(null)
  }

  const submit = async () => {
    if (!complete || deducted === null) {
      setMessage('아직 답하지 않은 질문이 있어요.')
      return
    }
    setStatus('sending')
    setMessage('보내는 중이에요…')
    try {
      const r = await postSurvey({ deducted, asked: needAsked ? asked : null, reason: needReason ? reason : null })
      setStats(r.stats)
      setMessage(null)
      setStatus('done')
      unlockPromo()
    } catch {
      setStatus('idle')
      setMessage('응답을 보내지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  const total = stats?.survey.total ?? 0
  const deductedYes = stats?.survey.deducted.yes ?? 0
  const askedNo = stats?.survey.asked.no ?? 0

  return (
    <section className="survey card" aria-labelledby={`${uid}-title`}>
      <div className="survey-head">
        <div className="survey-head-text">
          <h2 id={`${uid}-title`} className="survey-title">30초 현장 설문</h2>
          <p className="survey-desc">퇴실 경험을 알려 주시면 서비스 근거로만 써요. 이름·연락처는 묻지 않아요.</p>
        </div>
        {stats && (
          <span className="badge survey-count">
            지금까지 <span className="num">{n(total)}</span>명 응답
          </span>
        )}
      </div>

      {status === 'done' ? (
        <div className="survey-done" role="status">
          <p className="survey-done-title">응답해 주셔서 고마워요</p>
          <dl className="survey-stats">
            <div className="survey-stat">
              <dt>지금까지 응답</dt>
              <dd>
                <b className="num">{n(total)}</b>명
              </dd>
            </div>
            <div className="survey-stat">
              <dt>떼인 적 있음 → 근거를 안 물어봄</dt>
              <dd>
                떼인 적 있음 <b className="num">{n(deductedYes)}</b>명 중 안 물어봄 <b className="num">{n(askedNo)}</b>명
              </dd>
            </div>
          </dl>
          <button type="button" className="linklike survey-edit" onClick={() => setStatus('idle')}>
            답을 고치기
          </button>
        </div>
      ) : (
        <form
          className="survey-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <OptionGroup
            name={`${uid}-deducted`}
            number={1}
            question="퇴실할 때 보증금에서 원상복구비·청소비를 떼인 적 있나요?"
            options={DEDUCTED_OPTIONS}
            value={deducted}
            onPick={pickDeducted}
          />
          {needAsked && (
            <OptionGroup
              name={`${uid}-asked`}
              number={2}
              question="그때 집주인에게 근거를 물어봤나요?"
              options={ASKED_OPTIONS}
              value={asked}
              onPick={pickAsked}
              follow
            />
          )}
          {needReason && (
            <OptionGroup
              name={`${uid}-reason`}
              number={3}
              question="왜 안 물어봤나요?"
              options={REASON_OPTIONS}
              value={reason}
              onPick={pickReason}
              follow
            />
          )}
          <div className="survey-actions">
            <button type="submit" className="btn primary" disabled={status === 'sending'} aria-busy={status === 'sending'}>
              응답 보내기
            </button>
            <p className="survey-msg" aria-live="polite">{message}</p>
          </div>
        </form>
      )}
    </section>
  )
}
