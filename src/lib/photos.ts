/*
 * 서버 사진 보관 API 클라이언트 (로그인한 사용자 전용)
 * - 보내는 것은 기기 안에서 가리고 메타데이터를 지운 처리본 바이트뿐이다. 원본·가리기 전 사진은 보내지 않는다.
 * - 사진은 로그인한 내 계정에만 보관된다(공개 링크 없음). 파일은 같은 출처의 /api/photos/<id>/file 로 쿠키와 함께 열린다.
 * - 삭제·탈퇴하면 바로 삭제, 늦어도 2026-12-31 일괄 삭제(운영 방침).
 */
import { ApiFailure } from '../api'
import type { MaskableType } from './imageMask'
import type { Phase, Zone } from '../types'

export interface ServerPhoto {
  id: number
  sha256: string
  mime: MaskableType
  zone: Zone
  phase: Phase
  memo: string
  receivedAt: string
  sig: string
  url: string
}

export const MEMO_MAX = 300
/** 서버 보관 한도(사용자당) — 기록북 범위와 같다 */
export const SERVER_LIMIT = 30
export const RETENTION_TEXT = '삭제·탈퇴하면 바로 삭제, 늦어도 2026. 12. 31.'

const ERROR_TEXT: Record<string, string> = {
  login_required: '로그인이 끊겼어요. 다시 로그인한 뒤 저장해 주세요.',
  http_401: '로그인이 끊겼어요. 다시 로그인한 뒤 저장해 주세요.',
  photo_consent_required: '서버 보관 동의가 필요해요. 아래 [필수] 동의에 체크한 뒤 다시 눌러 주세요.',
  limit_reached: `서버에는 사진 ${SERVER_LIMIT}장까지 보관해요. 사진을 지운 뒤 다시 추가해 주세요.`,
  metadata_present: '처리본에 메타데이터가 남아 있어 서버가 받지 않았어요. [다시 가리기]로 처리본을 다시 만들어 주세요.',
  unsupported_type: 'JPEG·PNG 처리본만 저장할 수 있어요. 사진을 다시 처리해 주세요.',
  too_large: '처리본이 너무 커요(6MB 초과). 다른 사진으로 다시 시도해 주세요.',
  http_413: '처리본이 너무 커요(6MB 초과). 다른 사진으로 다시 시도해 주세요.',
  not_found: '이미 지워졌거나 찾을 수 없는 사진이에요.',
  http_404: '이미 지워졌거나 찾을 수 없는 사진이에요.',
  memo_too_long: `메모는 ${MEMO_MAX}자까지 쓸 수 있어요.`,
  bad_memo: `메모는 ${MEMO_MAX}자까지 쓸 수 있어요.`,
  rate_limited: '요청이 너무 잦아요. 1분쯤 뒤에 다시 시도해 주세요.',
  http_429: '요청이 너무 잦아요. 1분쯤 뒤에 다시 시도해 주세요.',
  network: '연결이 불안정해요. 잠시 후 다시 시도해 주세요.',
}

export function photoErrorText(e: unknown): string {
  const code = e instanceof ApiFailure ? e.code : ''
  return ERROR_TEXT[code] ?? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
}

export function photoErrorCode(e: unknown): string {
  return e instanceof ApiFailure ? e.code : ''
}

/** 401 계열인지 — 화면에서 로그인 상태를 다시 읽을 때 쓴다 */
export const isLoginError = (e: unknown) => {
  const c = photoErrorCode(e)
  return c === 'login_required' || c === 'http_401'
}

async function call<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, body?: { json: unknown } | { blob: Blob; type: string }): Promise<T> {
  let r: Response
  try {
    const init: RequestInit = { method, credentials: 'same-origin' }
    if (body && 'json' in body) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(body.json)
    } else if (body) {
      init.headers = { 'Content-Type': body.type }
      init.body = body.blob
    }
    r = await fetch(url, init)
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

/** 내 사진 목록 (서버 기록 시각 순) */
export async function listPhotos(): Promise<ServerPhoto[]> {
  const r = await call<{ photos: ServerPhoto[] }>('GET', '/api/photos')
  return Array.isArray(r.photos) ? r.photos : []
}

/** 서버 보관 동의 */
export async function consentPhotos(): Promise<string> {
  const r = await call<{ ok: boolean; consentAt: string }>('POST', '/api/photos/consent')
  return r.consentAt
}

/**
 * 처리본 저장 — 본문은 가림·재인코딩을 거친 처리본 Blob 그대로.
 * 같은 처리본(sha256)이 이미 있으면 서버가 기존 것을 돌려준다(existing=true).
 */
export async function uploadPhoto(blob: Blob, type: MaskableType, meta: { zone: Zone; phase: Phase; memo?: string }): Promise<{ photo: ServerPhoto }> {
  const q = new URLSearchParams({ zone: meta.zone, phase: meta.phase })
  if (meta.memo) q.set('memo', meta.memo.slice(0, MEMO_MAX))
  return call<{ photo: ServerPhoto }>('POST', `/api/photos?${q.toString()}`, { blob, type })
}

export async function updatePhoto(id: number, patch: { memo?: string; zone?: Zone; phase?: Phase }): Promise<ServerPhoto> {
  const body = patch.memo === undefined ? patch : { ...patch, memo: patch.memo.slice(0, MEMO_MAX) }
  const r = await call<{ photo?: ServerPhoto } & Partial<ServerPhoto>>('PATCH', `/api/photos/${id}`, { json: body })
  return (r.photo ?? r) as ServerPhoto
}

export async function deletePhoto(id: number): Promise<void> {
  await call<{ ok: boolean }>('DELETE', `/api/photos/${id}`)
}
