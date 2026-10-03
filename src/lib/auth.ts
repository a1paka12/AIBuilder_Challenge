/*
 * 회원 계정 — /api/me 조회·구독 + 가입·로그인·로그아웃·탈퇴 + Google Identity Services 로더
 * - 로그인 상태는 서버의 HttpOnly 쿠키(bj_session)가 정본이다. 이 모듈은 /api/me 결과만 메모리에 들고 있다(브라우저 저장소에 아무것도 쓰지 않음).
 * - 이름·사진·전화번호는 받지도 보내지도 않는다. 설문(익명 client_id)과 계정은 연결하지 않는다.
 * - 이메일 인증 메일은 아직 없다(대회 범위).
 */
import { useEffect, useSyncExternalStore } from 'react'
import { ApiFailure } from '../api'

export type AuthProvider = 'email' | 'google'

export interface User {
  id: number
  email: string
  provider: AuthProvider
  createdAt: string
  /** 심사용 공용 테스트 계정 — 탈퇴 불가, 사진이 다른 사람에게도 보임 */
  isTestAccount?: boolean
}

export interface Consent {
  privacy: boolean
  age14: boolean
}

export const PROVIDER_LABEL: Record<AuthProvider, string> = {
  email: '이메일',
  google: '구글 계정',
}

export const PASSWORD_MIN = 8

/** 오류 코드 → 한국어 안내 (서버 계약의 { error: 코드 }) */
const ERROR_TEXT: Record<string, string> = {
  bad_email: '이메일 주소 형식을 확인해 주세요.',
  weak_password: `비밀번호는 ${PASSWORD_MIN}자 이상이어야 해요.`,
  consent_required: '필수 항목에 모두 동의해 주세요.',
  email_exists: '이미 가입된 이메일이에요. 로그인해 주세요.',
  invalid_credentials: '이메일 또는 비밀번호가 맞지 않아요.',
  use_google: '구글로 가입한 계정이에요. 아래 [구글로 로그인]을 이용해 주세요.',
  email_exists_password: '이 이메일은 이메일·비밀번호로 가입돼 있어요. 로그인 탭에서 이메일로 로그인해 주세요.',
  google_not_configured: '구글 간편 가입은 아직 준비 중이에요. 이메일로 가입해 주세요.',
  invalid_token: '구글 계정 확인에 실패했어요. 다시 시도해 주세요.',
  test_account_locked: '공용 테스트 계정은 탈퇴할 수 없어요.',
  rate_limited: '요청이 너무 잦아요. 1분쯤 뒤에 다시 시도해 주세요.',
  http_429: '요청이 너무 잦아요. 1분쯤 뒤에 다시 시도해 주세요.',
  network: '연결이 불안정해요. 잠시 후 다시 시도해 주세요.',
  gis_load: '구글 로그인 도구를 불러오지 못했어요. 광고 차단 기능을 끄거나 이메일로 진행해 주세요.',
}

