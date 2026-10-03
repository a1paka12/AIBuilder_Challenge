/*
 * 서비스 원칙 마크 5종 — 자체 디자인 선 아이콘. 화면에는 마크만 보이고 글자는 없다.
 * 이름은 aria-label(스크린리더)과 hover/focus 툴팁(CSS ::after, data-tip)으로만 드러난다.
 * 공식 인증마크로 오인되지 않게: 둥근 사각형 타일 + 단색 선 아이콘만 쓴다.
 * 원형 도장·톱니 테두리·방패·리본·월계관·별 모양, "인증/Certified/Verified" 류 글자는 넣지 않는다.
 */
import type { ReactNode } from 'react'
import '../styles/service-marks.css'

type Mark = { id: string; name: string; icon: ReactNode }

const MARKS: Mark[] = [
  {
    id: 'device-privacy',
    name: '기기 안에서 개인정보를 먼저 가려요',
    icon: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <path d="M11 19h2" />
        <rect x="9" y="10.5" width="6" height="5" rx="1" />
        <path d="M10.2 10.5V9a1.8 1.8 0 0 1 3.6 0v1.5" />
      </>
    ),
  },
  {
    id: 'ai-no-judgement',
    name: 'AI는 정리만 하고 판단하지 않아요',
    icon: (
      <>
        <path d="M12 4v15" />
        <path d="M8 20h8" />
        <path d="M5 7h14" />
        <path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0Z" />
        <path d="M19 7l-2.5 6a2.5 2.5 0 0 0 5 0Z" />
        <path d="M3 3l18 18" />
      </>
    ),
  },
  {
    id: 'zero-fee',
    name: '변호사 소개비·수수료 0원',
    icon: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <ellipse cx="12" cy="12" rx="2.5" ry="3.5" />
        <path d="M6 12h.01" />
        <path d="M18 12h.01" />
      </>
    ),
  },
  {
    id: 'no-server-storage',
    name: '공제 문자 본문은 서버에 저장하지 않아요',
    icon: (
      <>
        <rect x="2" y="4" width="14" height="6" rx="1.5" />
        <rect x="2" y="14" width="14" height="6" rx="1.5" />
        <path d="M5.5 7h.01" />
        <path d="M5.5 17h.01" />
        <path d="M18 10l4 4" />
        <path d="M22 10l-4 4" />
      </>
    ),
  },
  {
    id: 'keyboard',
    name: '키보드만으로 모든 기능을 쓸 수 있어요',
    icon: (
      <>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M6 10h.01" />
        <path d="M10 10h.01" />
        <path d="M14 10h.01" />
        <path d="M18 10h.01" />
        <path d="M8 14h8" />
      </>
    ),
  },
]

export default function ServiceMarks({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  return (
    <ul className={`smarks smarks--${variant}`} aria-label="보증금 지킴이의 원칙">
      {MARKS.map((m) => (
        <li key={m.id} className="smarks-item">
          <span className="smarks-tile" role="img" aria-label={m.name} tabIndex={0} data-tip={m.name}>
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              {m.icon}
            </svg>
          </span>
        </li>
      ))}
    </ul>
  )
}
