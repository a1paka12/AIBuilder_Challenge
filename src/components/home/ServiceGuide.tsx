import { go } from '../../router'
import { HOME_TASKS } from './tasks'
import { TaskIcon } from './icons'

/*
 * 업무별 안내 — 업무마다 "무엇을 해 주나 / AI가 하는 일 / 내가 하는 일 / 비용 / 자세히 보기".
 * AI가 하는 일과 내가 하는 일을 눈에 띄게 나눈다(AI는 정리만, 판단은 사람).
 * 가격·처리방침처럼 AI 항목이 없는 업무는 짧은 안내 블록으로 그린다.
 * 고객센터 화면(#/support)이 쓴다. id 를 주면 목차 버튼이 스크롤+포커스로 이 섹션에 올 수 있게 tabIndex=-1 을 붙인다.
 */
export default function ServiceGuide({ id, titleId = 'home-guide-title' }: { id?: string; titleId?: string }) {
  return (
    <section className="home-guide" id={id} tabIndex={id ? -1 : undefined} aria-labelledby={titleId}>
      <div className="section-head">
        <h2 id={titleId}>업무별 안내</h2>
        <p className="muted small">무엇을 해 주는지, AI가 하는 일과 내가 하는 일, 비용을 업무마다 적었어요.</p>
      </div>
      <ul className="hg-list">
        {HOME_TASKS.map((t) => {
          const brief = !t.ai
          return (
            <li key={t.route} className={`hg-item card${brief ? ' is-brief' : ''}`}>
              <div className="hg-head">
                <span className="hg-icon">
                  <TaskIcon name={t.icon} size={20} />
                </span>
                <h3 className="hg-title">{t.name}</h3>
                <span className={`badge${t.badgeTone ? ` ${t.badgeTone}` : ''}`}>{t.badge}</span>
              </div>
              <p className="hg-what">{t.what}</p>
              {!brief && (
                <dl className="hg-roles">
                  <div className="hg-role">
                    <dt className="hg-dt is-ai">AI가 하는 일</dt>
                    <dd className="hg-dd">{t.ai}</dd>
                  </div>
                  <div className="hg-role">
                    <dt className="hg-dt is-me">내가 하는 일</dt>
                    <dd className="hg-dd">{t.me}</dd>
                  </div>
                  <div className="hg-role">
                    <dt className="hg-dt">비용</dt>
                    <dd className="hg-dd">{t.cost}</dd>
                  </div>
                </dl>
              )}
              <div className="hg-actions">
                <button type="button" className={`btn${brief ? '' : ' primary'}`} onClick={() => go(t.route)}>
                  {t.detailLabel}
                </button>
                {t.route === 'deduct' && (
                  <button type="button" className="btn ghost" onClick={() => go('deduct', { sample: '1' })}>
                    공제 정리 예시로 보기
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
