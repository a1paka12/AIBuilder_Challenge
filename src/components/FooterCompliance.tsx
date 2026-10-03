/*
 * 바닥글 맨 아래 "준수·점검 표시" 줄.
 * 인증마크가 아니다 — 우리가 직접 지키고 점검한 사실만 적는다.
 * 아이콘은 단순한 선(인라인 SVG, 장식)만 쓰고, 둥근 도장·방패 배지 모양은 쓰지 않는다.
 */
import type { ReactNode } from 'react'
import { go } from '../router'
import '../styles/footer-compliance.css'

function LineIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="fc-icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/* 점검표(클립보드 + 체크) */
const IconChecklist = () => (
  <LineIcon>
    <rect x="5" y="4" width="14" height="17" rx="1.5" />
    <path d="M9 4V3h6v1" />
    <path d="M8.5 10l1.5 1.5L12.5 9" />
    <path d="M14.5 10.5H16" />
    <path d="M8.5 15.5l1.5 1.5 2.5-2.5" />
    <path d="M14.5 16H16" />
  </LineIcon>
)

/* 문서(처리방침) */
const IconDocument = () => (
  <LineIcon>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6" />
    <path d="M9 16h6" />
  </LineIcon>
)

/* 꼬리표(AI 표시를 붙인다) */
const IconTag = () => (
  <LineIcon>
    <path d="M3 12V4h8l10 10-8 8z" />
    <path d="M7.5 8.5h.01" />
  </LineIcon>
)

/* 자물쇠(암호화·키 보관) */
const IconLock = () => (
  <LineIcon>
    <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    <path d="M12 14.5v2.5" />
  </LineIcon>
)

/* 말풍선 + 빗금(판단·대리·소개 안 함) */
const IconNoAdvice = () => (
  <LineIcon>
    <path d="M4 5h16v11H10l-4 3.5V16H4z" />
    <path d="M4 3l16 16" />
  </LineIcon>
)

interface Item {
  key: string
  icon: ReactNode
  title: string
  desc: ReactNode
}

const ITEMS: Item[] = [
  {
    key: 'a11y',
    icon: <IconChecklist />,
    title: '웹 접근성 자체 점검',
    desc: 'KWCAG 2.2 기준 자동 점검(axe-core) 심각 오류 0건 · 2026. 10. 3. · 인증 아님',
  },
  {
    key: 'privacy',
    icon: <IconDocument />,
    title: '개인정보 처리방침 공개',
    desc: (
      <>
        공제 메시지 본문은 서버에 저장하지 않아요.{' '}
        <button type="button" className="linklike fc-link" onClick={() => go('privacy')}>
          처리방침 보기
        </button>
      </>
    ),
  },
  {
    key: 'ai',
    icon: <IconTag />,
    title: 'AI 사용 고지',
    desc: 'AI가 정리한 결과에는 AI 표시를 붙여요(인공지능 기본법 제31조)',
  },
  {
    key: 'security',
    icon: <IconLock />,
    title: '정보보호',
    desc: 'HTTPS 암호화 · API 키는 서버에만 · 전화·계좌번호는 가린 뒤 전송',
  },
  {
    key: 'no-advice',
    icon: <IconNoAdvice />,
    title: '판단·대리·소개비 없음',
    desc: '법률 판단·대리를 하지 않고, 특정 변호사를 소개·알선하거나 대가(소개비·수수료·광고비)를 받지 않아요. 변호사 조건 추천은 무료 가상 프로필 시연(변호사법 제34조·제109조 고려)',
  },
]

export default function FooterCompliance() {
  return (
    <section className="fc" aria-labelledby="fc-title">
      <div className="fc-head">
        <h2 id="fc-title" className="fc-title">
          준수·점검 표시
        </h2>
        <p className="fc-note">인증을 받았다는 뜻이 아니에요 — 우리가 직접 지키고 점검한 내용이에요</p>
      </div>
      <ul className="fc-list">
        {ITEMS.map((it) => (
          <li key={it.key} className="fc-item">
            <span className="fc-icon-wrap">{it.icon}</span>
            <div className="fc-text">
              <strong className="fc-item-title">{it.title}</strong>
              <p className="fc-desc">{it.desc}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="fc-font">글꼴: Pretendard (SIL Open Font License 1.1)</p>
    </section>
  )
}
