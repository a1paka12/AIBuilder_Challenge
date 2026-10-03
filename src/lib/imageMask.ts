/*
 * 기기 내 개인정보 제거 — 사진 (PRD FR-01 사진 부분)
 * JPEG·PNG 사진의 영역을 불투명(#111)하게 가린 뒤 canvas 로 다시 인코딩해 "메타데이터(EXIF·GPS·XMP 등)가 없는 새 파일"을 만든다.
 * 재인코딩 결과는 다시 읽어 메타데이터 세그먼트가 정말 없는지 확인한 뒤에만 돌려준다.
 *
 * 이 모듈은 네트워크를 쓰지 않고 api.ts 도 불러오지 않는다.
 * 처리본의 지문(SHA-256)을 서버에 보내는 일은 Record 화면이 [확인하고 기록하기] 뒤에만 한다.
 */

export type MaskableType = 'image/jpeg' | 'image/png'

/** 가림 상자 — 사진 크기 대비 0~1 비율 좌표 (x, y 는 왼쪽 위, w, h 는 너비·높이) */
export interface MaskRect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export interface MaskedImage {
  /** 가림 + 재인코딩을 거친 새 파일 (원본과 다른 바이트) */
  blob: Blob
  type: MaskableType
  width: number
  height: number
  bytes: number
  /** 처리본의 지문 — 서버로 가는 유일한 값 */
  sha256: string
  maskCount: number
  /** 긴 변이 MAX_EDGE 를 넘어 줄였는지 */
  downscaled: boolean
  /** 재인코딩 결과를 다시 읽어 EXIF·XMP·IPTC·텍스트 청크가 없음을 확인함 */
  metadataRemoved: true
}

export type MaskErrorCode = 'unsupported' | 'decode' | 'canvas' | 'encode' | 'metadata'

export class MaskError extends Error {
  code: MaskErrorCode
  constructor(code: MaskErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/** 처리본의 긴 변 최대 픽셀 */
export const MAX_EDGE = 2400
export const JPEG_QUALITY = 0.92
/** 가림 색 — 불투명 */
export const MASK_FILL = '#111111'
/** 상자 최소 너비·높이(비율) */
export const MIN_SIZE = 0.02

const EXT: Record<string, MaskableType> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', png: 'image/png' }

/** JPEG·PNG 이면 그 형식, 아니면 null (MIME 이 비어 있으면 확장자로 판단) */
export function maskableType(file: File): MaskableType | null {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/jpeg' || t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg'
  if (t === 'image/png') return 'image/png'
  if (t) return null
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  return EXT[ext] ?? null
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 상자를 사진 안에, 최소 크기 이상으로 맞춘다 */
export function clampRect(r: MaskRect): MaskRect {
  const w = clamp(r.w, MIN_SIZE, 1)
  const h = clamp(r.h, MIN_SIZE, 1)
  return { id: r.id, w, h, x: clamp(r.x, 0, 1 - w), y: clamp(r.y, 0, 1 - h) }
}

/** 두 점으로 상자 만들기 (드래그) */
export function rectFromPoints(id: string, x1: number, y1: number, x2: number, y2: number): MaskRect {
  return { id, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
}

export function newRectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 0.3 → "30%" */
export const pct = (v: number) => `${Math.round(v * 100)}%`

/** 원본을 브라우저 안에서 연다 (object URL 은 로드 직후 해제). EXIF 회전은 브라우저가 적용한 상태로 그려진다 */
export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new MaskError('decode', '사진을 읽지 못했어요.'))
        return
      }
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new MaskError('decode', '사진을 읽지 못했어요. 파일이 손상됐거나 지원하지 않는 형식이에요.'))
    }
    img.src = url
  })
}

/** 가림 상자를 불투명 사각형으로 칠한다 — 미리보기와 처리본이 같은 함수를 써서 "보이는 대로" 가려진다 */
export function paintMasks(ctx: CanvasRenderingContext2D, rects: MaskRect[], cw: number, ch: number): void {
  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = MASK_FILL
  for (const r of rects) {
    // 압축 경계에서 가장자리가 새지 않도록 1px 넓게 칠한다
    const x = Math.max(0, Math.floor(r.x * cw) - 1)
    const y = Math.max(0, Math.floor(r.y * ch) - 1)
    const w = Math.min(cw - x, Math.ceil(r.w * cw) + 2)
    const h = Math.min(ch - y, Math.ceil(r.h * ch) + 2)
    if (w > 0 && h > 0) ctx.fillRect(x, y, w, h)
  }
  ctx.restore()
}

