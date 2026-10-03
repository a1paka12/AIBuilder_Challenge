// JPEG EXIF에서 DateTimeOriginal(0x9003)만 직접 읽는다. 라이브러리 없이, 실패하면 null.

const EXIF_IFD_POINTER = 0x8769
const DATE_TIME_ORIGINAL = 0x9003
const READ_BYTES = 256 * 1024

/** "YYYY-MM-DD HH:mm" 또는 null */
export async function readExifDate(file: Blob): Promise<string | null> {
  try {
    const buf = await file.slice(0, READ_BYTES).arrayBuffer()
    const v = new DataView(buf)
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null // JPEG 아님
    let off = 2
    while (off + 4 <= v.byteLength) {
      if (v.getUint8(off) !== 0xff) return null
      const marker = v.getUint8(off + 1)
      if (marker === 0xff) {
        off += 1
        continue
      }
      if (marker === 0xda || marker === 0xd9) return null // 영상 데이터 시작/끝
      if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        off += 2
        continue
      }
      const len = v.getUint16(off + 2)
      if (len < 2) return null
      const segEnd = Math.min(v.byteLength, off + 2 + len)
      // APP1 + "Exif\0\0"
      if (marker === 0xe1 && off + 10 <= segEnd && v.getUint32(off + 4) === 0x45786966 && v.getUint16(off + 8) === 0) {
        const found = parseTiff(v, off + 10, segEnd)
        if (found) return found
      }
      off += 2 + len
    }
  } catch {
    // 파싱 실패는 무시
  }
  return null
}

function parseTiff(v: DataView, start: number, end: number): string | null {
  if (start + 8 > end) return null
  const bo = v.getUint16(start)
  const le = bo === 0x4949 ? true : bo === 0x4d4d ? false : null
  if (le === null) return null
  const u16 = (o: number) => v.getUint16(o, le)
  const u32 = (o: number) => v.getUint32(o, le)
  if (u16(start + 2) !== 42) return null

  const findEntry = (ifd: number, tag: number): number | null => {
    if (ifd + 2 > end) return null
    const count = u16(ifd)
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12
      if (entry + 12 > end) return null
      if (u16(entry) === tag) return entry
    }
    return null
  }

  const ifd0 = start + u32(start + 4)
  const ptrEntry = findEntry(ifd0, EXIF_IFD_POINTER)
  if (ptrEntry === null) return null
  const exifIfd = start + u32(ptrEntry + 8)
  const dtEntry = findEntry(exifIfd, DATE_TIME_ORIGINAL)
  if (dtEntry === null) return null
  if (u16(dtEntry + 2) !== 2) return null // ASCII
  const n = u32(dtEntry + 4)
  if (n < 16 || n > 64) return null
  const valueOff = n <= 4 ? dtEntry + 8 : start + u32(dtEntry + 8)
  if (valueOff + n > end) return null
  let s = ''
  for (let i = 0; i < n; i++) {
    const c = v.getUint8(valueOff + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})/.exec(s.trim())
  if (!m) return null
  const [, y, mo, d, h, mi] = m
  if (y === '0000' || mo === '00' || d === '00') return null
  return `${y}-${mo}-${d} ${h}:${mi}`
}
