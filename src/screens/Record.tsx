// 방 상태 기록 · 기록북 (PRD FR-05)
import { useRef, useState, type ChangeEvent } from 'react'
import { useStore } from '../state'
import { go } from '../router'
import { ApiFailure, createReceipt, formatKST, sha256OfFile } from '../api'
import type { DateSource, Phase, RoomPhoto, Zone } from '../types'
import { readExifDate } from '../lib/exif'
import '../styles/record.css'

const ZONES: Zone[] = ['벽', '바닥', '욕실', '주방', '창문/문', '옵션 가전', '기타']
const PHASES: Phase[] = ['입주', '퇴실']
const FREE_LIMIT = 2
const PRINT_CLASS = 'print-book'
const DATE_LABEL: { [K in DateSource]: string } = {
  exif: '사진 정보상 날짜',
  manual: '직접 입력',
  none: '미입력',
}
const RECEIPT_NOTE = '서버 기록은 그 시각에 이 사진 파일의 지문이 서버에 남았다는 뜻이에요. 촬영 시각이나 법적 효력을 보장하지 않아요.'

// 화면을 벗어났다 돌아와도 이번 접속 동안은 데모 해제를 유지한다(새로고침하면 처음 상태)
let demoUnlockedSession = false

const pad = (n: number) => String(n).padStart(2, '0')
function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
const toInputValue = (date: string | null) => (date ? date.replace(' ', 'T') : '')
const receiptText = (p: RoomPhoto) =>
  p.receipt ? `서버 기록 · ${formatKST(p.receipt.receivedAt)} · 지문 ${p.sha256.slice(0, 8)}` : null

