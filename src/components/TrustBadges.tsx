import { useId, type ReactNode } from 'react';
import '../styles/trust.css';

type TrustPromise = {
  title: string;
  desc: string;
  icon: ReactNode;
};

/* 단순한 선 아이콘 (24px, stroke). 도장·방패·리본·월계관 같은 인증 모양은 쓰지 않는다. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="trust-icon"
      width="24"
      height="24"
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
  );
}

const PROMISES: TrustPromise[] = [
  {
    title: '판단하지 않아요',
    desc: 'AI는 항목과 금액을 정리만 하고, 공제가 맞는지는 판단하지 않아요.',
    icon: (
      <Icon>
        <rect x="5" y="3.5" width="14" height="17" rx="2" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </Icon>
    ),
  },
  {
    title: '고르는 건 나',
    desc: '물어볼 항목과 보낼 문자는 내가 확인하고 골라요.',
    icon: (
      <Icon>
        <rect x="4" y="4" width="16" height="16" rx="2.5" />
        <path d="M8 12.2l2.7 2.7L16 9.5" />
      </Icon>
    ),
  },
  {
    title: '메시지는 저장하지 않아요',
    desc: '붙여 넣은 공제 메시지는 정리에만 쓰고 서버에 저장하지 않아요.',
    icon: (
      <Icon>
        <path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-8l-4 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z" />
        <path d="M3 3l18 18" />
      </Icon>
    ),
  },
  {
    title: '사진은 내 기기에',
    desc: '방 사진은 서버로 보내지 않고, 파일 지문만 기록해요.',
    icon: (
      <Icon>
        <rect x="6.5" y="2.5" width="11" height="19" rx="2" />
        <path d="M9 14.5l2-2.2 1.6 1.6 1.4-1.4 1 1" />
        <path d="M11 18.5h2" />
      </Icon>
    ),
  },
  {
    title: 'AI 사용을 알려요',
    desc: '어느 기능에 생성형 AI를 쓰는지 화면에 밝혀요.',
    icon: (
      <Icon>
        <path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z" />
        <path d="M18 15.5v4M16 17.5h4" />
      </Icon>
    ),
  },
  {
    title: '소개비·성공보수 없음',
    desc: '변호사 소개비나 돌려받은 돈의 수수료를 받지 않아요.',
    icon: (
      <Icon>
        <rect x="3" y="6.5" width="18" height="11" rx="1.5" />
        <path d="M7 12h.01M17 12h.01" />
        <path d="M4 20L20 4" />
      </Icon>
    ),
  },
];

export default function TrustBadges() {
  const headingId = useId();

  return (
    <section className="trust" aria-labelledby={headingId}>
      <div className="trust-head">
        <h2 id={headingId} className="trust-title">
          보증금 지킴이의 약속
        </h2>
        <p className="trust-sub muted small">인증마크가 아니라, 이 서비스가 지키는 운영 원칙이에요.</p>
      </div>
      <ul className="trust-grid">
        {PROMISES.map((p) => (
          <li key={p.title} className="trust-item">
            <span className="trust-icon-box">{p.icon}</span>
            <div className="trust-text">
              <h3 className="trust-item-title">{p.title}</h3>
              <p className="trust-item-desc">{p.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
