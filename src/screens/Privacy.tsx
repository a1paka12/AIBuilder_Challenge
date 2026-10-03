import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { go } from '../router'
import { COMPANY } from '../data/company'
import { PRIVACY_LABEL_CREDIT, PrivacyHeading, PrivacyLabel, type PrivacyLabelKind } from '../components/Marks'
import '../styles/privacy.css'

/*
 * 개인정보 처리방침 (#/privacy) — 카드사 처리방침 꼴(판 선택 → 처리방침이란? → 처리 표시(라벨링) → 목차 → 조문 → 변경 이력)
 * 사실만 적는다: 코드(src/, server/server.mjs)와 서버 설정에서 확인된 처리만 쓰고, 지어낸 숫자·연락처·인증은 넣지 않는다.
 * 해시 라우팅이라 #앵커 링크 대신 버튼으로 스크롤 + 포커스 이동. 넓은 표는 감싸개만 옆으로 밀린다(넘칠 때만 포커스 가능).
 * 라벨 아이콘은 개인정보보호위원회 처리 표시(라벨링) 배포 자료(Marks.tsx)만 쓰고, 하지 않는 처리(제3자 제공)에는 라벨을 붙이지 않는다.
 */

const EFFECTIVE = '2026. 10. 3.'
/** 외부 정책(OpenAI·Oracle) 확인일 */
const CHECKED = '2026. 10. 3.'
/** 서버 기록 보유 종료일 — 대회 데모 운영 기간 종료. docs/PRIVACY_LEGAL.md 와 같은 값 */
const RETENTION_END = '2026. 12. 31.'
/** src/api.ts clientId() 와 같은 키. 여기서는 "읽기만" 한다 — 처리방침을 본 것만으로 ID 를 새로 만들지 않기 위해 */
const CLIENT_ID_KEY = 'bj_client_id'

const OPENAI_POLICY_URL = 'https://openai.com/enterprise-privacy/'
const OPENAI_DATA_URL = 'https://developers.openai.com/api/docs/guides/your-data'
const OPENAI_PRIVACY_URL = 'https://openai.com/policies/privacy-policy/'
const ORACLE_PRIVACY_URL = 'https://www.oracle.com/legal/privacy/privacy-policy.html'
const ORACLE_INQUIRY_URL = 'https://www.oracle.com/legal/data-privacy-inquiry-form/'
const GOOGLE_PRIVACY_URL = 'https://policies.google.com/privacy?hl=ko'
/** 회원 동의 버전 — server.mjs users.consent_version 과 같은 값 */
const CONSENT_VERSION = '2026-10-03'

const VERSIONS = [{ id: 'v1', label: `${EFFECTIVE} 제정·시행 (현재 판)` }]

interface ArticleDef {
  id: string
  no: string
  title: string
  kinds: PrivacyLabelKind[]
}

const ARTICLES: ArticleDef[] = [
  { id: 'pv-a1', no: '제1조', title: '개인정보의 처리 목적', kinds: ['purpose'] },
  { id: 'pv-a2', no: '제2조', title: '처리하는 개인정보 항목과 수집 방법', kinds: ['items'] },
  { id: 'pv-a3', no: '제3조', title: '개인정보의 처리 및 보유기간', kinds: ['retention'] },
  { id: 'pv-a4', no: '제4조', title: '개인정보의 제3자 제공(하지 않음)', kinds: [] },
  { id: 'pv-a5', no: '제5조', title: '개인정보의 처리 위탁 및 국외 이전', kinds: ['entrust', 'overseas'] },
  { id: 'pv-a6', no: '제6조', title: '개인정보의 파기', kinds: ['destruction'] },
  { id: 'pv-a7', no: '제7조', title: '정보주체의 권리·의무와 행사 방법', kinds: ['rights'] },
  { id: 'pv-a8', no: '제8조', title: '개인정보의 안전성 확보 조치', kinds: ['safety'] },
  { id: 'pv-a9', no: '제9조', title: '자동 수집 장치(로그인 유지 쿠키·브라우저 저장소)', kinds: ['auto'] },
  { id: 'pv-a10', no: '제10조', title: 'AI 처리와 자동화된 결정', kinds: [] },
  { id: 'pv-a11', no: '제11조', title: '만 14세 미만 아동의 개인정보', kinds: [] },
  { id: 'pv-a12', no: '제12조', title: '개인정보 보호 담당과 문의처', kinds: ['officer', 'complaint'] },
  { id: 'pv-a13', no: '제13조', title: '권익침해 구제 방법', kinds: ['remedy'] },
  { id: 'pv-a14', no: '제14조', title: '개인정보 처리방침의 변경', kinds: ['policy-change'] },
]
const A = Object.fromEntries(ARTICLES.map((a) => [a.id, a])) as Record<string, ArticleDef>

interface Tile {
  kind: PrivacyLabelKind | null
  title: string
  summary: string
  target: string
}

const TILES: Tile[] = [
  { kind: 'items', title: '처리 항목', summary: '회원 정보(이메일·비밀번호 해시 또는 구글 식별값) · 공제 문자 텍스트(저장 안 함) · 가린 방 사진 처리본(로그인 후 저장한 경우) · 사진 지문 · 설문·구매 의향 응답 · 무작위 기기 ID', target: 'pv-a2' },
  { kind: 'purpose', title: '처리 목적', summary: '회원 식별·로그인 유지 · 공제 내역 정리 · 방 상태 기록 보관·다시 보기 · 설문·의향 집계 · 서비스 운영', target: 'pv-a1' },
  { kind: 'retention', title: '보유기간', summary: `회원 정보·저장한 사진은 삭제·탈퇴 즉시 삭제 · 공제 문자는 정리 직후 삭제 · 서버 기록은 늦어도 ${RETENTION_END}까지`, target: 'pv-a3' },
  { kind: null, title: '제3자 제공', summary: '하지 않아요', target: 'pv-a4' },
  { kind: 'overseas', title: '국외 이전', summary: 'OpenAI(미국) · Oracle 도쿄 리전(일본)', target: 'pv-a5' },
  { kind: 'complaint', title: '고충처리 부서', summary: `${COMPANY.operator} · ${COMPANY.contactLabel}`, target: 'pv-a12' },
]