export default function RecordScreen() {
  const { photos, setPhotos, roomNickname, setRoomNickname } = useStore()
  const [zone, setZone] = useState<Zone>('벽')
  const [phase, setPhase] = useState<Phase>('입주')
  const [unlocked, setUnlocked] = useState(demoUnlockedSession)
  const [limitOpen, setLimitOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [busy, setBusy] = useState<{ [id: string]: boolean }>({})
  const [errors, setErrors] = useState<{ [id: string]: string }>({})
  const [showPreview, setShowPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const openPicker = () => fileRef.current?.click()

  const onAddClick = () => {
    setAddError(null)
    if (photos.length >= FREE_LIMIT && !unlocked) {
      setLimitOpen(true)
      return
    }
    openPicker()
  }

  const continueDemo = () => {
    demoUnlockedSession = true
    setUnlocked(true)
    setLimitOpen(false)
    openPicker()
  }

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type && !file.type.startsWith('image/')) {
      setAddError('사진 파일만 추가할 수 있어요.')
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const [sha256, exifDate] = await Promise.all([sha256OfFile(file), readExifDate(file)])
      const photo: RoomPhoto = {
        id: newId(),
        zone,
        phase,
        url: URL.createObjectURL(file),
        fileName: file.name,
        sha256,
        memo: '',
        date: exifDate,
        dateSource: exifDate ? 'exif' : 'none',
        receipt: null,
      }
      setPhotos((prev) => [...prev, photo])
    } catch {
      setAddError('사진을 불러오지 못했어요. 다른 사진으로 다시 시도해 주세요.')
    } finally {
      setAdding(false)
    }
  }

  const updatePhoto = (id: string, patch: Partial<RoomPhoto>) =>
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))

  const removePhoto = (p: RoomPhoto) => {
    URL.revokeObjectURL(p.url)
    setPhotos((prev) => prev.filter((x) => x.id !== p.id))
  }

  const onDateChange = (p: RoomPhoto, value: string) => {
    if (value) updatePhoto(p.id, { date: value.replace('T', ' ').slice(0, 16), dateSource: 'manual' })
    else updatePhoto(p.id, { date: null, dateSource: 'none' })
  }

  const recordReceipt = async (p: RoomPhoto) => {
    setBusy((b) => ({ ...b, [p.id]: true }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[p.id]
      return next
    })
    try {
      const receipt = await createReceipt(p.sha256)
      updatePhoto(p.id, { receipt })
    } catch (err) {
      const msg = err instanceof ApiFailure ? err.message : '잠시 후 다시 시도해 주세요.'
      setErrors((prev) => ({ ...prev, [p.id]: `서버 기록을 남기지 못했어요. ${msg}` }))
    } finally {
      setBusy((b) => ({ ...b, [p.id]: false }))
    }
  }

  const openPreview = () => {
    setShowPreview(true)
    setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  const printBook = () => {
    document.body.classList.add(PRINT_CLASS)
    const done = () => {
      document.body.classList.remove(PRINT_CLASS)
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    window.print()
  }

  const groups = ZONES.map((z) => ({ zone: z, items: photos.filter((p) => p.zone === z) })).filter((g) => g.items.length > 0)
  const roomTitle = roomNickname.trim() || '내 방'

  return (
    <section className="record">
      <header>
        <h1>방 상태 기록</h1>
        <div className="card record-notice">
          <p>
            사진은 브라우저 안에서만 쓰고 서버로 보내지 않아요. <b>[서버 기록 남기기]</b>는 사진 파일의 지문(SHA-256)만 보내요.
          </p>
          <p className="muted small">체험 데이터는 이 화면에서만 쓰여요. 새로고침하면 처음 상태로 돌아가요.</p>
          <p className="small record-trial">
            <span className="badge">무료 체험</span>{' '}
            {unlocked
              ? `데모로 계속 중이에요 · 지금 사진 ${photos.length}장`
              : `사진 ${FREE_LIMIT}장까지 무료 체험이에요 · 지금 ${Math.min(photos.length, FREE_LIMIT)}/${FREE_LIMIT}장`}
          </p>
        </div>
      </header>

      <div className="card">
        <label className="record-label" htmlFor="room-nickname">방 별칭</label>
        <input
          id="room-nickname"
          className="record-input"
          type="text"
          value={roomNickname}
          maxLength={40}
          placeholder="예: 정릉 원룸 302호 (비워 두면 '내 방')"
          onChange={(e) => setRoomNickname(e.target.value)}
        />
      </div>

      <div className="card record-add">
        <h2>사진 추가</h2>
        <div>
          <span className="record-label" id="zone-label">구역</span>
          <div className="chip-row" role="group" aria-labelledby="zone-label">
            {ZONES.map((z) => (
              <button key={z} type="button" className="chip" aria-pressed={zone === z} onClick={() => setZone(z)}>
                {z}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="record-label" id="phase-label">단계</span>
          <div className="seg" role="group" aria-labelledby="phase-label">
            {PHASES.map((ph) => (
              <button key={ph} type="button" aria-pressed={phase === ph} onClick={() => setPhase(ph)}>
                {ph}
              </button>
            ))}
          </div>
        </div>
        <div className="record-add-row">
          <button type="button" className="btn primary" onClick={onAddClick} disabled={adding}>
            {adding ? '사진 불러오는 중…' : '사진 추가'}
          </button>
          <span className="muted small">
            {zone} · {phase} 사진으로 추가돼요
          </span>
          <input ref={fileRef} className="record-file" type="file" accept="image/*" onChange={onFile} tabIndex={-1} aria-hidden="true" />
        </div>
        {addError && <p className="error-text" role="alert">{addError}</p>}
      </div>

      <div className="card">
        <h2>구역별 사진</h2>
        <p className="muted small">{RECEIPT_NOTE}</p>
        {groups.length === 0 ? (
          <p className="muted">아직 추가한 사진이 없어요. 구역과 단계를 고르고 [사진 추가]를 눌러 주세요.</p>
        ) : (
          groups.map((g) => (
            <div key={g.zone} className="zone-group">
              <h3>{g.zone}</h3>
              <div className="photo-grid">
                {g.items.map((p) => {
                  const rText = receiptText(p)
                  return (
                    <article key={p.id} className="card photo-card">
                      <img src={p.url} alt={`${p.zone} ${p.phase} 사진`} loading="lazy" />
                      <div className="photo-body">
                        <div className="photo-badges">
                          <span className="badge">{p.zone}</span>
                          <span className={p.phase === '입주' ? 'badge ok' : 'badge warn'}>{p.phase}</span>
                          <span className="muted small photo-file">{p.fileName}</span>
                        </div>
                        <div className="photo-date">
                          <span>{p.date ?? '날짜 없음'}</span>
                          <span className={p.dateSource === 'none' ? 'badge warn' : 'badge'}>{DATE_LABEL[p.dateSource]}</span>
                        </div>
                        <label className="small muted" htmlFor={`date-${p.id}`}>날짜 직접 입력</label>
                        <input
                          id={`date-${p.id}`}
                          className="record-input"
                          type="datetime-local"
                          value={toInputValue(p.date)}
                          onChange={(e) => onDateChange(p, e.target.value)}
                        />
                        <label className="small muted" htmlFor={`memo-${p.id}`}>메모</label>
                        <textarea
                          id={`memo-${p.id}`}
                          className="record-memo"
                          value={p.memo}
                          maxLength={300}
                          placeholder="예: 입주 때부터 있던 벽지 얼룩"
                          onChange={(e) => updatePhoto(p.id, { memo: e.target.value })}
                        />
                        {rText && <span className="badge ok receipt-badge">{rText}</span>}
                        {errors[p.id] && <p className="error-text" role="alert">{errors[p.id]}</p>}
                        <div className="photo-actions">
                          {!p.receipt && (
                            <button type="button" className="btn" onClick={() => recordReceipt(p)} disabled={!!busy[p.id]}>
                              {busy[p.id] ? '기록 남기는 중…' : '서버 기록 남기기'}
                            </button>
                          )}
                          <button type="button" className="btn ghost" onClick={() => removePhoto(p)}>
                            삭제
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {groups.length > 0 && (
        <div className="card">
          <h2>나란히 보기</h2>
          <div className="compare">
            <div className="compare-head">
              <span>입주</span>
              <span>퇴실</span>
            </div>
            {groups.map((g) => {
              const moveIn = g.items.filter((p) => p.phase === '입주')
              const moveOut = g.items.filter((p) => p.phase === '퇴실')
              return (
                <div key={g.zone} className="compare-row">
                  <h3>{g.zone}</h3>
                  <div className="compare-cols">
                    <div className="compare-cell" aria-label={`${g.zone} 입주`}>
                      {moveIn.length > 0 ? (
                        <div className="compare-thumbs">
                          {moveIn.map((p) => (
                            <img key={p.id} src={p.url} alt={`${g.zone} 입주 사진`} />
                          ))}
                        </div>
                      ) : moveOut.length > 0 ? (
                        <span className="compare-empty">입주 기록 없음</span>
                      ) : null}
                    </div>
                    <div className="compare-cell" aria-label={`${g.zone} 퇴실`}>
                      {moveOut.length > 0 ? (
                        <div className="compare-thumbs">
                          {moveOut.map((p) => (
                            <img key={p.id} src={p.url} alt={`${g.zone} 퇴실 사진`} />
                          ))}
                        </div>
                      ) : (
                        <span className="compare-wait">퇴실 사진을 추가하면 여기에 보여요</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="card" ref={previewRef}>
        <h2>기록북</h2>
        <p className="muted small">구역별 사진·메모·서버 기록을 한 문서로 모아 보고 PDF로 저장할 수 있어요.</p>
        <div className="book-actions">
          <button type="button" className="btn primary" onClick={openPreview}>
            기록북 미리보기
          </button>
        </div>
        {showPreview &&
          (photos.length === 0 ? (
            <p className="muted" role="status">사진을 먼저 추가해 주세요.</p>
          ) : (
            <>
              <div id="book-print" className="book">
                <div className="book-cover">
                  <p className="book-room">{roomTitle}</p>
                  <h2>방 상태 기록북</h2>
                  <p className="muted">생성일 {todayYMD()}</p>
                  <p className="muted small">사진 {photos.length}장 · 구역 {groups.length}곳</p>
                </div>
                {groups.map((g) => (
                  <section key={g.zone} className="book-section">
                    <h3>{g.zone}</h3>
                    {g.items.map((p) => {
                      const rText = receiptText(p)
                      return (
                        <div key={p.id} className="book-photo">
                          <img src={p.url} alt={`${p.zone} ${p.phase} 사진`} />
                          <div className="book-meta">
                            <p><b>단계</b> {p.phase}</p>
                            <p>
                              <b>날짜</b> {p.date ?? '날짜 없음'} ({DATE_LABEL[p.dateSource]})
                            </p>
                            <p><b>메모</b> {p.memo.trim() || '메모 없음'}</p>
                            <p>{rText ?? '서버 기록 없음'}</p>
                          </div>
                        </div>
                      )
                    })}
                  </section>
                ))}
                <p className="book-end">
                  이 기록북은 사용자가 남긴 사진과 메모를 정리한 것이에요. 법적 효력이나 진본을 보장하지 않아요.
                  <br />
                  {RECEIPT_NOTE}
                </p>
              </div>
              <div className="book-actions">
                <button type="button" className="btn primary" onClick={printBook}>
                  PDF로 저장
                </button>
                <span className="muted small">인쇄 창에서 'PDF로 저장'을 고르면 파일로 저장돼요.</span>
              </div>
            </>
          ))}
      </div>

      {limitOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLimitOpen(false)
          }}
        >
          <div className="modal record-modal" role="dialog" aria-modal="true" aria-labelledby="limit-title">
            <h2 id="limit-title">3장부터는 기록북 상품(4,900원)이에요</h2>
            <p className="muted small">결제는 아직 연결하지 않았어요.</p>
            <div className="record-modal-actions">
              <button type="button" className="btn" onClick={() => go('pricing')}>
                가격 안내
              </button>
              <button type="button" className="btn primary" onClick={continueDemo}>
                데모로 계속
              </button>
              <button type="button" className="btn ghost" onClick={() => setLimitOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
