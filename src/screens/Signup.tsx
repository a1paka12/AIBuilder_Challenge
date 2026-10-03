import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from 'react'
import { hrefOf } from '../router'
import Survey from '../components/Survey'
import { usePromoUnlocked } from '../lib/promo'
import {
  authErrorCode,
  authErrorText,
  deleteAccount,
  getConfig,
  googleLogin,
  loadGis,
  login,
  logout,
  looksLikeEmail,
  PASSWORD_MIN,
  PROVIDER_LABEL,
  TEST_ACCOUNT_NOTICE,
  signup,
  useMe,
  type Consent,
  type GisButtonOptions,
  type User,
} from '../lib/auth'
import '../styles/signup.css'

/*
 * 회원가입 (#/signup)
 * ① 약관 동의 → ② 가입 방법(구글 간편 가입 · 이메일) → ③ 30초 현장 설문(건너뛰기 가능) → ④ 가입 완료
 * 같은 화면에 "이미 회원이에요 · 로그인" 탭, 로그인 상태면 "내 계정"(로그아웃 · 회원 탈퇴).
 * - 수집: 이메일 + 비밀번호(서버에서 암호화 해시) 또는 구글 계정 식별값. 이름·사진·전화번호는 받지 않는다.
 * - 설문은 익명(client_id)이라 계정과 연결하지 않는다. 이메일 인증 메일은 아직 없다.
 * - 구글 버튼은 Google Identity Services 공식 renderButton 만 쓴다(직접 그린 로고 금지).
 */

type Tab = 'signup' | 'login'
type Flow = 'join' | 'pending' | 'survey' | 'done' // pending: 가입 요청 중(로그인돼도 '내 계정'으로 튀지 않게)
type View = 'loading' | 'account' | 'join' | 'login' | 'survey' | 'done'
type ConfigState = { loading: true } | { loading: false; clientId: string | null }

const STEPS = ['약관 동의', '가입 방법', '30초 설문', '가입 완료'] as const

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

/* ── 구글 공식 버튼 ─────────────────────────────────────────────── */

function GoogleButton({ clientId, text, onCredential }: { clientId: string; text: GisButtonOptions['text']; onCredential: (credential: string) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    cb.current = onCredential
  }, [onCredential])

  useEffect(() => {
    let alive = true
    loadGis()
      .then((id) => {
        const el = box.current
        if (!alive || !el) return
        id.initialize({
          client_id: clientId,
          callback: (res) => {
            if (res.credential) cb.current(res.credential)
          },
          ux_mode: 'popup',
          cancel_on_tap_outside: true,
        })
        const width = Math.max(200, Math.min(400, Math.floor(el.clientWidth || 320)))
        el.replaceChildren()
        id.renderButton(el, { type: 'standard', theme: 'outline', size: 'large', text, shape: 'rectangular', logo_alignment: 'left', width, locale: 'ko' })
        setReady(true)
      })
      .catch((e) => {
        if (alive) setError(authErrorText(e))
      })
    return () => {
      alive = false
    }
  }, [clientId, text])

  return (
    <div className="su-gis">
      <div ref={box} className="su-gis-box" />
      {!ready && !error && <p className="su-hint">구글 버튼을 불러오는 중이에요…</p>}
      {error && (
        <p className="su-err" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/* ── 공통: 비밀번호 보기 토글이 있는 입력 묶음 ───────────────────── */

interface FieldProps {
  id: string
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  autoComplete: string
  error?: string | null
  hint?: string
  inputMode?: 'email' | 'text'
  inputRef?: Ref<HTMLInputElement>
}

function Field({ id, label, type, value, onChange, autoComplete, error, hint, inputMode, inputRef }: FieldProps) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="su-field">
      <label htmlFor={id} className="su-label">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="su-hint">
          {hint}
        </p>
      )}
      <input
        ref={inputRef}
        id={id}
        className="su-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        required
      />
      {error && (
        <p id={`${id}-err`} className="su-err">
          {error}
        </p>
      )}
    </div>
  )
}

