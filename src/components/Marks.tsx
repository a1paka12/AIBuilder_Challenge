/*
 * 우리가 합법적으로 붙일 수 있는 마크 2종만 모아 둔 부품.
 *  (a) 공공누리 제4유형 — 법무부 「주택임대차표준계약서」 인용 카드에만 쓴다.
 *  (b) 개인정보보호위원회 개인정보 처리 표시(라벨링) 라인형 아이콘 — 개인정보 처리방침 각 항목 옆에만 쓴다.
 * 정부 상징·기관 로고·인증마크는 여기에 추가하지 않는다.
 * 이 파일은 공용 CSS를 고치지 않도록 최소한의 인라인 스타일만 쓴다(className 으로 덮어쓸 수 있음).
 */
import type { CSSProperties, ReactNode } from 'react'

/* ── (a) 공공누리 제4유형 ───────────────────────── */

export const KOGL_TYPE4_ALT = '공공누리 제4유형: 출처표시, 상업적 이용금지, 변경금지'
export const KOGL_TYPE4_SRC = '/marks/kogl/kogl-type4.png'
export const KOGL_TYPE4_URL = 'https://www.kogl.or.kr/info/licenseType4.do'

const koglWrap: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '4px 8px',
  maxWidth: '100%',
}

/* 링크 클릭 영역은 44px 확보, 줄 높이는 음수 여백으로 그대로 둔다 */
const koglLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  margin: '-10px 0',
  flex: 'none',
}

/**
 * 공공누리 제4유형 마크. children 에 출처 문구를 넣으면 마크 옆에 작게 붙는다.
 * link=true(기본)면 마크가 공공누리 제4유형 이용조건 안내로 연결된다(공공누리 권장 방식).
 */
export function KoglType4({
  className,
  children,
  height = 24,
  link = true,
}: {
  className?: string
  children?: ReactNode
  height?: number
  link?: boolean
}) {
  // 원본 비율 488 × 130
  const width = Math.round((height * 488) / 130)
  const img = (
    <img
      src={KOGL_TYPE4_SRC}
      alt={KOGL_TYPE4_ALT}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      style={{ display: 'block', flex: 'none' }}
    />
  )
  return (
    <span className={['mark-kogl', className].filter(Boolean).join(' ')} style={koglWrap}>
      {link ? (
        <a
          href={KOGL_TYPE4_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="공공누리 제4유형 이용조건 보기(새 창)"
          style={koglLink}
        >
          {img}
        </a>
      ) : (
        img
      )}
      {children != null && <span className="mark-kogl-text">{children}</span>}
    </span>
  )
}

/** 표준계약서 인용 카드 출처 줄에 그대로 쓰는 문구 */
export const STD_CONTRACT_SOURCE_TEXT =
  '출처: 법무부 「주택임대차표준계약서」(2023. 10. 6. 개정) · 공공누리 제4유형(출처표시·상업적 이용금지·변경금지)'

/* ── (b) 개인정보 처리 표시(라벨링) ───────────────────────── */

export const PRIVACY_LABEL_CREDIT =
  '개인정보 처리 표시(라벨링) 아이콘: 개인정보보호위원회 「개인정보 처리방침 작성지침」(2024. 4.) 배포 자료'

/*
 * 우리가 실제로 하는 처리에 맞는 라벨만 골랐다.
 * 쓰지 않는 라벨(민감정보·고유식별정보·제3자 제공·가명정보·행태정보·개인정보 보호 인증·
 * 보호수준 평가·국내대리인 등)은 일부러 넣지 않았다. 특히 "개인정보 보호 인증"은 받지 않았으므로 절대 추가하지 않는다.
 */
export type PrivacyLabelKind =
  | 'purpose' // 처리 목적
  | 'items' // 처리 항목
  | 'retention' // 보유기간
  | 'destruction' // 파기
  | 'overseas' // 국외이전 (OpenAI, 미국)
  | 'entrust' // 처리위탁
  | 'rights' // 정보주체의 권리·의무
  | 'safety' // 안전성 확보조치
  | 'officer' // 개인정보 보호책임자
  | 'complaint' // 고충사항 처리부서(문의처)
  | 'remedy' // 권익침해 구제
  | 'auto' // 자동수집(쿠키 등) — "쓰지 않음" 안내 항목 옆에도 쓴다
  | 'policy-change' // 처리방침 변경(시행일)

interface LabelInfo {
  name: string
  file: string
  /** 원본 비율: 처리 단계 = 육각형(세로가 조금 김), 보호 의무 = 정사각형 */
  ratio: number
}

const HEX = 84 / 96
const SQ = 1

export const PRIVACY_LABELS: Record<PrivacyLabelKind, LabelInfo> = {
  purpose: { name: '처리 목적', file: 'pipc-purpose.png', ratio: HEX },
  items: { name: '처리 항목', file: 'pipc-items.png', ratio: HEX },
  retention: { name: '보유기간', file: 'pipc-retention.png', ratio: HEX },
  destruction: { name: '파기', file: 'pipc-destruction.png', ratio: HEX },
  overseas: { name: '국외이전', file: 'pipc-overseas.png', ratio: HEX },
  entrust: { name: '처리위탁', file: 'pipc-entrust.png', ratio: HEX },
  auto: { name: '자동수집', file: 'pipc-auto.png', ratio: HEX },
  rights: { name: '정보주체의 권리·의무', file: 'pipc-rights.png', ratio: SQ },
  safety: { name: '안전성 확보조치', file: 'pipc-safety.png', ratio: SQ },
  officer: { name: '개인정보 보호책임자', file: 'pipc-officer.png', ratio: SQ },
  complaint: { name: '고충사항 처리부서', file: 'pipc-complaint.png', ratio: SQ },
  remedy: { name: '권익침해 구제', file: 'pipc-remedy.png', ratio: SQ },
  'policy-change': { name: '처리방침 변경', file: 'pipc-policy-change.png', ratio: SQ },
}

function isKind(kind: string): kind is PrivacyLabelKind {
  return Object.prototype.hasOwnProperty.call(PRIVACY_LABELS, kind)
}

/**
 * 개인정보 처리 표시(라벨링) 아이콘 1개. 알 수 없는 kind 면 아무것도 그리지 않는다(null).
 * decorative=true 면 바로 옆 제목이 같은 말을 하므로 화면낭독기에는 읽히지 않게 alt="" 로 둔다.
 */
export function PrivacyLabel({
  kind,
  size = 40,
  decorative = false,
  className,
}: {
  kind: PrivacyLabelKind | string
  size?: number
  decorative?: boolean
  className?: string
}) {
  if (!isKind(kind)) return null
  const info = PRIVACY_LABELS[kind]
  const width = Math.round(size * info.ratio)
  return (
    <img
      className={['mark-pipc', className].filter(Boolean).join(' ')}
      src={`/marks/pipc/${info.file}`}
      alt={decorative ? '' : `개인정보 처리 표시: ${info.name}`}
      title={info.name}
      width={width}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ display: 'inline-block', flex: 'none', verticalAlign: 'middle' }}
    />
  )
}

