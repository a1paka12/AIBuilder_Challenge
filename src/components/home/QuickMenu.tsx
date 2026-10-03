import { go } from '../../router'
import { HOME_TASKS } from './tasks'
import { TaskIcon } from './icons'

/*
 * 업무 바로가기 — 빠른 메뉴 타일 그리드 (모바일 2열 · 넓은 화면 3~4열)
 * 타일 전체가 버튼 하나이고, 눌리는 이름은 "업무 이름 → 한 줄 설명 → 배지" 순서로 읽힌다(배지는 CSS 로 오른쪽 위에 둔다).
 * 첫 타일(공제 문자 정리)은 주 업무라 두 칸을 차지한다. 타일 7개(주 업무 2칸 + 6) → 4열 2줄 · 3열 3줄 · 2열 4줄로 빈칸 없이 맞는다.
 * 개인정보 처리방침은 타일에서 빼고(tile:false) 업무별 안내와 바닥글에만 둔다.
 */
export default function QuickMenu() {
  return (
    <section className="home-quick" aria-labelledby="home-quick-title">
      <div className="section-head">
        <h2 id="home-quick-title">업무 바로가기</h2>
        <p className="muted small">누르면 각 업무의 상세 화면으로 가요.</p>
      </div>
      <ul className="qm-grid">
        {HOME_TASKS.filter((t) => t.tile !== false).map((t, i) => (
          <li key={t.route} className={i === 0 ? 'is-featured' : undefined}>
            <button type="button" className={`qm-tile${i === 0 ? ' is-featured' : ''}`} onClick={() => go(t.route)}>
              <span className="qm-icon">
                <TaskIcon name={t.icon} />
              </span>
              <span className="qm-text">
                <span className="qm-name">{t.name}</span>
                <span className="qm-desc">{t.short}</span>
              </span>
              <span className={`badge qm-badge${t.badgeTone ? ` ${t.badgeTone}` : ''}`}>{t.badge}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