/* ── ① 약관 동의 + ② 가입 방법 ──────────────────────────────────── */

function JoinPanel({
  config,
  onJoined,
  onExisting,
  toLogin,
  onConsentChange,
  onPending,
}: {
  config: ConfigState
  onConsentChange: (ok: boolean) => void
  onPending: (on: boolean) => void
  onJoined: () => void
  onExisting: (msg: string) => void
  toLogin: () => void
}) {
  const uid = useId()
  const [privacy, setPrivacy] = useState(false)
  const [age14, setAge14] = useState(false)
  const consentOk = privacy && age14
  const consentRef = useRef<Consent>({ privacy, age14 })
  useEffect(() => {
    consentRef.current = { privacy, age14 }
  }, [privacy, age14])
  useEffect(() => {
    onConsentChange(consentOk)
  }, [consentOk, onConsentChange])

  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [show, setShow] = useState(false)
  const [errs, setErrs] = useState<{ email?: string; pw?: string; pw2?: string }>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; code?: string } | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const pwRef = useRef<HTMLInputElement>(null)
  const pw2Ref = useRef<HTMLInputElement>(null)

  const allRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = privacy !== age14
  }, [privacy, age14])

  // 이메일 폼을 열면 첫 칸으로
  useEffect(() => {
    if (emailOpen && consentOk) emailRef.current?.focus()
    // consentOk 변화로는 다시 옮기지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailOpen])

  const onGoogle = async (credential: string) => {
    const consent = consentRef.current
    if (!consent.privacy || !consent.age14) {
      setMsg({ text: '필수 항목에 모두 동의해 주세요.' })
      return
    }
    setBusy(true)
    setMsg({ text: '구글 계정을 확인하는 중이에요…' })
    onPending(true)
    try {
      const r = await googleLogin(credential, consent)
      setMsg(null)
      if (r.isNew) onJoined()
      else onExisting('이미 가입된 구글 계정이라 로그인했어요.')
    } catch (e) {
      onPending(false)
      setMsg({ text: authErrorText(e), code: authErrorCode(e) })
    } finally {
      setBusy(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!consentOk) {
      setMsg({ text: '필수 항목에 모두 동의해 주세요.' })
      return
    }
    const next: typeof errs = {}
    if (!looksLikeEmail(email)) next.email = '이메일 주소 형식을 확인해 주세요. 예: name@example.com'
    if (pw.length < PASSWORD_MIN) next.pw = `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`
    if (pw2 !== pw) next.pw2 = '비밀번호 확인이 위 비밀번호와 달라요.'
    setErrs(next)
    if (next.email || next.pw || next.pw2) {
      setMsg({ text: '입력한 내용을 확인해 주세요.' })
      ;(next.email ? emailRef : next.pw ? pwRef : pw2Ref).current?.focus()
      return
    }
    setBusy(true)
    setMsg({ text: '가입하는 중이에요…' })
    onPending(true)
    try {
      await signup(email, pw, { privacy, age14 })
      setMsg(null)
      onJoined()
    } catch (err) {
      onPending(false)
      const code = authErrorCode(err)
      setMsg({ text: authErrorText(err), code })
      if (code === 'bad_email' || code === 'email_exists') emailRef.current?.focus()
      if (code === 'weak_password') pwRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const reasonId = `${uid}-reason`
  const clientId = config.loading ? null : config.clientId
  const needLogin = msg?.code === 'email_exists' || msg?.code === 'email_exists_password'

  return (
    <>
      {/* ① 약관 동의 */}
      <section className="card su-sec" aria-labelledby={`${uid}-c-title`}>
        <h2 id={`${uid}-c-title`} className="su-sec-title">
          <span className="su-n" aria-hidden="true">
            1
          </span>
          약관 동의
        </h2>
        <fieldset className="su-consent">
          <legend className="su-sr">회원가입 필수 동의 항목</legend>
          <label className="su-check su-check-all">
            <input
              ref={allRef}
              type="checkbox"
              checked={consentOk}
              onChange={(e) => {
                setPrivacy(e.target.checked)
                setAge14(e.target.checked)
              }}
            />
            <span>아래 필수 항목에 모두 동의해요</span>
          </label>

          <div className="su-consent-item">
            <label className="su-check">
              <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} aria-describedby={`${uid}-privacy`} />
              <span>
                <b className="su-req">[필수]</b> 개인정보 수집·이용 동의
              </span>
            </label>
            <dl id={`${uid}-privacy`} className="su-terms">
              <div>
                <dt>수집 항목</dt>
                <dd>이메일, 비밀번호(암호화 해시로 저장) 또는 구글 계정 식별값</dd>
              </div>
              <div>
                <dt>목적</dt>
                <dd>회원 식별·로그인 유지</dd>
              </div>
              <div>
                <dt>보유 기간</dt>
                <dd>탈퇴 즉시 삭제, 늦어도 2026. 12. 31. 일괄 삭제</dd>
              </div>
            </dl>
            <p className="su-hint">
              이름·프로필 사진·전화번호는 받지 않아요(구글 가입도 마찬가지). 로그인 유지에는 쿠키(bj_session, 30일)를 써요. 동의하지 않을 수 있지만, 그러면
              가입할 수 없어요. 가입하지 않아도 공제 정리·방 상태 기록은 그대로 쓸 수 있어요.{' '}
              <a href={hrefOf('privacy')}>개인정보 처리방침</a>
            </p>
          </div>

          <div className="su-consent-item">
            <label className="su-check">
              <input type="checkbox" checked={age14} onChange={(e) => setAge14(e.target.checked)} />
              <span>
                <b className="su-req">[필수]</b> 만 14세 이상이에요
              </span>
            </label>
          </div>
        </fieldset>
      </section>

      {/* ② 가입 방법 */}
      <section className="card su-sec" aria-labelledby={`${uid}-m-title`}>
        <h2 id={`${uid}-m-title`} className="su-sec-title">
          <span className="su-n" aria-hidden="true">
            2
          </span>
          가입 방법 고르기
        </h2>
        {!consentOk && (
          <p id={reasonId} className="notice su-reason">
            <strong>먼저 동의가 필요해요</strong>
            <span>위 ① 필수 항목 2개에 동의하면 가입 버튼이 열려요.</span>
          </p>
        )}

        <div className="su-methods">
          <div className="su-method">
            <h3 className="su-method-title">구글로 간편 가입</h3>
            {config.loading ? (
              <p className="su-hint">불러오는 중이에요…</p>
            ) : !clientId ? (
              <p className="su-ready">구글 간편 가입 준비 중이에요. 지금은 이메일로 가입해 주세요.</p>
            ) : consentOk ? (
              <GoogleButton clientId={clientId} text="signup_with" onCredential={(c) => void onGoogle(c)} />
            ) : (
              <button type="button" className="btn su-wide" disabled aria-describedby={reasonId}>
                구글로 간편 가입
              </button>
            )}
          </div>

          <div className="su-method">
            <h3 className="su-method-title">이메일로 가입</h3>
            <button
              type="button"
              className={`btn su-wide${emailOpen ? '' : ' primary'}`}
              disabled={!consentOk}
              aria-describedby={consentOk ? undefined : reasonId}
              aria-expanded={emailOpen && consentOk}
              aria-controls={`${uid}-form`}
              onClick={() => setEmailOpen((v) => !v)}
            >
              {emailOpen && consentOk ? '이메일 가입 접기' : '이메일로 가입'}
            </button>
          </div>
        </div>

        {emailOpen && consentOk && (
          <form id={`${uid}-form`} className="su-form" noValidate onSubmit={submit} aria-label="이메일로 가입">
            <Field
              id={`${uid}-email`}
              label="이메일"
              type="email"
              inputMode="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              error={errs.email}
              inputRef={emailRef}
            />
            <Field
              id={`${uid}-pw`}
              label="비밀번호"
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={setPw}
              autoComplete="new-password"
              hint={`${PASSWORD_MIN}자 이상`}
              error={errs.pw}
              inputRef={pwRef}
            />
            <Field
              id={`${uid}-pw2`}
              label="비밀번호 확인"
              type={show ? 'text' : 'password'}
              value={pw2}
              onChange={setPw2}
              autoComplete="new-password"
              error={errs.pw2}
              inputRef={pw2Ref}
            />
            <label className="su-check su-show">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              <span>비밀번호 보기</span>
            </label>
            <p className="su-hint">이메일 인증은 아직 없어요. 가입한 이메일로 메일을 보내지 않아요.</p>
            <button type="submit" className="btn primary su-wide" disabled={busy} aria-busy={busy}>
              가입하기
            </button>
          </form>
        )}

        <div className="su-live" aria-live="polite">
          {msg && <p className={msg.code ? 'su-err' : 'su-hint'}>{msg.text}</p>}
          {needLogin && (
            <button type="button" className="btn" onClick={toLogin}>
              로그인 탭으로
            </button>
          )}
        </div>
      </section>
    </>
  )
}

/* ── 로그인 ─────────────────────────────────────────────────────── */

function LoginPanel({ config, onLoggedIn, toSignup }: { config: ConfigState; onLoggedIn: (msg: string) => void; toSignup: () => void }) {
  const uid = useId()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [errs, setErrs] = useState<{ email?: string; pw?: string }>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; code?: string } | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const pwRef = useRef<HTMLInputElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: typeof errs = {}
    if (!email.trim()) next.email = '이메일(또는 테스트 아이디)을 입력해 주세요.'
    if (!pw) next.pw = '비밀번호를 입력해 주세요.'
    setErrs(next)
    if (next.email || next.pw) {
      setMsg({ text: '입력한 내용을 확인해 주세요.' })
      ;(next.email ? emailRef : pwRef).current?.focus()
      return
    }
    setBusy(true)
    setMsg({ text: '로그인하는 중이에요…' })
    try {
      await login(email, pw)
      setMsg(null)
      onLoggedIn('로그인했어요.')
    } catch (err) {
      setMsg({ text: authErrorText(err), code: authErrorCode(err) })
    } finally {
      setBusy(false)
    }
  }

  const onGoogle = async (credential: string) => {
    setBusy(true)
    setMsg({ text: '구글 계정을 확인하는 중이에요…' })
    try {
      await googleLogin(credential)
      setMsg(null)
      onLoggedIn('구글 계정으로 로그인했어요.')
    } catch (e) {
      const code = authErrorCode(e)
      setMsg({
        code,
        text:
          code === 'consent_required'
            ? '아직 가입하지 않은 구글 계정이에요. 회원가입 탭에서 약관에 동의한 뒤 구글로 간편 가입해 주세요.'
            : authErrorText(e),
      })
    } finally {
      setBusy(false)
    }
  }

  const clientId = config.loading ? null : config.clientId

  return (
    <section className="card su-sec" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="su-sec-title">
        로그인
      </h2>
      <form className="su-form su-form-flat" noValidate onSubmit={submit} aria-label="이메일로 로그인">
        <Field
          id={`${uid}-email`}
          label="이메일(또는 테스트 아이디)"
          type="text"
          inputMode="email"
          value={email}
          onChange={setEmail}
          autoComplete="username"
          error={errs.email}
          inputRef={emailRef}
        />
        <Field
          id={`${uid}-pw`}
          label="비밀번호"
          type={show ? 'text' : 'password'}
          value={pw}
          onChange={setPw}
          autoComplete="current-password"
          error={errs.pw}
          inputRef={pwRef}
        />
        <label className="su-check su-show">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span>비밀번호 보기</span>
        </label>
        <button type="submit" className="btn primary su-wide" disabled={busy} aria-busy={busy}>
          이메일로 로그인
        </button>
      </form>

      <div className="su-or" role="separator" aria-label="또는">
        <span aria-hidden="true">또는</span>
      </div>

      <div className="su-method">
        <h3 className="su-method-title">구글로 로그인</h3>
        {config.loading ? (
          <p className="su-hint">불러오는 중이에요…</p>
        ) : clientId ? (
          <GoogleButton clientId={clientId} text="signin_with" onCredential={(c) => void onGoogle(c)} />
        ) : (
          <p className="su-ready">구글 로그인 준비 중이에요.</p>
        )}
      </div>

      <div className="su-live" aria-live="polite">
        {msg && <p className={msg.code ? 'su-err' : 'su-hint'}>{msg.text}</p>}
        {msg?.code === 'consent_required' && (
          <button type="button" className="btn" onClick={toSignup}>
            회원가입 탭으로
          </button>
        )}
      </div>
      <p className="su-hint su-foot">비밀번호 찾기는 아직 없어요. 잊었다면 고객센터로 문의해 주세요.</p>
    </section>
  )
}

/* ── 내 계정 ────────────────────────────────────────────────────── */

function AccountPanel({ user, onLoggedOut, onDeleted }: { user: User; onLoggedOut: () => void; onDeleted: () => void }) {
  const uid = useId()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const confirmTitle = useRef<HTMLHeadingElement>(null)
  const deleteBtn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirming) confirmTitle.current?.focus()
  }, [confirming])

  const doLogout = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await logout()
    } catch {
      /* 서버가 실패해도 화면은 로그아웃 상태로 둔다 */
    } finally {
      setBusy(false)
      onLoggedOut()
    }
  }

  const doDelete = async () => {
    setBusy(true)
    setMsg('탈퇴를 처리하는 중이에요…')
    try {
      await deleteAccount()
      onDeleted()
    } catch (e) {
      setBusy(false)
      setMsg(authErrorText(e))
    }
  }

  return (
    <section className="card su-sec" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="su-sec-title">
        계정 정보
      </h2>
      {user.isTestAccount && (
        <p className="notice warn su-test-notice" role="note">
          {TEST_ACCOUNT_NOTICE}
        </p>
      )}
      <dl className="su-terms su-account">
        <div>
          <dt>이메일</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt>가입 방법</dt>
          <dd>{PROVIDER_LABEL[user.provider]}</dd>
        </div>
        <div>
          <dt>가입일</dt>
          <dd className="num">{fmtDate(user.createdAt)}</dd>
        </div>
      </dl>
      <p className="su-hint">이메일 인증은 아직 없어요. 계정에는 위 정보와 로그인 정보만 있고, 설문 응답·공제 정리 내용은 계정과 연결하지 않아요.</p>

      <div className="su-actions">
        <button type="button" className="btn" onClick={() => void doLogout()} disabled={busy}>
          로그아웃
        </button>
        {!confirming && !user.isTestAccount && (
          <button ref={deleteBtn} type="button" className="btn su-danger-ghost" onClick={() => setConfirming(true)} disabled={busy}>
            회원 탈퇴
          </button>
        )}
      </div>

      {user.isTestAccount && <p className="su-hint">공용 테스트 계정은 탈퇴할 수 없어요.</p>}
      {confirming && !user.isTestAccount && (
        <div className="notice warn su-confirm" role="group" aria-labelledby={`${uid}-confirm`}>
          <h3 id={`${uid}-confirm`} ref={confirmTitle} tabIndex={-1} className="su-confirm-title">
            정말 탈퇴할까요?
          </h3>
          <span>탈퇴하면 계정 정보(이메일·로그인 정보)와 저장한 사진도 함께 바로 삭제하고 되돌릴 수 없어요. 같은 이메일로 다시 가입할 수는 있어요.</span>
          <div className="su-actions">
            <button type="button" className="btn su-danger" onClick={() => void doDelete()} disabled={busy} aria-busy={busy}>
              탈퇴하기
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                setConfirming(false)
                setMsg(null)
                requestAnimationFrame(() => deleteBtn.current?.focus())
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}
      <p className="su-live su-err" aria-live="polite">
        {msg}
      </p>
    </section>
  )
}