/**
 * 처리방침 섹션 제목 + 라벨 아이콘. 기존 <h2>…</h2> 를 그대로 바꿔 끼우면 된다.
 * 아이콘은 제목과 같은 말이라 장식(alt="")으로 두고, 제목 글자가 의미를 전달한다.
 */
export function PrivacyHeading({
  kinds,
  children,
  as: Tag = 'h2',
  id,
}: {
  kinds: (PrivacyLabelKind | string)[]
  children: ReactNode
  as?: 'h2' | 'h3'
  id?: string
}) {
  return (
    <div className="privacy-heading" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '28px 0 12px' }}>
      <span style={{ display: 'inline-flex', gap: 4, flex: 'none' }}>
        {kinds.map((k) => (
          <PrivacyLabel key={k} kind={k} decorative size={36} />
        ))}
      </span>
      <Tag id={id} style={{ margin: 0, minWidth: 0 }}>
        {children}
      </Tag>
    </div>
  )
}

/**
 * 처리방침 맨 위에 두는 "주요 개인정보 처리 표시" 요약(작성지침 권장 형태).
 * 아이콘 아래에 이름을 함께 적어, 아이콘만으로 뜻을 짐작하게 하지 않는다.
 */
export function PrivacyLabelSummary({
  kinds,
  title = '주요 개인정보 처리 표시',
}: {
  kinds: (PrivacyLabelKind | string)[]
  title?: string
}) {
  const list = kinds.filter(isKind)
  if (list.length === 0) return null
  return (
    <section className="privacy-label-summary" aria-label={title} style={{ margin: '0 0 16px' }}>
      <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 15 }}>{title}</p>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
          gap: 8,
        }}
      >
        {list.map((k) => (
          <li
            key={k}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '10px 4px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface)',
              textAlign: 'center',
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            <PrivacyLabel kind={k} decorative size={40} />
            <span>{PRIVACY_LABELS[k].name}</span>
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ margin: '8px 0 0' }}>
        {PRIVACY_LABEL_CREDIT}
      </p>
    </section>
  )
}
