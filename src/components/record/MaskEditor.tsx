/*
 * 개인정보 가리기 대화상자 (PRD FR-01 사진 부분)
 * 1 / 2 "개인정보 가리기": 사진 위에 불투명 가림 상자 — 포인터 드래그로 그리기 + 키보드 대안(상자 추가·화살표 이동·크기 버튼·삭제)
 * 2 / 2 "전송본 확인": 처리본 미리보기 + "서버로 보내는 것: 지문 64자뿐" + 실제 지문 값 → [확인하고 기록하기]
 *
 * 이 파일은 api.ts 를 불러오지 않는다. 네트워크 호출이 없고, [확인하고 기록하기] 를 눌렀을 때만 onConfirm 으로 처리본을 넘긴다.
 * 접근성: role=dialog·aria-modal·포커스 가둠·Esc(=취소)·닫으면 포커스 복귀, canvas 에 aria-label, 상자 추가·이동·크기·삭제는 aria-live 로 알림.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  MIN_SIZE,
  MaskError,
  clampRect,
  createMaskedImage,
  loadImage,
  newRectId,
  paintMasks,
  pct,
  rectFromPoints,
  type MaskRect,
  type MaskedImage,
} from '../../lib/imageMask'
import { useModalA11y } from './useModalA11y'

/** [확인하고 기록하기] 결과 — 처리본 + 미리보기 object URL(소유권이 호출한 쪽으로 넘어간다) */
export interface ConfirmedTransfer extends MaskedImage {
  url: string
}

export interface MaskEditorProps {
  file: File
  /** 제목 옆에 보일 이름 (예: "벽 · 입주") */
  label: string
  /** 닫기·취소·Esc — 사진 추가 자체를 취소한다 */
  onCancel: () => void
  /** [확인하고 기록하기] 를 눌렀을 때만 불린다 */
  onConfirm: (result: ConfirmedTransfer) => void
}

type Step = 'mask' | 'confirm'
type Drag = { mode: 'draw'; sx: number; sy: number } | { mode: 'move'; id: string; dx: number; dy: number; moved: boolean }

