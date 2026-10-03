import { useEffect, useState } from 'react'
import { go } from '../router'
import { getStats, postIntent, type Stats } from '../api'
import '../styles/pages.css'

type Product = 'book' | 'cert'

interface Row {
  name: string
  price: string
  detail: string
  status?: string
  /** 의향 버튼이 붙는 유료 상품 */
  product?: Product
  intentLabel?: string
}

const FREE: Row[] = [
  { name: '공제 정리', price: '무료', detail: '공제 메시지를 붙여 넣으면 항목·청구액·원문 인용을 표로 정리' },
  { name: '참고 자료', price: '무료', detail: '항목별 공개 자료 카드(원문 인용·범위 태그·출처·확인일)' },
  { name: '문의 문자', price: '무료', detail: '확인·체크한 항목의 근거를 묻는 문자 만들기·복사' },
  { name: '다음 단계 안내', price: '무료', detail: '키 반납 전 주의, 무료 상담 기관·변호사 검색 공식 링크' },
  { name: '변호사 조건 추천(가상 프로필 시연)', price: '무료', detail: '상담 주제·방식·지역·예산·시점으로 후보 최대 3명과 추천 이유 · 소개비·수수료 없음, 연락은 직접' },
  { name: '기록북 사진 2장 체험', price: '무료', detail: '구역별 사진 기록·서버 기록·기록북 미리보기' },
]

const PAID: Row[] = [
  {
    name: '방 상태 기록북',
    price: '4,900원',
    detail: '방 1개·이사 1건: 사진 30장, PDF, 재다운로드',
    product: 'book',
    intentLabel: '기록북 4,900원이면 쓸 의향 있어요',
  },
  {
    name: '내용증명 서식 PDF',
    price: '건당 2,900원',
    detail: '입력한 내용이 그대로 들어가는 빈칸형 서식 PDF',
    product: 'cert',
    intentLabel: '내용증명 서식 2,900원이면 쓸 의향 있어요',
  },
  { name: '기관(대학 생활관·지자체)용 기록 관리', price: '—', detail: '여러 방의 입주·퇴실 기록 관리', status: '출시 예정' },
]

const DONE_MSG = '의향을 기록했어요(결제 아님)'
const RETRY_MSG = '지금은 기록하지 못했어요. 잠시 후 다시 눌러 주세요.'

/* 이미 의향을 남긴 브라우저는 새로고침해도 같은 표시 (서버도 clientId로 중복을 세지 않는다) */
const intentKey = (p: Product) => `bj_intent_${p}`
function readIntent(p: Product): boolean {
  try {
    return localStorage.getItem(intentKey(p)) === '1'
  } catch {
    return false
  }
}
function saveIntent(p: Product): void {
  try {
    localStorage.setItem(intentKey(p), '1')
  } catch {
    /* 저장이 막혀도 화면 동작에는 영향 없음 */
  }
}

const num = (n: number) => n.toLocaleString('ko-KR')

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.2 4.2L19 7.5" />
    </svg>
  )
}

export default function Pricing() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [done, setDone] = useState<Record<Product, boolean>>(() => ({ book: readIntent('book'), cert: readIntent('cert') }))
  const [pending, setPending] = useState<Product | null>(null)
  const [errors, setErrors] = useState<Partial<Record<Product, string>>>({})

  useEffect(() => {
    let alive = true
    getStats()
      .then((s) => {
        if (alive) setStats(s)
      })
      .catch(() => {
        /* 집계 실패 시 패널만 숨긴다 */
      })
    return () => {
      alive = false
    }
  }, [])

  async function leaveIntent(product: Product) {
    setPending(product)
    setErrors((e) => {
      const next = { ...e }
      delete next[product]
      return next
    })
    try {
      const r = await postIntent(product)
      saveIntent(product)
      setDone((d) => ({ ...d, [product]: true })) // counted=false(이미 기록된 브라우저)여도 같은 표시
      if (r.stats) setStats(r.stats)
    } catch {
      setErrors((e) => ({ ...e, [product]: RETRY_MSG }))
    } finally {
      setPending(null)
    }
  }

  // ── 집계 가공 ──
  /* 의향은 사람 수가 아니라 상품별 건수로 보여 준다(0건인 상품은 숨김) */
  const intentParts = stats
    ? [
        stats.intents.book > 0 ? `기록북 의향 ${num(stats.intents.book)}건` : null,
        stats.intents.cert > 0 ? `내용증명 의향 ${num(stats.intents.cert)}건` : null,
      ].filter((x): x is string => x !== null)
    : []

  return (
    <section className="page pricing">
      <header className="page-head">
        <h1>가격 안내</h1>
        <p className="muted">회원가입·로그인 없이도 쓸 수 있어요. 가격은 아직 검증 중인 가설이에요.</p>
      </header>

      <ul className="page-notes">
        <li>공제 정리·참고 자료·문의 문자는 무료이며 어떤 유료 상품과도 묶지 않습니다.</li>
        <li>
          <strong>결제는 아직 연결하지 않았어요.</strong> 유료 상품은 데모에서 무료로 체험할 수 있어요.
        </li>
        <li>성공보수·변호사 소개비를 받지 않습니다.</li>
      </ul>

      {/* ── 무료 ── */}
      <div className="section-head">
        <h2>무료(누구나)</h2>
      </div>
      <ul className="plan-table" aria-label="무료 상품">
        {FREE.map((r) => (
          <li key={r.name}>
            <span className="plan-name">{r.name}</span>
            <span className="plan-detail">{r.detail}</span>
            <span className="badge ok plan-free-badge">{r.price}</span>
          </li>
        ))}
      </ul>

      {/* ── 유료(가설) ── */}
      <div className="section-head">
        <h2>유료(가설)</h2>
        {intentParts.length > 0 && <p className="intent-count">{intentParts.join(' · ')}</p>}
        <p className="muted small">같은 기기에서는 상품마다 한 번만 세요 · 결제 아님</p>
      </div>
      <div className="plan-grid">
        {PAID.map((r) => {
          const p = r.product
          const isDone = p ? done[p] : false
          const err = p ? errors[p] : undefined
          return (
            <article className={`plan-card${r.status ? ' is-soon' : ''}`} key={r.name}>
              <h3>{r.name}</h3>
              <p className="plan-price">{r.status ? <span className="badge warn">{r.status}</span> : r.price}</p>
              <p className="plan-detail">{r.detail}</p>
              {p && r.intentLabel && (
                <div className="plan-intent">
                  <button
                    type="button"
                    className="btn primary"
                    disabled={isDone || pending === p}
                    aria-busy={pending === p || undefined}
                    onClick={() => leaveIntent(p)}
                  >
                    {r.intentLabel}
                  </button>
                  <p className="plan-status" aria-live="polite">
                    {isDone ? (
                      <span className="plan-done">
                        <CheckIcon />
                        {DONE_MSG}
                      </span>
                    ) : err ? (
                      <span className="plan-err">{err}</span>
                    ) : null}
                  </p>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <p className="muted small plan-disclaimer">
        보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다. 공제 정리 결과나 판단을 따로 판매하지 않아요.
      </p>



      <div className="page-actions">
        <button type="button" className="btn primary" onClick={() => go('deduct')}>
          공제 내역 정리하기
        </button>
        <button type="button" className="btn" onClick={() => go('record')}>
          방 상태 기록하기
        </button>
      </div>
    </section>
  )
}