/** 우리와 별개 기관 — 신고·상담은 각 기관에 직접 */
const REMEDY = [
  { name: '개인정보 침해신고센터', org: '한국인터넷진흥원 운영', what: '개인정보 침해 신고·상담', url: 'https://privacy.kisa.or.kr', host: 'privacy.kisa.or.kr', tel: '118' },
  { name: '개인정보분쟁조정위원회', org: '', what: '개인정보 분쟁 조정 신청', url: 'https://www.kopico.go.kr', host: 'www.kopico.go.kr', tel: '1833-6972' },
  { name: '대검찰청 사이버수사과', org: '', what: '사이버 범죄 신고', url: 'https://www.spo.go.kr', host: 'www.spo.go.kr', tel: '1301' },
  { name: '경찰청 사이버범죄 신고시스템(ECRM)', org: '', what: '사이버 범죄 신고', url: 'https://ecrm.police.go.kr', host: 'ecrm.police.go.kr', tel: '182' },
]

/* ── 작은 도우미 ───────────────────────────────────── */

/** 화면 안의 조문으로 이동 (해시 라우팅이라 #앵커 링크 대신 스크롤 + 포커스 이동) */
function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
}

function readClientId(): string | null {
  try {
    return window.localStorage.getItem(CLIENT_ID_KEY)
  } catch {
    return null
  }
}

async function copyText(s: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(s)
    return true
  } catch {
    /* 권한 없음·비보안 문맥 — 아래 예비 방법 */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = s
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function IconExternal() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9.5 9.5" />
      <path d="M19 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5.5" />
    </svg>
  )
}

/* 제3자 제공 "하지 않음" 칸의 선 그림(장식) — 라벨 아이콘이 아니며 도장·방패 모양이 아니다 */
function IconNoShare() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 12h9" />
      <path d="M10 8l4 4-4 4" />
      <rect x="16" y="6" width="5" height="12" rx="1" />
      <path d="M3 3l18 18" />
    </svg>
  )
}

/** 외부 링크: 새 창 + 스크린리더용 "(새 창)" */
function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="pv-ext" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="pv-sr-only"> (새 창)</span>
      <IconExternal />
    </a>
  )
}

/** 표 감싸개 — 390px 에서 넘칠 때만 가로 스크롤 영역이 되고, 그때만 키보드로 잡을 수 있다 */
function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setScroll(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    ro?.observe(el)
    window.addEventListener('resize', check)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [])
  return (
    <>
      {scroll && (
        <p className="pv-scroll-hint muted" aria-hidden="true">
          표가 넓어요. 옆으로 밀어 보세요.
        </p>
      )}
      <div
        ref={ref}
        className={`pv-table-wrap${scroll ? ' is-scroll' : ''}`}
        tabIndex={scroll ? 0 : undefined}
        role={scroll ? 'region' : undefined}
        aria-label={scroll ? `${label} (옆으로 밀어 볼 수 있는 표)` : undefined}
      >
        {children}
      </div>
    </>
  )
}

function Article({ id, children, extra }: { id: string; children: ReactNode; extra?: ReactNode }) {
  const a = A[id]
  const hid = `${id}-title`
  return (
    <section id={id} className="pv-article" tabIndex={-1} aria-labelledby={hid}>
      <PrivacyHeading kinds={a.kinds} id={hid}>
        <span className="pv-article-no">{a.no}</span>
        {a.title}
        {extra}
      </PrivacyHeading>
      {children}
    </section>
  )
}

/* ── 제7조: 내 기기 ID 보기·복사 ───────────────────── */

function ClientIdBox() {
  const [id] = useState(readClientId)
  const [status, setStatus] = useState('')
  const uid = useId()
  const copy = async () => {
    if (!id) return
    const ok = await copyText(id)
    setStatus(ok ? '기기 ID를 복사했어요.' : '복사하지 못했어요. ID 를 길게 눌러 직접 복사해 주세요.')
  }
  return (
    <div className="pv-idbox" role="group" aria-labelledby={`${uid}-h`}>
      <h3 id={`${uid}-h`}>내 기기 ID</h3>
      {id ? (
        <>
          <p>설문·구매 의향 기록은 이 ID 로만 찾을 수 있어요. 삭제·열람을 요청할 때 이 ID 를 적어 주세요.</p>
          <div className="pv-idrow">
            <p className="pv-id" id={`${uid}-id`}>
              {id}
            </p>
            <button type="button" className="btn" onClick={() => void copy()} aria-describedby={`${uid}-id`}>
              내 기기 ID 복사
            </button>
          </div>
          <p className="pv-idstatus" role="status" aria-live="polite">
            {status}
          </p>
        </>
      ) : (
        <p>
          이 기기·브라우저에는 아직 기기 ID 가 없어요. 30초 현장 설문이나 구매 의향에 참여할 때 무작위로 만들어지고, 그전에는 서버에 이 기기의
          기록도 없어요.
        </p>
      )}
    </div>
  )
}

/* ── 화면 ─────────────────────────────────────────── */

