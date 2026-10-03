import type { ReactNode } from 'react'

/*
 * 첫 화면 선 아이콘 (24px, stroke). 장식이라 aria-hidden.
 * 정부 상징·기관 로고·인증 도장·방패·리본 모양은 쓰지 않는다.
 */
export type TaskIconName = 'message' | 'camera' | 'letter' | 'building' | 'gift' | 'receipt' | 'lock' | 'check' | 'person'

const PATHS: Record<TaskIconName, ReactNode> = {
  /* 말풍선 + 줄 (공제 문자 정리) */
  message: (
    <>
      <path d="M4 5.5h16v11h-9l-4 3.5v-3.5H4z" />
      <path d="M8 9.5h8M8 12.5h5" />
    </>
  ),
  /* 카메라 (방 상태 기록) */
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  /* 봉투 (내용증명 서식) */
  letter: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </>
  ),
  /* 건물 (상담 기관) */
  building: (
    <>
      <path d="M4 20h16" />
      <path d="M6 20V9.5L12 5l6 4.5V20" />
      <path d="M10 20v-5h4v5" />
      <path d="M9 11.5h2M13 11.5h2" />
    </>
  ),
  /* 선물 상자 (이벤트) */
  gift: (
    <>
      <rect x="4" y="9.5" width="16" height="10.5" rx="1.5" />
      <path d="M12 9.5V20M4 14h16" />
      <path d="M12 9.5c-1.6-3.2-5.2-3.6-5.2-1.4S10.2 9.5 12 9.5zm0 0c1.6-3.2 5.2-3.6 5.2-1.4S13.8 9.5 12 9.5z" />
    </>
  ),
  /* 영수증 (가격 안내) */
  receipt: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  /* 자물쇠 (개인정보 처리방침) */
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="1.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <path d="M12 14.5v2.5" />
    </>
  ),
  /* 사람 + 돋보기 (변호사 찾아보기) */
  person: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.4 2.8-5.3 5.5-5.3 1.2 0 2.3.4 3.2 1" />
      <circle cx="16.5" cy="15.5" r="3" />
      <path d="M18.7 17.7l2.3 2.3" />
    </>
  ),
  /* 체크 (사실 목록) */
  check: <path d="M5 12.5l4.3 4.3L19 7" />,
}

export function TaskIcon({ name, size = 24, strokeWidth = 1.8 }: { name: TaskIconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