/* ── 화면 ───────────────────────────────────────────────────────── */

function Stepper({ current }: { current: number }) {
  return (
    <ol className="su-steps" aria-label="가입 단계">
      {STEPS.map((s, i) => (
        <li key={s} className={i < current ? 'is-done' : i === current ? 'is-current' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span className="su-steps-n" aria-hidden="true">
            {i + 1}
          </span>
          <span className="su-steps-label">
            {s}
            {i < current && <span className="su-sr"> (완료)</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="su-flow-title" tabIndex={-1} data-su-focus>
      {children}
    </h2>
  )
}

export default function Signup() {
  const uid = useId()
  const { status, user } = useMe()
  const unlocked = usePromoUnlocked()
  const [tab, setTab] = useState<Tab>('signup')
  const [flow, setFlow] = useState<Flow>('join')
  const [notice, setNotice] = useState<string | null>(null)
  const [config, setConfig] = useState<ConfigState>({ loading: true })
  const [consentShown, setConsentShown] = useState(false) // 스텝 표시용: ② 가입 방법 단계로 넘어갔는지
  const rootRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ signup: null, login: null })

  useEffect(() => {
    let alive = true
    getConfig()
      .then((c) => alive && setConfig({ loading: false, clientId: c.googleClientId }))
      .catch(() => alive && setConfig({ loading: false, clientId: null }))
    return () => {
      alive = false
    }
  }, [])

  // 헤더 [내 계정](#/signup?view=account) — 가입 완료·설문 화면에서 눌러도 내 계정 보기로 전환하고, 다음 클릭도 hashchange 가 나도록 쿼리를 지운다
  useEffect(() => {
    const check = () => {
      const qs = window.location.hash.split('?')[1] ?? ''
      if (new URLSearchParams(qs).get('view') !== 'account') return
      setFlow((f) => (f === 'survey' || f === 'done' ? 'join' : f))
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hrefOf('signup')}`)
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [])

  const view: View = status === 'loading'
      ? 'loading'
      : flow === 'survey' || flow === 'done'
        ? flow
        : flow === 'pending'
          ? 'join'
          : user
            ? 'account'
            : tab === 'signup' ? 'join' : 'login'

  // 화면 단계가 바뀌면 새 제목으로 포커스를 옮긴다(탭끼리 바꿀 때는 탭에 그대로 둔다)
  const prevView = useRef<View>(view)
  useEffect(() => {
    const prev = prevView.current
    prevView.current = view
    if (prev === view || prev === 'loading') return
    if ((prev === 'join' || prev === 'login') && (view === 'join' || view === 'login')) return
    const el = rootRef.current?.querySelector<HTMLElement>('[data-su-focus]') ?? rootRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    el?.focus()
  }, [view])

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const next: Tab = e.key === 'Home' ? 'signup' : e.key === 'End' ? 'login' : tab === 'signup' ? 'login' : 'signup'
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setNotice(null)
    requestAnimationFrame(() => tabRefs.current[t]?.focus())
  }

  const isAccount = view === 'account'

  return (
    <section className="su" ref={rootRef}>
      <header className="su-head">
        {isAccount ? (
          <h1 tabIndex={-1} data-su-focus>
            내 계정
          </h1>
        ) : (
          <h1>회원가입</h1>
        )}
        <p className="muted">
          {isAccount
            ? '가입한 계정 정보를 보고, 로그아웃하거나 탈퇴할 수 있어요.'
            : '이메일 또는 구글 계정으로 가입해요. 이름·전화번호는 받지 않아요.'}
        </p>
      </header>

      <div className="su-notice-wrap" role="status" aria-live="polite">
        {notice && <p className="notice su-notice">{notice}</p>}
      </div>

      {view === 'loading' && <p className="su-hint">로그인 상태를 확인하는 중이에요…</p>}

      {isAccount && user && (
        <>
          <AccountPanel
            user={user}
            onLoggedOut={() => {
              setNotice('로그아웃했어요.')
              setTab('login')
              setFlow('join')
            }}
            onDeleted={() => {
              setNotice('탈퇴했어요. 계정 정보와 저장한 사진도 함께 바로 삭제했어요.')
              setTab('signup')
              setFlow('join')
              setConsentShown(false)
            }}
          />
          <div className="su-actions su-after">
            <a className="btn primary" href={hrefOf('deduct')}>
              공제 내역 정리하기
            </a>
            <a className="btn" href={hrefOf('home')}>
              처음으로
            </a>
          </div>
        </>
      )}

      {(view === 'join' || view === 'login') && (
        <>
          <div className="su-tabs" role="tablist" aria-label="회원가입 또는 로그인">
            <button
              ref={(el) => {
                tabRefs.current.signup = el
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-signup`}
              aria-selected={tab === 'signup'}
              aria-controls={`${uid}-panel-signup`}
              tabIndex={tab === 'signup' ? 0 : -1}
              onClick={() => switchTab('signup')}
              onKeyDown={onTabKey}
            >
              처음이에요 · 회원가입
            </button>
            <button
              ref={(el) => {
                tabRefs.current.login = el
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-login`}
              aria-selected={tab === 'login'}
              aria-controls={`${uid}-panel-login`}
              tabIndex={tab === 'login' ? 0 : -1}
              onClick={() => switchTab('login')}
              onKeyDown={onTabKey}
            >
              이미 회원이에요 · 로그인
            </button>
          </div>

          {tab === 'signup' ? (
            <div role="tabpanel" id={`${uid}-panel-signup`} aria-labelledby={`${uid}-tab-signup`} className="su-panel">
              <Stepper current={consentShown ? 1 : 0} />
              <JoinPanel
                config={config}
                onConsentChange={setConsentShown}
                onPending={(on) => setFlow(on ? 'pending' : 'join')}
                onJoined={() => {
                  setNotice(null)
                  setFlow('survey')
                }}
                onExisting={(m) => {
                  setNotice(m)
                  setFlow('join')
                }}
                toLogin={() => switchTab('login')}
              />
            </div>
          ) : (
            <div role="tabpanel" id={`${uid}-panel-login`} aria-labelledby={`${uid}-tab-login`} className="su-panel">
              <LoginPanel config={config} onLoggedIn={(m) => setNotice(m)} toSignup={() => switchTab('signup')} />
            </div>
          )}
        </>
      )}

      {view === 'survey' && (
        <div className="su-panel">
          <Stepper current={2} />
          <Heading>가입했어요! 30초 설문에 답해 주실래요?</Heading>
          <p className="su-lead">
            설문은 선택이에요. 응답하면 출시 기념 이벤트 혜택(기록북 범위 사진 30장 체험)이 이 기기·브라우저에 바로 적용돼요. 설문 응답은 익명으로 집계하고 계정과
            연결하지 않아요.
          </p>
          <Survey />
          <div className="su-actions su-after">
            <button type="button" className={unlocked ? 'btn primary' : 'btn'} onClick={() => setFlow('done')}>
              {unlocked ? '다음: 가입 완료' : '나중에 할게요'}
            </button>
          </div>
        </div>
      )}

      {view === 'done' && (
        <div className="su-panel">
          <Stepper current={3} />
          <div className="card su-sec su-done">
            <Heading>가입을 마쳤어요</Heading>
            {user && (
              <p>
                <b>{user.email}</b> ({PROVIDER_LABEL[user.provider]})로 가입했어요.
              </p>
            )}
            {unlocked && <p className="badge ok su-done-badge">출시 기념 이벤트 혜택 적용됨</p>}
            <p className="su-hint">이메일 인증은 아직 없어요. 가입한 이메일로 메일을 보내지 않아요.</p>
            <div className="su-actions">
              <a className="btn primary" href={hrefOf('deduct')}>
                공제 내역 정리하기
              </a>
              <button type="button" className="btn" onClick={() => setFlow('join')}>
                내 계정 보기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