/** 미리보기 canvas 의 긴 변 (표시용, 처리본은 imageMask.MAX_EDGE) */
const DISPLAY_EDGE = 1200
const STEP_SMALL = 0.02
const STEP_BIG = 0.1

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const boxName = (i: number) => `가림 상자 ${i + 1}`
const boxPos = (r: MaskRect) => `가로 ${pct(r.x)} 세로 ${pct(r.y)} 위치`
const boxSize = (r: MaskRect) => `너비 ${pct(r.w)} 높이 ${pct(r.h)}`
const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`)

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export default function MaskEditor({ file, label, onCancel, onConfirm }: MaskEditorProps) {
  const uid = useId()
  const titleId = `${uid}-title`
  const descId = `${uid}-desc`
  const kbdId = `${uid}-kbd`

  const [step, setStep] = useState<Step>('mask')
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rects, setRects] = useState<MaskRect[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<MaskRect | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ image: MaskedImage; url: string } | null>(null)
  const [live, setLive] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const dragRef = useRef<Drag | null>(null)
  // 처리본 미리보기 object URL — 확인하면 소유권을 넘기고, 아니면 이 대화상자가 해제한다
  const ownedUrlRef = useRef<string | null>(null)
  const { dialogRef, onKeyDown } = useModalA11y<HTMLDivElement>(onCancel, titleRef)

  const announce = (msg: string) => setLive(msg)

  // 원본 열기 (브라우저 안에서만)
  useEffect(() => {
    let alive = true
    loadImage(file)
      .then((i) => {
        if (alive) setImg(i)
      })
      .catch((e: unknown) => {
        if (alive) setLoadError(e instanceof MaskError ? e.message : '사진을 읽지 못했어요.')
      })
    return () => {
      alive = false
    }
  }, [file])

  // 언마운트: 아직 넘기지 않은 미리보기 URL 해제
  useEffect(
    () => () => {
      if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current)
      ownedUrlRef.current = null
    },
    [],
  )

  // 단계가 바뀌면 제목으로 포커스
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => titleRef.current?.focus())
    return () => window.cancelAnimationFrame(raf)
  }, [step])

  const selectedIndex = rects.findIndex((r) => r.id === selectedId)
  const selected = selectedIndex >= 0 ? rects[selectedIndex] : null
  const selectedName = selected ? boxName(selectedIndex) : null

  /* ── 미리보기 그리기: 사진 → 불투명 상자(처리본과 같은 함수) → 번호·선택 테두리·그리는 중인 상자 ── */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    const scale = Math.min(1, DISPLAY_EDGE / Math.max(nw, nh))
    const cw = Math.max(1, Math.round(nw * scale))
    const ch = Math.max(1, Math.round(nh * scale))
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw
      canvas.height = ch
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, cw, ch)
    ctx.drawImage(img, 0, 0, cw, ch)
    paintMasks(ctx, rects, cw, ch)

    const fontPx = Math.max(12, Math.round(Math.min(cw, ch) * 0.035))
    ctx.font = `700 ${fontPx}px sans-serif`
    ctx.textBaseline = 'middle'
    rects.forEach((r, i) => {
      const x = r.x * cw
      const y = r.y * ch
      const w = r.w * cw
      const h = r.h * ch
      if (r.id === selectedId) {
        ctx.save()
        ctx.lineWidth = 4
        ctx.strokeStyle = '#ffffff'
        ctx.strokeRect(x, y, w, h)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#1f6feb'
        ctx.setLineDash([8, 5])
        ctx.strokeRect(x, y, w, h)
        ctx.restore()
      }
      // 번호 라벨
      const tag = String(i + 1)
      const padX = Math.round(fontPx * 0.5)
      const tw = ctx.measureText(tag).width + padX * 2
      const th = Math.round(fontPx * 1.5)
      const lx = Math.min(x + 4, cw - tw)
      const ly = Math.min(y + 4, ch - th)
      ctx.fillStyle = r.id === selectedId ? '#1f6feb' : '#0b4ea2'
      ctx.fillRect(lx, ly, tw, th)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(tag, lx + padX, ly + th / 2)
    })
    if (draft && draft.w > 0 && draft.h > 0) {
      ctx.save()
      ctx.fillStyle = 'rgba(17, 17, 17, 0.55)'
      ctx.fillRect(draft.x * cw, draft.y * ch, draft.w * cw, draft.h * ch)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#ffffff'
      ctx.setLineDash([6, 4])
      ctx.strokeRect(draft.x * cw, draft.y * ch, draft.w * cw, draft.h * ch)
      ctx.restore()
    }
  }, [img, rects, selectedId, draft])

  useEffect(() => {
    draw()
  }, [draw, step])

  /* ── 상자 조작 (포인터·키보드 공용) ── */
  const addRect = (r: MaskRect) => {
    const next = clampRect(r)
    const index = rects.length
    setRects((prev) => [...prev, next])
    setSelectedId(next.id)
    announce(`${boxName(index)} 추가 — ${boxPos(next)}, ${boxSize(next)}`)
  }

  const addCenterRect = () => {
    const n = rects.length
    const off = (n % 5) * 0.04 // 겹쳐 안 보이지 않게 조금씩 비껴 놓는다
    addRect({ id: newRectId(), x: 0.35 + off, y: 0.4 + off, w: 0.3, h: 0.2 })
  }

  const patchSelected = (fn: (r: MaskRect) => MaskRect, tell: (r: MaskRect) => string) => {
    if (!selected) return
    const next = clampRect(fn(selected))
    setRects((prev) => prev.map((r) => (r.id === next.id ? next : r)))
    announce(`${selectedName} — ${tell(next)}`)
  }
  const moveSelected = (dx: number, dy: number) => patchSelected((r) => ({ ...r, x: r.x + dx, y: r.y + dy }), boxPos)
  const resizeSelected = (dw: number, dh: number) => patchSelected((r) => ({ ...r, w: r.w + dw, h: r.h + dh }), boxSize)

  const removeSelected = () => {
    if (!selected) return
    const name = selectedName
    setRects((prev) => prev.filter((r) => r.id !== selected.id))
    setSelectedId(null)
    announce(`${name} 삭제함`)
  }

  const selectRect = (id: string, i: number) => {
    setSelectedId(id)
    const r = rects[i]
    announce(`${boxName(i)} 선택 — ${boxPos(r)}, ${boxSize(r)}. 화살표로 옮길 수 있어요`)
  }

  // 작업 영역의 키보드: 화살표 이동(Shift 크게) · Alt+화살표 크기 · Delete 삭제
  const onWorkKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!selected) return
    const t = e.target as HTMLElement
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
    const s = e.shiftKey ? STEP_BIG : STEP_SMALL
    const alt = e.altKey
    switch (e.key) {
      case 'ArrowLeft':
        if (alt) resizeSelected(-s, 0)
        else moveSelected(-s, 0)
        break
      case 'ArrowRight':
        if (alt) resizeSelected(s, 0)
        else moveSelected(s, 0)
        break
      case 'ArrowUp':
        if (alt) resizeSelected(0, -s)
        else moveSelected(0, -s)
        break
      case 'ArrowDown':
        if (alt) resizeSelected(0, s)
        else moveSelected(0, s)
        break
      case 'Delete':
      case 'Backspace':
        removeSelected()
        break
      default:
        return
    }
    e.preventDefault()
  }

  /* ── 포인터: 빈 곳에서 끌면 새 상자, 상자 위에서 끌면 옮기기, 탭하면 선택 ── */
  const toNorm = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    return { x: clamp01((e.clientX - b.left) / b.width), y: clamp01((e.clientY - b.top) / b.height) }
  }
  const hitTest = (x: number, y: number): MaskRect | null => {
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i]
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r
    }
    return null
  }
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!img || processing) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.focus({ preventScroll: true })
    const p = toNorm(e)
    const hit = hitTest(p.x, p.y)
    if (hit) {
      dragRef.current = { mode: 'move', id: hit.id, dx: p.x - hit.x, dy: p.y - hit.y, moved: false }
      setSelectedId(hit.id)
    } else {
      dragRef.current = { mode: 'draw', sx: p.x, sy: p.y }
      setDraft({ id: 'draft', x: p.x, y: p.y, w: 0, h: 0 })
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* 포인터 캡처 미지원 — 이동 이벤트는 canvas 위에서만 받는다 */
    }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = dragRef.current
    if (!d) return
    const p = toNorm(e)
    if (d.mode === 'draw') {
      setDraft(rectFromPoints('draft', d.sx, d.sy, p.x, p.y))
    } else {
      d.moved = true
      setRects((prev) => prev.map((r) => (r.id === d.id ? clampRect({ ...r, x: p.x - d.dx, y: p.y - d.dy }) : r)))
    }
  }
  const endDrag = (e: ReactPointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.mode === 'draw') {
      setDraft(null)
      if (cancelled) return
      const p = toNorm(e)
      const r = rectFromPoints(newRectId(), d.sx, d.sy, p.x, p.y)
      if (r.w >= MIN_SIZE && r.h >= MIN_SIZE) addRect(r)
      else setSelectedId(null)
    } else if (d.moved) {
      const i = rects.findIndex((r) => r.id === d.id)
      if (i >= 0) announce(`${boxName(i)} 옮김 — ${boxPos(rects[i])}`)
    }
  }

  /* ── 처리본 만들기 → 전송본 확인 ── */
  const makeProcessed = async () => {
    if (!img || processing) return
    setProcessing(true)
    setError(null)
    announce('처리본을 만드는 중이에요')
    try {
      const r = await createMaskedImage(file, rects, img)
      if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current)
      const url = URL.createObjectURL(r.blob)
      ownedUrlRef.current = url
      setResult({ image: r, url })
      setStep('confirm')
      announce(`처리본을 만들었어요. 가림 상자 ${r.maskCount}개, 메타데이터 제거됨. 전송본을 확인해 주세요`)
    } catch (err) {
      const msg = err instanceof MaskError ? err.message : '처리본을 만들지 못했어요.'
      setError(`${msg} 서버로 보낸 것은 없어요. 다른 사진으로 다시 시도해 주세요.`)
      announce('처리본을 만들지 못했어요. 전송하지 않았어요')
    } finally {
      setProcessing(false)
    }
  }

  const backToMask = () => {
    if (ownedUrlRef.current) URL.revokeObjectURL(ownedUrlRef.current)
    ownedUrlRef.current = null
    setResult(null)
    setStep('mask')
  }

  // 유일한 확인 경로 — 처리본과 지문, 미리보기 URL 의 소유권을 넘긴다
  const confirm = () => {
    if (!result) return
    ownedUrlRef.current = null
    onConfirm({ ...result.image, url: result.url })
  }

  const canvasLabel = `${label} 사진 미리보기 · 가림 상자 ${rects.length}개${selectedName ? ` · ${selectedName} 선택됨` : ''}`
  const out = result?.image ?? null

  return (
    <div className="modal-backdrop mk-backdrop" role="presentation">
      <div ref={dialogRef} className="modal mk-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId} onKeyDown={onKeyDown}>
        <header className="mk-head">
          <div className="mk-head-text">
            <p className="eyebrow mk-eyebrow">{step === 'mask' ? '1 / 2 · 개인정보 가리기' : '2 / 2 · 전송본 확인'}</p>
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className="mk-title">
              {step === 'mask' ? '사진에서 개인정보를 가려요' : '전송본 확인'}
              <span className="muted small mk-title-sub"> · {label}</span>
            </h2>
          </div>
          <button type="button" className="mk-x" aria-label="닫기 (사진 추가 취소)" onClick={onCancel}>
            <CloseIcon />
          </button>
        </header>

        <div className="mk-body">
          {step === 'mask' ? (
            <>
              <p id={descId} className="mk-guide">
                택배 송장, 우편물의 이름·주소, 얼굴, 호수(문패), 차 번호처럼 개인정보가 보이는 곳을 가려 주세요. 가린 곳은 되돌릴 수 없는{' '}
                <b>불투명 상자</b>로 칠해지고, 처리본은 사진 정보(EXIF·GPS 등 메타데이터)가 지워진 <b>새 파일</b>이에요. 원본은 이 기기 밖으로 나가지 않아요.
              </p>
              <div className="mk-work" onKeyDown={onWorkKeyDown}>
                <div className="mk-stage">
                  {loadError ? (
                    <p className="error-text mk-stage-error" role="alert">{loadError} 서버로 보낸 것은 없어요.</p>
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className="mk-canvas"
                      role="img"
                      tabIndex={0}
                      aria-label={canvasLabel}
                      aria-describedby={kbdId}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={(e) => endDrag(e, false)}
                      onPointerCancel={(e) => endDrag(e, true)}
                    />
                  )}
                  {!img && !loadError && (
                    <p className="mk-loading" role="status">
                      사진 여는 중…
                    </p>
                  )}
                </div>
                <p id={kbdId} className="muted small mk-kbd">
                  사진 위를 끌어 상자를 그려요. 키보드로는 [가림 상자 추가] 뒤 <kbd>화살표</kbd> 옮기기 · <kbd>Shift</kbd>+<kbd>화살표</kbd> 크게 옮기기 ·{' '}
                  <kbd>Alt</kbd>+<kbd>화살표</kbd> 또는 아래 버튼으로 크기 · <kbd>Delete</kbd> 삭제.
                </p>
                <div className="mk-tools" role="group" aria-label="가림 상자 도구">
                  <button type="button" className="btn primary" onClick={addCenterRect} disabled={!img || processing}>
                    가림 상자 추가
                  </button>
                  <button type="button" className="btn" disabled={!selected || processing} aria-label={selectedName ? `${selectedName} 넓게` : '넓게 (상자를 먼저 고르세요)'} onClick={() => resizeSelected(STEP_SMALL * 2, 0)}>
                    넓게
                  </button>
                  <button type="button" className="btn" disabled={!selected || processing} aria-label={selectedName ? `${selectedName} 좁게` : '좁게 (상자를 먼저 고르세요)'} onClick={() => resizeSelected(-STEP_SMALL * 2, 0)}>
                    좁게
                  </button>
                  <button type="button" className="btn" disabled={!selected || processing} aria-label={selectedName ? `${selectedName} 높게` : '높게 (상자를 먼저 고르세요)'} onClick={() => resizeSelected(0, STEP_SMALL * 2)}>
                    높게
                  </button>
                  <button type="button" className="btn" disabled={!selected || processing} aria-label={selectedName ? `${selectedName} 낮게` : '낮게 (상자를 먼저 고르세요)'} onClick={() => resizeSelected(0, -STEP_SMALL * 2)}>
                    낮게
                  </button>
                  <button type="button" className="btn ghost" disabled={!selected || processing} aria-label={selectedName ? `${selectedName} 삭제` : '상자 삭제 (상자를 먼저 고르세요)'} onClick={removeSelected}>
                    상자 삭제
                  </button>
                </div>
                <div className="mk-list" role="group" aria-label="가림 상자 목록">
                  {rects.length === 0 ? (
                    <p className="muted small">
                      아직 가림 상자가 없어요. 개인정보가 안 보이는 사진이면 그대로 [처리본 만들기]를 눌러도 돼요 — 메타데이터는 똑같이 제거돼요.
                    </p>
                  ) : (
                    rects.map((r, i) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`mk-box-btn${r.id === selectedId ? ' is-selected' : ''}`}
                        aria-pressed={r.id === selectedId}
                        onClick={() => selectRect(r.id, i)}
                      >
                        {boxName(i)}
                        <span className="muted small">
                          ({boxPos(r)} · {boxSize(r)})
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              {error && (
                <p className="error-text" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            out &&
            result && (
              <div className="mk-result">
                <p id={descId} className="mk-guide">
                  아래가 <b>실제 전송본의 바탕이 되는 처리본</b>이에요. 기록북에는 이 처리본만 쓰고, 서버에는 이 파일의 지문만 남겨요.
                </p>
                <figure className="mk-preview">
                  <img src={result.url} alt={`처리본 미리보기 — 가림 상자 ${out.maskCount}개, 메타데이터 제거됨`} />
                </figure>
                <div className="mk-facts">
                  <span className="badge ok">메타데이터 제거됨</span>
                  <span className={out.maskCount > 0 ? 'badge ok' : 'badge warn'}>
                    {out.maskCount > 0 ? `개인정보 가림 ${out.maskCount}곳` : '가린 곳 없음'}
                  </span>
                  <span className="badge num">
                    {out.type === 'image/png' ? 'PNG' : 'JPEG'} · {out.width}×{out.height} · {kb(out.bytes)}
                  </span>
                  {out.downscaled && <span className="muted small">긴 변을 2,400px로 줄였어요</span>}
                </div>
                <div className="notice mk-notice">
                  <p>
                    <strong>서버로 보내는 것:</strong> 이 처리본의 지문(SHA-256) 64자뿐이에요. 사진 자체는 보내지 않아요.
                  </p>
                  <details className="mk-fp">
                    <summary>지문 값 보기 (64자)</summary>
                    <code className="mk-fp-value num">{out.sha256}</code>
                  </details>
                </div>
                <p className="muted small mk-fine">
                  [확인하고 기록하기]를 누르기 전에는 아무것도 보내지 않아요. 누르면 처리본이 기록북에 추가되고, 지문만 서버에 기록돼요. 원본 파일은 이 기기 밖으로 나가지 않았어요.
                </p>
              </div>
            )
          )}
        </div>

        <footer className="mk-foot">
          <button type="button" className="btn ghost" onClick={onCancel}>
            취소
          </button>
          {step === 'mask' ? (
            <button type="button" className="btn primary" onClick={makeProcessed} disabled={!img || processing}>
              {processing ? '처리본 만드는 중…' : '처리본 만들기'}
            </button>
          ) : (
            <>
              <button type="button" className="btn" onClick={backToMask}>
                다시 가리기
              </button>
              <button type="button" className="btn primary" onClick={confirm} disabled={!result}>
                확인하고 기록하기
              </button>
            </>
          )}
        </footer>
        <p className="rc-sr-only" aria-live="polite">
          {live}
        </p>
      </div>
    </div>
  )
}