export function authErrorText(e: unknown): string {
  const code = e instanceof ApiFailure ? e.code : ''
  return ERROR_TEXT[code] ?? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export function authErrorCode(e: unknown): string {
  return e instanceof ApiFailure ? e.code : ''
}

/** 가볍게 형식만 본다 — 실제 검증은 서버 */
export function looksLikeEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export const TEST_ACCOUNT_NOTICE = '공용 테스트 계정이에요 — 저장한 사진은 같은 계정으로 들어온 다른 사람도 볼 수 있어요. 개인 사진은 올리지 마세요.'

/* ── 요청 도우미 ─────────────────────────────────────────────────── */

async function request<T>(method: 'GET' | 'POST' | 'DELETE', url: string, body?: unknown): Promise<T> {
  let r: Response
  try {
    r = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiFailure('network', ERROR_TEXT.network)
  }
  const data = (await r.json().catch(() => null)) as (T & { error?: string; message?: string }) | null
  if (!r.ok) {
    const code = data?.error ?? `http_${r.status}`
    throw new ApiFailure(code, ERROR_TEXT[code] ?? data?.message ?? '요청을 처리하지 못했어요.')
  }
  return data as T
}

/* ── 로그인 상태 저장소 (/api/me) ─────────────────────────────────── */

type MeState = { status: 'loading' | 'ready'; user: User | null }

let state: MeState = { status: 'loading', user: null }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()

function setState(next: MeState) {
  state = next
  listeners.forEach((l) => l())
}

function setUser(user: User | null) {
  setState({ status: 'ready', user })
}

/** /api/me 를 다시 읽는다. 실패하면 로그아웃 상태로 본다 */
export function refreshMe(): Promise<void> {
  if (inflight) return inflight
  inflight = request<{ user: User | null }>('GET', '/api/me')
    .then((r) => setUser(r.user ?? null))
    .catch(() => setUser(null))
    .finally(() => {
      inflight = null
    })
  return inflight
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

/** 현재 로그인 사용자 — 처음 쓰일 때 한 번 /api/me 를 읽는다 */
export function useMe(): MeState {
  const snap = useSyncExternalStore(subscribe, () => state, () => state)
  useEffect(() => {
    if (state.status === 'loading' && !inflight) void refreshMe()
  }, [])
  return snap
}

/* ── 계정 API ────────────────────────────────────────────────────── */

export async function signup(email: string, password: string, consent: Consent): Promise<User> {
  const r = await request<{ user: User }>('POST', '/api/auth/signup', { email: email.trim(), password, consent })
  setUser(r.user)
  return r.user
}

export async function login(email: string, password: string): Promise<User> {
  const r = await request<{ user: User }>('POST', '/api/auth/login', { email: email.trim(), password })
  setUser(r.user)
  return r.user
}

/** 구글 ID 토큰(credential)으로 가입·로그인. 새 사용자면 consent 가 있어야 한다 */
export async function googleLogin(credential: string, consent?: Consent): Promise<{ user: User; isNew: boolean }> {
  const r = await request<{ user: User; isNew: boolean }>('POST', '/api/auth/google', consent ? { credential, consent } : { credential })
  setUser(r.user)
  return r
}

export async function logout(): Promise<void> {
  try {
    await request<{ ok: boolean }>('POST', '/api/auth/logout')
  } finally {
    disableGoogleAutoSelect()
    setUser(null)
  }
}

/** 회원 탈퇴 — 서버가 users 행을 즉시 삭제하고 쿠키를 지운다 */
export async function deleteAccount(): Promise<void> {
  await request<{ ok: boolean }>('DELETE', '/api/me')
  disableGoogleAutoSelect()
  setUser(null)
}

/* ── 공개 설정 (/api/config) ──────────────────────────────────────── */

let configPromise: Promise<{ googleClientId: string | null }> | null = null

export function getConfig(): Promise<{ googleClientId: string | null }> {
  if (!configPromise) {
    configPromise = request<{ googleClientId: string | null }>('GET', '/api/config')
      .then((c) => ({ googleClientId: c.googleClientId || null }))
      .catch((e) => {
        configPromise = null // 다음에 다시 시도
        throw e
      })
  }
  return configPromise
}

/* ── Google Identity Services ─────────────────────────────────────── */

export interface GisButtonOptions {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

export interface GisId {
  initialize(config: {
    client_id: string
    callback: (res: { credential?: string }) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    ux_mode?: 'popup' | 'redirect'
    use_fedcm_for_button?: boolean
  }): void
  renderButton(parent: HTMLElement, options: GisButtonOptions): void
  disableAutoSelect(): void
  cancel(): void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GisId } }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisPromise: Promise<GisId> | null = null

/** 구글 공식 스크립트를 한 번만 동적으로 불러온다 */
export function loadGis(): Promise<GisId> {
  const ready = window.google?.accounts?.id
  if (ready) return Promise.resolve(ready)
  if (gisPromise) return gisPromise
  gisPromise = new Promise<GisId>((resolve, reject) => {
    const fail = () => {
      gisPromise = null
      reject(new ApiFailure('gis_load', ERROR_TEXT.gis_load))
    }
    const done = () => {
      const id = window.google?.accounts?.id
      if (id) resolve(id)
      else fail()
    }
    let s = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
    if (!s) {
      s = document.createElement('script')
      s.src = GIS_SRC
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }
    s.addEventListener('load', done, { once: true })
    s.addEventListener('error', fail, { once: true })
  })
  return gisPromise
}

function disableGoogleAutoSelect() {
  try {
    window.google?.accounts?.id?.disableAutoSelect()
  } catch {
    /* 스크립트가 없으면 할 일도 없다 */
  }
}
