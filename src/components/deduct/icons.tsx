import type { SVGProps } from 'react'

/* 공제 정리 화면 전용 선 아이콘(장식용, aria-hidden). 도장·방패·문장 같은 인증 모양은 쓰지 않는다. */
type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12.5l4.3 4.3L19 7" />
    </Svg>
  )
}

export function IconChevronDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9.5l6 6 6-6" />
    </Svg>
  )
}

export function IconExternal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9.5 9.5" />
      <path d="M19 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.5" />
    </Svg>
  )
}

export function IconCopy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </Svg>
  )
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5L21.5 20h-19z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.6h.01" />
    </Svg>
  )
}