export default function Privacy() {
  const uid = useId()
  const [version, setVersion] = useState(VERSIONS[0].id)

  return (
    <section className="pv">
      <nav className="pv-crumb" aria-label="현재 위치">
        <ol>
          <li>
            <button type="button" className="linklike" onClick={() => go('home')}>
              처음
            </button>
          </li>
          <li aria-current="page">개인정보 처리방침</li>
        </ol>
      </nav>

      {/* 머리: 제목 · 판 선택 */}
      <header className="pv-head">
        <h1>개인정보 처리방침</h1>
        <p className="pv-lead">
          {COMPANY.serviceName}는 회원가입 없이도 모든 기능을 쓸 수 있고, 회원가입은 선택이에요. 가입하더라도 이메일과 로그인에 필요한 값만 받고, 방 사진은 로그인 후 직접 저장할 때만 가린 처리본을 받아요. 서비스에 꼭 필요한 최소한의 정보만 처리해요. 아래에서 무엇을, 왜, 얼마나 처리하는지 조문별로
          확인할 수 있어요.
        </p>
        <div className="pv-version">
          <label htmlFor={`${uid}-ver`} className="pv-version-label">
            판 선택
          </label>
          <select
            id={`${uid}-ver`}
            className="pv-version-select"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            aria-describedby={`${uid}-ver-note`}
          >
            {VERSIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <span className="badge">시행 {EFFECTIVE}</span>
          <p id={`${uid}-ver-note`} className="pv-version-note small muted">
            지금은 제정 판 하나뿐이에요. 개정하면 이전 판도 이 상자에서 고를 수 있게 해요.
          </p>
        </div>
      </header>

      {/* 처리방침이란? */}
      <section className="card pv-intro" aria-labelledby="pv-intro-title">
        <h2 id="pv-intro-title">개인정보 처리방침이란?</h2>
        <p>
          {COMPANY.operator}(이하 "팀")은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고, 이와 관련한 고충을 신속하고 원활하게 처리할
          수 있도록 이 개인정보 처리방침을 세워 공개해요.
        </p>
        <p>
          <dfn>정보주체</dfn>란 처리되는 정보로 알아볼 수 있는 사람으로서 그 정보의 주체가 되는 사람(법 제2조 제3호)을 말해요. 이 처리방침은 누리집
          bojeung.193-123-163-215.sslip.io 와 그 API 에 적용돼요.
        </p>
      </section>

      {/* 주요 개인정보 처리 표시(라벨링) */}
      <section aria-labelledby="pv-labels-title">
        <div className="pv-labels-head">
          <h2 id="pv-labels-title">주요 개인정보 처리 표시(라벨링)</h2>
          <p className="muted small">한눈에 보는 요약이에요. 세부 내용은 각 조문에서 확인해 주세요.</p>
        </div>
        <ul className="pv-tiles">
          {TILES.map((t) => {
            const a = A[t.target]
            return (
              <li key={t.title} className="pv-tile">
                {t.kind ? (
                  <span className="pv-tile-icon">
                    <PrivacyLabel kind={t.kind} decorative size={44} />
                  </span>
                ) : (
                  <span className="pv-tile-icon is-none">
                    <IconNoShare />
                  </span>
                )}
                <h3>{t.title}</h3>
                <p>{t.summary}</p>
                <button type="button" className="linklike pv-tile-link" onClick={() => jumpTo(t.target)}>
                  {a.no} {t.title} 자세히 보기
                </button>
              </li>
            )
          })}
        </ul>
        <p className="pv-credit small muted">{PRIVACY_LABEL_CREDIT}. 하지 않는 처리(제3자 제공)에는 라벨을 붙이지 않았어요.</p>
      </section>

      <div className="pv-layout">
        {/* 목차 */}
        <nav className="pv-toc" aria-labelledby="pv-toc-title">
          <h2 id="pv-toc-title">목차</h2>
          <ol>
            {ARTICLES.map((a) => (
              <li key={a.id}>
                <button type="button" className="pv-toc-btn" onClick={() => jumpTo(a.id)}>
                  <b>{a.no}</b>
                  <span>{a.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* 조문 */}
        <article className="card pv-body">
          {/* 제1조 */}
          <Article id="pv-a1">
            <p>팀은 다음 목적을 위해서만 개인정보를 처리해요. 목적이 바뀌면 「개인정보 보호법」 제18조에 따라 별도 동의를 받는 등 필요한 조치를 해요.</p>
            <TableWrap label="제1조 처리 목적">
              <table className="pv-table wide cols-3">
                <caption>처리 목적과 관련 기능</caption>
                <thead>
                  <tr>
                    <th scope="col">구분</th>
                    <th scope="col">처리 목적</th>
                    <th scope="col">관련 기능</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">회원 식별·로그인 유지</th>
                    <td>회원가입한 사람을 알아보고, 다시 들어올 때 로그인 상태를 유지하기(선택 가입 — 가입하지 않아도 모든 기능을 쓸 수 있어요)</td>
                    <td>회원가입·로그인·내 계정</td>
                  </tr>
                  <tr>
                    <th scope="row">공제 내역 정리</th>
                    <td>붙여 넣은 공제 문자에서 항목·금액·원문 구절을 표로 옮겨 적기(공제가 맞는지 판단하지 않아요)</td>
                    <td>공제 정리</td>
                  </tr>
                  <tr>
                    <th scope="row">방 상태 기록</th>
                    <td>개인정보를 가리고 메타데이터를 지운 사진 처리본의 지문(SHA-256)과 서버가 받은 시각을 기록해 "이 시각에 이 파일이 있었다"는 기록을 남기기</td>
                    <td>방 상태 기록·기록북</td>
                  </tr>
                  <tr>
                    <th scope="row">방 상태 기록 보관·다시 보기</th>
                    <td>로그인한 회원이 저장을 고른 경우, 가린 사진 처리본과 구역·입주/퇴실·메모를 내 계정에 보관해 나중에 다른 기기에서도 다시 보고 기록북을 만들 수 있게 하기</td>
                    <td>방 상태 기록·기록북(로그인 시)</td>
                  </tr>
                  <tr>
                    <th scope="row">30초 현장 설문·구매 의향</th>
                    <td>선택지 응답과 구매 의향을 익명으로 집계해 서비스 개선과 유료 상품 가설 검증에 쓰기(결제 아님)</td>
                    <td>이벤트·가격 안내</td>
                  </tr>
                  <tr>
                    <th scope="row">익명 사용 집계</th>
                    <td>날짜·기능별 사용 횟수만 세어 서비스 개선에 쓰기(내용은 세지 않아요)</td>
                    <td>모든 화면</td>
                  </tr>
                  <tr>
                    <th scope="row">서비스 안정 운영</th>
                    <td>같은 접속 주소의 요청을 분당 30회(로그인·가입 요청은 분당 10회)로 제한해 남용을 막기</td>
                    <td>API 전체</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <p className="small muted">마케팅·광고·위치정보 수집은 하지 않아요. 회원 정보를 설문 응답과 연결하지 않고, 로그인하지 않고 남긴 사진 지문 기록과도 연결하지 않아요. 로그인 후 저장한 사진만 그 회원 계정에 묶여요.</p>
          </Article>

          {/* 제2조 */}
          <Article id="pv-a2">
            <p>처리하는 항목은 아래가 전부예요. 이름·전화번호·프로필 사진·계좌번호·주민등록번호는 받지 않아요. 방 사진은 로그인하지 않으면 지문만, 로그인 후 저장하면 가린 처리본만 받고, 원본(가리기 전 사진)은 받지 않아요. 구글로 가입해도 이름·프로필 사진은 저장하지 않아요.</p>
            <TableWrap label="제2조 처리 항목">
              <table className="pv-table wide">
                <caption>처리 항목 · 수집 방법 · 저장 위치</caption>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">내용</th>
                    <th scope="col">수집 방법</th>
                    <th scope="col">저장 위치</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">회원 정보(선택 가입)</th>
                    <td>
                      이메일 주소, 이메일로 가입한 경우 비밀번호의 암호화 해시(scrypt, 원래 비밀번호는 저장하지 않아요), 구글로 가입한 경우 구글 계정 식별값(sub),
                      가입 방법, 동의한 약관 버전({CONSENT_VERSION}), 가입 시각·최근 로그인 시각
                    </td>
                    <td>
                      회원가입 화면에서 직접 입력할 때 · [구글로 간편 가입]·구글 로그인을 쓸 때 구글로부터 이메일·계정 식별값을 받아요(이름·사진은 받아도
                      저장하지 않아요)
                    </td>
                    <td>서버 DB(users)</td>
                  </tr>
                  <tr>
                    <th scope="row">로그인 유지 쿠키</th>
                    <td>회원 번호·발급 시각·서버 서명으로 된 값(bj_session). 이메일·비밀번호는 들어 있지 않아요</td>
                    <td>로그인·가입할 때 서버가 브라우저에 저장</td>
                    <td>브라우저(제9조)</td>
                  </tr>
                  <tr>
                    <th scope="row">공제 문자 텍스트</th>
                    <td>사용자가 붙여 넣은 글. 브라우저에서 먼저 주민등록번호·전화번호·계좌번호·이메일 등을 [전화번호 삭제] 같은 형식으로 가린 처리본을 만들고, 사용자가 전송본을 확인한 뒤에만 보내요. 서버가 같은 패턴을 2차로 다시 가린 뒤 AI 에 넘겨요</td>
                    <td>공제 정리에서 [정리하기]를 누를 때</td>
                    <td>저장 안 함(처리 중 서버 메모리만, 로그에도 본문 없음)</td>
                  </tr>
                  <tr>
                    <th scope="row">사진 지문·수신 시각·서버 서명</th>
                    <td>기기 안에서 개인정보를 가리고 메타데이터를 지운 사진 처리본의 SHA-256 지문(64자), 서버가 받은 시각, 위변조 확인용 서명. 지문으로 사진을 되살릴 수 없어요. 로그인하지 않으면 지문만 보내요</td>
                    <td>방 상태 기록에서 가린 처리본을 확인하고 기록할 때</td>
                    <td>서버 DB(receipts)</td>
                  </tr>
                  <tr>
                    <th scope="row">가린 방 사진 처리본(로그인 후 저장한 경우)</th>
                    <td>
                      기기에서 개인정보를 가리고 메타데이터(촬영 날짜·위치 등)를 지운 처리본 이미지(JPEG·PNG), 구역, 입주/퇴실, 메모(선택, 300자 이내), 서버가
                      받은 시각·지문·서명, 사진 저장 동의 시각. 원본은 받지 않고, 메타데이터가 남은 파일은 서버가 거절해요. 회원당 30장까지
                    </td>
                    <td>로그인한 상태로 방 상태 기록에서 [확인하고 기록하기]를 누를 때(처음 저장할 때 사진 저장 동의를 받아요)</td>
                    <td>서버 DB(photos·users.photo_consent_at)와 서버 디스크(회원별 사진 폴더)</td>
                  </tr>
                  <tr>
                    <th scope="row">30초 현장 설문 응답</th>
                    <td>선택지 응답(공제 경험·문의 여부·이유), 무작위 기기 ID, 응답 시각. 자유 입력 칸은 없어요</td>
                    <td>설문에서 [응답 보내기]를 누를 때</td>
                    <td>서버 DB(survey)</td>
                  </tr>
                  <tr>
                    <th scope="row">구매 의향</th>
                    <td>상품·가설 가격·무작위 기기 ID·시각(결제가 아니에요)</td>
                    <td>가격 안내에서 의향 버튼을 누를 때</td>
                    <td>서버 DB(intents)</td>
                  </tr>
                  <tr>
                    <th scope="row">익명 사용 집계</th>
                    <td>날짜·기능 이름·횟수만. 누가 썼는지 알 수 없어요</td>
                    <td>기능을 쓸 때 자동</td>
                    <td>서버 DB(metrics)</td>
                  </tr>
                  <tr>
                    <th scope="row">접속 IP 주소</th>
                    <td>요청 속도 제한(분당 30회, 로그인·가입은 분당 10회) 확인에만 써요</td>
                    <td>접속 시 자동</td>
                    <td>서버 메모리에서 1분, 파일·DB 저장 안 함</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <div className="notice pv-callout" role="note">
              <strong>사진 저장 동의</strong>
              <p>
                로그인한 회원이 처음으로 사진을 저장할 때, 전송본 확인 화면에서 "[필수] 가린 사진을 서버(일본 도쿄)에 보관하는 데 동의해요"에 체크를 받아요.
                사진 저장에 꼭 필요한 동의라, 체크하지 않으면 아무것도 보내지 않고 저장되지 않아요. 동의 철회는 저장한 사진을 모두 지우거나 회원 탈퇴로 할 수
                있어요.
              </p>
            </div>
            <h3>브라우저 안에서만 쓰는 것</h3>
            <ul className="pv-list is-plain">
              <li>방 사진 원본, 기록북 미리보기·PDF — 원본은 내 기기 안에서만 처리하고 서버로 보내지 않아요. 로그인하지 않으면 가림·메타데이터 제거를 마친 처리본의 지문만, 로그인 후 저장하면 그 가린 처리본만 보내요. 사진에서 촬영 날짜·위치 같은 정보는 읽지 않고 기기에서 지우며, 기록 날짜는 서버가 받은 시각이에요.</li>
              <li>AI 정리 결과 표, 특약 문구, 문의 문자 — 화면에서만 쓰고 새로고침하면 사라져요.</li>
              <li>내용증명 서식의 이름·주소·연락처·계좌번호 칸 — 브라우저 안에서 채워 인쇄(PDF 저장)만 해요. 서버에는 "PDF 를 만들었다"는 익명 횟수만 가요.</li>
            </ul>
          </Article>

          {/* 제3조 */}
          <Article id="pv-a3">
            <p>
              팀은 법령이나 정보주체 동의로 정한 기간 안에서만 개인정보를 보유해요. 서버 기록은 대회 데모 운영 기간이 끝나는 <b className="num">{RETENTION_END}</b>{' '}
              까지 보관한 뒤 일괄 삭제하고, 삭제 요청을 받으면 그 전에라도 바로 삭제해요. 회원 정보와 그 회원이 저장한 사진은 회원 탈퇴 즉시 삭제해요.
            </p>
            <TableWrap label="제3조 보유기간">
              <table className="pv-table wide cols-3">
                <caption>항목별 보유기간</caption>
                <thead>
                  <tr>
                    <th scope="col">항목</th>
                    <th scope="col">보유기간</th>
                    <th scope="col">비고</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">회원 정보</th>
                    <td className="num">탈퇴 즉시 삭제, 늦어도 {RETENTION_END} 일괄 삭제</td>
                    <td>내 계정 → [회원 탈퇴]로 바로 지울 수 있어요(제7조)</td>
                  </tr>
                  <tr>
                    <th scope="row">로그인 유지 쿠키(bj_session)</th>
                    <td>30일 또는 로그아웃·탈퇴할 때까지</td>
                    <td>제9조 참고</td>
                  </tr>
                  <tr>
                    <th scope="row">공제 문자 텍스트</th>
                    <td>정리 결과를 돌려준 즉시 서버 메모리에서 사라져요(저장·로그 없음)</td>
                    <td>AI 제공사 쪽 보관은 제5조 참고(최대 30일)</td>
                  </tr>
                  <tr>
                    <th scope="row">가린 방 사진 처리본·구역·입주/퇴실·메모</th>
                    <td className="num">사진을 삭제하거나 탈퇴하면 즉시 삭제, 늦어도 {RETENTION_END} 일괄 삭제</td>
                    <td>방 상태 기록의 저장한 사진 목록에서 [삭제]로 한 장씩, 탈퇴하면 전부 지워져요(파일·기록 모두)</td>
                  </tr>
                  <tr>
                    <th scope="row">사진 지문·수신 시각·서명</th>
                    <td className="num">{RETENTION_END}까지, 요청 시 즉시</td>
                    <td>기기 ID 와 연결돼 있지 않아 지문 값(64자)을 알려 주시면 지워요</td>
                  </tr>
                  <tr>
                    <th scope="row">설문 응답·구매 의향</th>
                    <td className="num">{RETENTION_END}까지, 요청 시 즉시</td>
                    <td>내 기기 ID 로 찾아 지워요(제7조)</td>
                  </tr>
                  <tr>
                    <th scope="row">익명 사용 집계</th>
                    <td className="num">{RETENTION_END}까지</td>
                    <td>횟수만 있어 개인을 알아볼 수 없지만 같은 시점에 함께 지워요</td>
                  </tr>
                  <tr>
                    <th scope="row">접속 IP 주소</th>
                    <td>1분(서버 메모리)</td>
                    <td>서버를 다시 시작하면 바로 사라져요</td>
                  </tr>
                  <tr>
                    <th scope="row">브라우저 저장소 값</th>
                    <td>사용자가 지울 때까지</td>
                    <td>제9조 참고</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
          </Article>

          {/* 제4조 */}
          <Article id="pv-a4">
            <p>팀은 개인정보를 제3자에게 제공하지 않아요. 광고·마케팅 목적으로 다른 회사에 넘기는 일도 없어요.</p>
            <p>
              다만 「개인정보 보호법」 제17조·제18조에 따라 법률에 특별한 규정이 있거나, 수사기관이 법령이 정한 절차와 방법에 따라 요구하는 경우에는 그 범위
              안에서 제공할 수 있어요.
            </p>
            <p className="small muted">제5조의 국외 이전은 "제공"이 아니라 서비스 운영을 위한 "처리 위탁"이에요. 받는 쪽은 우리 지시 범위 안에서만 처리해요.</p>
          </Article>

          {/* 제5조 */}
          <Article id="pv-a5">
            <p>
              팀은 서비스 운영을 위해 아래 두 곳에 개인정보 처리를 위탁하고, 두 곳 모두 국외에 있어요. 「개인정보 보호법」 제28조의8 에 따라 이전받는 자·국가·
              시기와 방법·항목·목적·보유기간·거부 방법을 알려 드려요.
            </p>

            <div className="pv-recipient">
              <h3>
                1. OpenAI(AI 정리) <span className="badge">미국</span>
              </h3>
              <TableWrap label="국외 이전 — OpenAI">
                <table className="pv-table kv">
                  <caption>이전받는 자: OpenAI</caption>
                  <tbody>
                    <tr>
                      <th scope="row">이전받는 자·연락처</th>
                      <td>
                        OpenAI, L.L.C. — 개인정보 처리방침상 처리 주체는 OpenAI OpCo, LLC(1455 Third Street, San Francisco, CA 94158, 미국) ·
                        privacy@openai.com · <Ext href="https://privacy.openai.com">privacy.openai.com</Ext> · <Ext href={OPENAI_PRIVACY_URL}>OpenAI 개인정보 처리방침</Ext>{' '}
                        <span className="small muted">({CHECKED} 확인)</span>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">이전되는 국가</th>
                      <td>미국</td>
                    </tr>
                    <tr>
                      <th scope="row">이전 시기·방법</th>
                      <td>공제 정리에서 [정리하기]를 누를 때마다, 우리 서버가 HTTPS(API)로 전송</td>
                    </tr>
                    <tr>
                      <th scope="row">이전 항목</th>
                      <td>가린 공제 문자 텍스트(브라우저에서 [전화번호 삭제] 같은 형식으로 먼저 가리고 사용자가 확인한 처리본을, 서버가 2차로 다시 가린 뒤 보내요)</td>
                    </tr>
                    <tr>
                      <th scope="row">이전 목적</th>
                      <td>공제 항목·금액·원문 구절을 표로 옮겨 적기(AI 정리)</td>
                    </tr>
                    <tr>
                      <th scope="row">보유·이용 기간</th>
                      <td>
                        OpenAI API 데이터 정책에 따라요. API 로 보낸 데이터는 기본적으로 모델 학습에 쓰지 않고, 남용 감시 목적으로 최대 30일 보관한 뒤
                        삭제해요(법적 보관 의무가 있는 경우 제외). <Ext href={OPENAI_POLICY_URL}>OpenAI Enterprise privacy</Ext> ·{' '}
                        <Ext href={OPENAI_DATA_URL}>OpenAI API 데이터 안내</Ext> <span className="small muted">({CHECKED} 확인)</span>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">거부 방법·절차·효과</th>
                      <td>
                        [정리하기]를 누르지 않으면 어떤 글자도 OpenAI 로 가지 않아요. 지금 판에는 AI 를 거치지 않고 표를 시작하는 버튼이 따로 없어요(AI 연결이
                        안 될 때는 [직접 입력] 버튼이 나오고, 표가 만들어진 뒤에는 [행 추가]로 항목을 직접 적을 수 있어요). 거부하면 공제 정리 표 기능은 쓸 수
                        없지만 방 상태 기록·내용증명 서식·상담 기관 안내는 그대로 쓸 수 있어요.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </TableWrap>
            </div>

            <div className="pv-recipient">
              <h3>
                2. Oracle(서버·DB 설비) <span className="badge">일본 도쿄 리전</span>
              </h3>
              <TableWrap label="국외 이전 — Oracle">
                <table className="pv-table kv">
                  <caption>이전받는 자: Oracle</caption>
                  <tbody>
                    <tr>
                      <th scope="row">이전받는 자·연락처</th>
                      <td>
                        Oracle Corporation(Oracle Cloud Infrastructure) · <Ext href={ORACLE_INQUIRY_URL}>Oracle 개인정보 문의 양식</Ext> ·{' '}
                        <Ext href={ORACLE_PRIVACY_URL}>Oracle 개인정보 처리방침</Ext> <span className="small muted">({CHECKED} 확인)</span>
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">이전되는 국가</th>
                      <td>일본(도쿄 리전 데이터센터)</td>
                    </tr>
                    <tr>
                      <th scope="row">이전 시기·방법</th>
                      <td>서비스를 쓰는 동안 HTTPS 로 우리 서버(도쿄)에 전송·보관(사진은 로그인한 회원이 [확인하고 기록하기]를 누를 때)</td>
                    </tr>
                    <tr>
                      <th scope="row">이전 항목</th>
                      <td>
                        서버 DB 에 저장하는 회원 정보(이메일, 비밀번호 해시 또는 구글 계정 식별값, 동의 버전, 가입·최근 로그인 시각), 로그인 회원이 저장한 가린 방 사진
                        처리본과 구역·입주/퇴실·메모·기록 시각·사진 저장 동의 시각, 사진 지문·수신 시각·서명,
                        설문 응답, 구매 의향, 익명 집계, 무작위 기기 ID · 처리 중에만 거쳐 가는 공제 문자(저장 안
                        함)와 접속 IP(메모리 1분)
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">이전 목적</th>
                      <td>서비스 운영(서버·DB 설비 제공). Oracle 은 설비를 제공하는 수탁자이고, 데이터 처리는 팀이 해요</td>
                    </tr>
                    <tr>
                      <th scope="row">보유·이용 기간</th>
                      <td className="num">제3조와 같아요(회원 정보·저장한 사진은 삭제·탈퇴 즉시, 그 밖의 기록은 {RETENTION_END}까지·요청 시 즉시)</td>
                    </tr>
                    <tr>
                      <th scope="row">거부 방법·절차·효과</th>
                      <td>
                        제12조 문의처로 거부 의사를 알려 주시면 해당 기록을 지워요(회원 정보는 내 계정 → [회원 탈퇴]로 바로 지울 수 있어요). 거부하면 서버를
                        거치는 기능(회원가입·로그인, AI 정리, 사진 지문 기록·사진 저장, 설문·구매 의향)은 쓸 수
                        없고, 참고 자료 보기·내용증명 서식처럼 브라우저 안에서 도는 기능은 그대로 쓸 수 있어요.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </TableWrap>
            </div>
            <div className="pv-recipient">
              <h3>참고: 구글 로그인을 쓸 때</h3>
              <p>
                [구글로 간편 가입]·구글 로그인을 쓰는 화면에서는 구글 로그인 버튼을 띄우려고 구글 스크립트(accounts.google.com)를 불러와요. 이때 구글과
                주고받는 정보에는 <Ext href={GOOGLE_PRIVACY_URL}>Google 개인정보처리방침</Ext>이 적용돼요. 팀은 구글이 확인해 준 이메일과 계정
                식별값만 받아 저장하고, 구글에 개인정보를 넘기지 않아요. 구글 로그인을 쓰지 않는 화면에서는 이 스크립트를 불러오지 않아요.
              </p>
            </div>
            <div className="notice warn pv-callout" role="note">
              <strong>붙여 넣기 전에</strong>
              <p>이름 같은 글자는 패턴으로 가릴 수 없어요. 공제 문자에서 이름·주소를 지우고 붙여 넣어 주세요.</p>
            </div>
          </Article>

          {/* 제6조 */}
          <Article id="pv-a6">
            <p>보유기간이 끝나거나 처리 목적을 이룬 개인정보는 지체 없이 파기해요. 다른 법령에 따라 보존해야 하는 경우에는 그 기간 동안 따로 보관해요.</p>
            <ul className="pv-list">
              <li>
                <b>절차</b> — 보유기간이 끝나면 팀이 대상을 골라 삭제하고, 삭제 요청은 제12조 문의처로 받은 뒤 처리 결과를 알려 드려요.
              </li>
              <li>
                <b>방법</b> — 서버 DB(SQLite)의 해당 행을 삭제해요. 저장한 사진은 서버 디스크의 사진 파일과 DB 행을 함께 지워요. 회원 탈퇴를 누르면 회원 정보 행과 그 회원의 사진 폴더·사진 행을 그 자리에서 지우고 로그인 쿠키도 지워요. 공제 문자는 정리 응답 직후 메모리에서 사라지고 파일로 남지 않아요.
              </li>
              <li>
                <b>브라우저 쪽</b> — 저장하지 않은 사진·정리 결과·서식 입력값은 탭을 닫거나 새로고침하면 사라지고, 저장소 값은 제9조 방법으로 직접 지울 수 있어요.
              </li>
            </ul>
          </Article>

          {/* 제7조 */}
          <Article id="pv-a7">
            <p>
              정보주체는 언제든지 「개인정보 보호법」 제35조~제37조에 따라 개인정보 열람·정정·삭제·처리정지를 요구할 수 있고, 동의를 철회할 수 있어요.
              만 14세 미만 아동의 법정대리인도 같은 권리를 행사할 수 있어요.
            </p>
            <div className="notice pv-callout" role="note">
              <strong>회원 정보는 바로 지울 수 있어요</strong>
              <p>
                <a href="#/signup">내 계정</a>에서 가입한 이메일·가입 방법·가입일을 볼 수 있고, [회원 탈퇴]를 누르면 회원 정보와 저장한 사진이 즉시 삭제돼요.
                저장한 사진은 방 상태 기록에서 다시 보고, 메모를 고치고, 한 장씩 지울 수 있어요. 열람·정정이 더 필요하면 아래 문의처로 알려 주세요.
              </p>
            </div>
            <p>설문·구매 의향, 로그인하지 않고 남긴 사진 지문 기록은 회원 정보와 연결돼 있지 않아 아래 방법으로 요청해 주세요.</p>
            <ol className="pv-list">
              <li>아래 "내 기기 ID"를 복사해요. 설문·구매 의향 기록은 이 ID 로만 찾을 수 있어요(이름·연락처가 없으니까요).</li>
              <li>
                <Ext href={COMPANY.contactUrl}>{COMPANY.contactLabel}</Ext>에 기기 ID 와 요청 내용(열람·삭제 등)을 적어 주세요. {COMPANY.contactNote}.
              </li>
              <li>사진 지문 기록은 기기 ID 와 연결돼 있지 않아요. 지우고 싶은 지문 값(64자)을 함께 적어 주세요.</li>
              <li>요청을 받은 날부터 10일 안에 처리하고, 결과를 같은 이슈에 답글로 알려 드려요. 거절할 때는 이유와 이의 제기 방법을 함께 적어요.</li>
            </ol>
            <ClientIdBox />
            <p className="small muted">
              권리 행사는 정보주체 본인이나 법정대리인·위임받은 사람이 할 수 있어요. 다른 법령으로 보존해야 하는 정보는 삭제를 요구할 수 없는 경우가 있어요.
            </p>
          </Article>

          {/* 제8조 */}
          <Article id="pv-a8">
            <p>팀은 「개인정보 보호법」 제29조에 따라 다음 조치를 하고 있어요. 모두 현재 코드와 서버 설정에서 확인한 내용이에요.</p>
            <TableWrap label="제8조 안전성 확보 조치">
              <table className="pv-table">
                <caption>조치 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">조치</th>
                    <th scope="col">내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">최소 수집</th>
                    <td>회원가입은 선택이고 이메일과 로그인에 필요한 값만 받아요. 이름·연락처·계좌·주민등록번호 입력란 자체를 두지 않아요</td>
                  </tr>
                  <tr>
                    <th scope="row">비밀번호 암호화</th>
                    <td>비밀번호는 무작위 솔트를 붙인 scrypt 해시로만 저장하고, 원래 비밀번호는 어디에도 남기지 않아요</td>
                  </tr>
                  <tr>
                    <th scope="row">로그인 쿠키 보호</th>
                    <td>로그인 쿠키는 서버 서명(HMAC-SHA256)으로 위조를 막고, HttpOnly·SameSite=Lax·HTTPS 전용(Secure)으로 설정해 스크립트가 읽을 수 없어요</td>
                  </tr>
                  <tr>
                    <th scope="row">전송 구간 암호화</th>
                    <td>브라우저↔서버, 서버↔OpenAI 통신 모두 HTTPS 로 암호화해요</td>
                  </tr>
                  <tr>
                    <th scope="row">개인정보 패턴 가림</th>
                    <td>브라우저에서 먼저 주민등록번호·전화번호·계좌번호·이메일 패턴을 [전화번호 삭제] 같은 형식으로 가리고, 사용자가 전송본을 확인한 뒤에만 보내요. 서버는 AI 로 보내기 전 입력과 AI 응답 모두에서 같은 패턴을 2차로 다시 가려요</td>
                  </tr>
                  <tr>
                    <th scope="row">본문 비저장·비로그</th>
                    <td>공제 문자 본문은 파일·DB·로그 어디에도 남기지 않고, 로그에는 항목 수와 처리 시간만 남겨요</td>
                  </tr>
                  <tr>
                    <th scope="row">비밀값 분리</th>
                    <td>AI API 키·서명 키는 서버 환경 파일에만 두고 브라우저로 보내지 않으며, 배포 때 복사하지 않아요</td>
                  </tr>
                  <tr>
                    <th scope="row">내부 포트 비공개</th>
                    <td>API 서버는 서버 안(127.0.0.1)에서만 열려 있고 외부 요청은 HTTPS 프록시를 거쳐요</td>
                  </tr>
                  <tr>
                    <th scope="row">입력 제한·남용 방지</th>
                    <td>본문 3,000자·요청 32KB 제한, 접속 주소당 분당 30회 제한(로그인·가입은 분당 10회)</td>
                  </tr>
                  <tr>
                    <th scope="row">기록 위변조 확인</th>
                    <td>사진 지문 기록과 저장한 사진마다 서버 서명(HMAC-SHA256)을 붙여요</td>
                  </tr>
                  <tr>
                    <th scope="row">저장 사진 보호</th>
                    <td>
                      저장한 사진은 로그인한 본인만 열 수 있고 공개 링크가 없어요(남의 사진 요청은 "없음"으로 응답). 원본은 받지 않고, 촬영 정보(EXIF·XMP 등)
                      메타데이터가 남은 파일은 서버가 거절해요. JPEG·PNG 만, 한 장 6MB·회원당 30장까지, 사진 올리기는 접속 주소당 분당 20회로 제한해요.
                      사진 응답은 캐시에 남기지 않아요(no-store)
                    </td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
          </Article>

          {/* 제9조 */}
          <Article id="pv-a9">
            <p>
              팀은 로그인한 회원의 로그인 상태를 유지하는 쿠키 하나(bj_session)만 써요. 광고·방문 분석 쿠키는 쓰지 않고, 방문 분석 도구·위치정보도 쓰지
              않아요. 로그인하지 않으면 쿠키는 만들어지지 않아요.
            </p>
            <TableWrap label="제9조 쿠키">
              <table className="pv-table wide">
                <caption>쓰는 쿠키</caption>
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">내용</th>
                    <th scope="col">용도</th>
                    <th scope="col">보관</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">bj_session</th>
                    <td>회원 번호·발급 시각·서버 서명. HttpOnly(스크립트로 못 읽음)·SameSite=Lax·HTTPS 전용</td>
                    <td>로그인 유지(필수 쿠키)</td>
                    <td>30일, 로그아웃·탈퇴하면 바로 삭제</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <p>그 밖에는 브라우저 저장소(localStorage·sessionStorage)에 아래 값만 두고, 이 값은 서버로 자동 전송되지 않아요.</p>
            <TableWrap label="제9조 브라우저 저장소">
              <table className="pv-table wide">
                <caption>브라우저 저장소에 두는 값</caption>
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">위치</th>
                    <th scope="col">용도</th>
                    <th scope="col">보관</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">bj_client_id</th>
                    <td>localStorage</td>
                    <td>무작위 기기 ID. 설문·구매 의향을 같은 기기에서 두 번 세지 않으려고 써요. 설문·의향을 보낼 때만 서버로 가요</td>
                    <td>지울 때까지</td>
                  </tr>
                  <tr>
                    <th scope="row">bj_popup_hide_until</th>
                    <td>localStorage</td>
                    <td>첫 화면 안내창 "오늘 하루 보지 않기"</td>
                    <td>다음 자정까지</td>
                  </tr>
                  <tr>
                    <th scope="row">bj_promo_unlocked</th>
                    <td>localStorage</td>
                    <td>출시 기념 이벤트 혜택(기록북 사진 장수 제한 해제)이 이 기기에 적용됐는지</td>
                    <td>지울 때까지</td>
                  </tr>
                  <tr>
                    <th scope="row">bj_intent_book · bj_intent_cert</th>
                    <td>localStorage</td>
                    <td>가격 안내에서 구매 의향 버튼을 이미 눌렀는지 표시</td>
                    <td>지울 때까지</td>
                  </tr>
                  <tr>
                    <th scope="row">bj_popup_closed</th>
                    <td>sessionStorage</td>
                    <td>이번 탭에서 첫 화면 안내창을 닫았는지</td>
                    <td>탭을 닫을 때까지</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <h3>거부 방법과 효과</h3>
            <p>
              브라우저 설정에서 이 사이트의 데이터를 삭제하거나 저장소를 차단하면 돼요. 그러면 "오늘 하루 보지 않기" 같은 설정 기억과 혜택 표시가
              사라질 뿐, 기능은 그대로 쓸 수 있어요. 저장소를 차단한 상태에서는 기기 ID 가 그때그때 새로 만들어져요. 쿠키를 차단하면 로그인 상태를 유지할 수
              없지만, 로그인이 필요 없는 기능은 모두 그대로 쓸 수 있어요.
            </p>
          </Article>

          {/* 제10조 */}
          <Article id="pv-a10" extra={<span className="badge">AI 표시</span>}>
            <p>
              공제 내역 정리에는 생성형 AI(OpenAI 언어 모델)를 써요. 「인공지능 기본법」 제31조에 따라 AI 가 만든 결과에는 "AI" 표시를 붙이고, 첫 화면에서
              미리 알려요.
            </p>
            <ul className="pv-list">
              <li>AI 는 문자에 적힌 항목·금액·원문 구절을 표로 옮겨 적기만 해요. 공제가 맞는지, 얼마를 물어볼지 판단하거나 결정하지 않아요.</li>
              <li>정리된 항목은 사용자가 원문과 대조해 [확인]하고, 고치고, 물어볼 항목을 직접 고르게 돼 있어요. 애매한 항목에는 "확인 필요"가 붙어요.</li>
              <li>
                「개인정보 보호법」 제37조의2 가 말하는, 정보주체의 권리·의무에 중대한 영향을 미치는 "완전히 자동화된 결정"은 하지 않아요. 그래도 AI 처리에
                대해 설명이 필요하면 제12조 문의처로 물어보세요.
              </li>
              <li>AI 에 보내는 글은 제5조처럼 개인정보 패턴을 가린 뒤 보내고, OpenAI 는 API 데이터를 기본적으로 모델 학습에 쓰지 않아요.</li>
            </ul>
          </Article>

          {/* 제11조 */}
          <Article id="pv-a11">
            <p>
              만 14세 미만은 회원가입을 할 수 없어요. 가입할 때 "만 14세 이상" 확인에 동의해야 가입이 돼요. 팀은 만 14세 미만 아동의 개인정보를 수집할
              목적으로 서비스를 만들지 않았고, 나이·생년월일은 받지 않아요. 가입 없이 쓰는 기능은 만 14세 미만이라면 법정대리인과 함께 이용해 주세요.
            </p>
            <p>만 14세 미만 아동이 가입했거나 그 개인정보가 처리된 사실을 알게 되면 바로 삭제하고, 법정대리인의 요청이 있으면 제7조와 같은 방법으로 처리해요.</p>
          </Article>

          {/* 제12조 */}
          <Article id="pv-a12">
            <p>개인정보 처리에 관한 문의·불만·피해 구제·열람 청구는 아래로 연락해 주세요. 지체 없이 답하고 처리해요.</p>
            <TableWrap label="제12조 문의처">
              <table className="pv-table kv">
                <caption>개인정보 보호 담당과 문의처</caption>
                <tbody>
                  <tr>
                    <th scope="row">개인정보 보호 담당</th>
                    <td>{COMPANY.privacyOfficer}</td>
                  </tr>
                  <tr>
                    <th scope="row">운영 주체</th>
                    <td>
                      {COMPANY.operator} — {COMPANY.operatorNote}. {COMPANY.addressNote}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">주소</th>
                    <td>{COMPANY.address}</td>
                  </tr>
                  <tr>
                    <th scope="row">문의·열람 청구 접수</th>
                    <td>
                      <Ext href={COMPANY.contactUrl}>{COMPANY.contactLabel}</Ext>
                      <br />
                      <span className="small muted">{COMPANY.contactNote}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <p className="small muted">전화 문의 창구는 두지 않았어요. 문의는 위 온라인 창구로만 받아요.</p>
          </Article>

          {/* 제13조 */}
          <Article id="pv-a13">
            <p>
              개인정보 침해에 대한 신고·상담이 필요하면 아래 기관에 문의할 수 있어요. 아래 기관은 {COMPANY.operator}과 별개의 기관이에요. 팀의 자체
              처리 결과에 만족하지 못하거나 더 자세한 도움이 필요할 때 이용해 주세요.
            </p>
            <ul className="pv-remedy">
              {REMEDY.map((r) => (
                <li key={r.name}>
                  <h3>{r.name}</h3>
                  {r.org && <p className="muted">{r.org}</p>}
                  <p>{r.what}</p>
                  <div className="pv-remedy-foot">
                    <Ext href={r.url}>{r.host}</Ext>
                    <a className="pv-tel" href={`tel:${r.tel}`}>
                      (국번없이) {r.tel}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </Article>

          {/* 제14조 */}
          <Article id="pv-a14">
            <p>
              이 처리방침은 <b className="num">{EFFECTIVE}</b>부터 적용돼요. 법령·서비스 변경으로 내용이 바뀌면 시행 7일 전부터 이 화면에서 알리고, 이전 판은
              맨 위 "판 선택"에서 볼 수 있게 해요.
            </p>
            <TableWrap label="제14조 변경 이력">
              <table className="pv-table">
                <caption>변경 이력</caption>
                <thead>
                  <tr>
                    <th scope="col">판</th>
                    <th scope="col">시행일</th>
                    <th scope="col">내용</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">제1판</th>
                    <td className="num">{EFFECTIVE}</td>
                    <td>제정 — 선택 회원가입(이메일·구글)에 따른 회원 정보·로그인 유지 쿠키 처리, 로그인 회원의 가린 방 사진 처리본 저장(동의 시) 포함</td>
                  </tr>
                </tbody>
              </table>
            </TableWrap>
            <p className="pv-date">
              공고일 {EFFECTIVE} · 시행일 {EFFECTIVE}
            </p>
          </Article>
        </article>
      </div>

      <div className="pv-actions">
        <button type="button" className="btn" onClick={() => go('home')}>
          처음으로
        </button>
        <button type="button" className="btn ghost" onClick={() => go('pricing')}>
          가격 안내
        </button>
      </div>
    </section>
  )
}