function toBlob(canvas: HTMLCanvasElement, type: MaskableType): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      if (type === 'image/jpeg') canvas.toBlob(resolve, type, JPEG_QUALITY)
      else canvas.toBlob(resolve, type)
    } catch {
      resolve(null)
    }
  })
}

/** 처리본의 SHA-256 (브라우저 안에서 계산) */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 메타데이터가 남아 있는지 다시 읽어 확인한다.
 * JPEG: APP1(EXIF·XMP)·APP13(IPTC) 세그먼트 / PNG: eXIf·tEXt·zTXt·iTXt·tIME 청크
 */
export async function hasMetadata(blob: Blob): Promise<boolean> {
  const v = new DataView(await blob.arrayBuffer())
  if (v.byteLength >= 4 && v.getUint16(0) === 0xffd8) {
    let off = 2
    while (off + 4 <= v.byteLength) {
      if (v.getUint8(off) !== 0xff) return false
      const marker = v.getUint8(off + 1)
      if (marker === 0xff) {
        off += 1
        continue
      }
      if (marker === 0xda || marker === 0xd9) return false // 영상 데이터 시작/끝 — 그 뒤엔 메타데이터 세그먼트가 없다
      if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        off += 2
        continue
      }
      if (marker === 0xe1 || marker === 0xed) return true
      const len = v.getUint16(off + 2)
      if (len < 2) return false
      off += 2 + len
    }
    return false
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (v.byteLength >= 8 && v.getUint32(0) === 0x89504e47 && v.getUint32(4) === 0x0d0a1a0a) {
    const META = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'])
    let off = 8
    while (off + 8 <= v.byteLength) {
      const len = v.getUint32(off)
      const type = String.fromCharCode(v.getUint8(off + 4), v.getUint8(off + 5), v.getUint8(off + 6), v.getUint8(off + 7))
      if (META.has(type)) return true
      if (type === 'IEND') return false
      off += 12 + len
    }
    return false
  }
  return false
}

/**
 * 처리본 만들기: 원본을 canvas 에 그리고(긴 변 최대 MAX_EDGE 로 축소) 상자를 불투명하게 칠한 뒤
 * 원래 형식(JPEG 0.92 / PNG)으로 새 Blob 을 만든다. canvas 재인코딩이라 EXIF·GPS 등 메타데이터가 사라진다.
 * 어느 단계든 실패하면 MaskError 를 던진다 → 호출한 쪽은 전송을 막는다.
 */
export async function createMaskedImage(file: File, rects: MaskRect[], loaded?: HTMLImageElement): Promise<MaskedImage> {
  const type = maskableType(file)
  if (!type) throw new MaskError('unsupported', 'JPEG·PNG 사진만 가릴 수 있어요.')
  const img = loaded ?? (await loadImage(file))
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh) throw new MaskError('decode', '사진을 읽지 못했어요.')

  const scale = Math.min(1, MAX_EDGE / Math.max(nw, nh))
  const cw = Math.max(1, Math.round(nw * scale))
  const ch = Math.max(1, Math.round(nh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new MaskError('canvas', '이 브라우저에서는 처리본을 만들 수 없어요.')
  ctx.drawImage(img, 0, 0, cw, ch)
  paintMasks(ctx, rects.map(clampRect), cw, ch)

  const blob = await toBlob(canvas, type)
  if (!blob || blob.size === 0) throw new MaskError('encode', '처리본 파일을 만들지 못했어요.')
  if (await hasMetadata(blob)) throw new MaskError('metadata', '처리본에 메타데이터가 남아 있어 전송을 막았어요.')

  const outType: MaskableType = blob.type === 'image/png' ? 'image/png' : 'image/jpeg'
  return {
    blob,
    type: outType,
    width: cw,
    height: ch,
    bytes: blob.size,
    sha256: await sha256Hex(blob),
    maskCount: rects.length,
    downscaled: scale < 1,
    metadataRemoved: true,
  }
}
