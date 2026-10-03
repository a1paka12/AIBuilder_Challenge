import { useEffect, useState } from 'react'
import { getStats } from '../../api'
import { usePromoUnlocked } from '../../lib/promo'
import { go } from '../../router'

/*
 * 이벤트 띠 배너 — 출시 기념 30초 설문 이벤트로 안내한다.
 * 참여 수는 GET /api/stats 의 survey.total 실제 값만, 1 이상일 때만 보여 준다(0이면 숨김 · 못 불러와도 숨김).
 * 이 기기에서 이미 혜택이 적용됐으면(usePromoUnlocked) 문구와 버튼이 '기록북 만들기'로 바뀐다.
 */
const n = (v: number) => v.toLocaleString('ko-KR')

export default function EventBand({ onSurvey }: { onSurvey: () => void }) {
  const unlocked = usePromoUnlocked()
  const [total, setTotal] = useState(0)

  useEffect(() => {
    let alive = true
    getStats()
      .then((s) => {
        if (alive) setTotal(s.survey.total)
      })
      .catch(() => {
        /* 집계를 못 불러오면 숫자만 숨긴다 */
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="home-band" aria-labelledby="home-band-title">
      <div className="home-band-text">
        <p className="home-band-kicker">
          <span className="badge">출시 기념 이벤트</span>
          {total >= 1 && (
            <span className="home-band-count">
              지금까지 <b className="num">{n(total)}</b>명 참여
            </span>
          )}
        </p>
        <h2 id="home-band-title" className="home-band-title">
          {unlocked ? '혜택이 적용됐어요 · 기록북 범위(사진 30장)까지 체험' : '30초 설문에 답하면, 기록북 범위(사진 30장)까지 체험'}
        </h2>
        <p className="home-band-sub">이 기기·브라우저에서 · 결제 연결 전 체험 · 이름·연락처는 묻지 않아요</p>
      </div>
      <div className="home-band-actions">
        {unlocked ? (
          <>
            <button type="button" className="btn home-band-primary" onClick={() => go('record')}>
              기록북 만들기
            </button>
            <button type="button" className="btn home-band-ghost" onClick={() => go('event')}>
              이벤트 안내 보기
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn home-band-primary" onClick={() => go('event')}>
              이벤트 자세히 보기
            </button>
            <button type="button" className="btn home-band-ghost" onClick={onSurvey}>
              바로 설문 답하기
            </button>
          </>
        )}
      </div>
    </section>
  )
}
