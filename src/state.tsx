import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DeductionState, Item, RoomPhoto } from './types'

const initialDeduction: DeductionState = {
  rawText: '',
  items: [],
  statedTotal: null,
  source: null,
  contractor: 'unknown',
  clauseText: '',
  myName: '',
  place: '',
}

interface Store {
  deduction: DeductionState
  setDeduction: (patch: Partial<DeductionState>) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  resetDeduction: () => void
  photos: RoomPhoto[]
  setPhotos: (fn: (prev: RoomPhoto[]) => RoomPhoto[]) => void
  roomNickname: string
  setRoomNickname: (s: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [deduction, setDed] = useState<DeductionState>(initialDeduction)
  const [photos, setPhotosState] = useState<RoomPhoto[]>([])
  const [roomNickname, setRoomNickname] = useState('')

  const store = useMemo<Store>(
    () => ({
      deduction,
      setDeduction: (patch) => setDed((d) => ({ ...d, ...patch })),
      updateItem: (id, patch) =>
        setDed((d) => ({
          ...d,
          items: d.items.map((it) => {
            if (it.id !== id) return it
            const next = { ...it, ...patch }
            // 이름·금액을 고치면 확인과 선택이 풀린다
            if (('amount' in patch && patch.amount !== it.amount) || ('name' in patch && patch.name !== it.name)) {
              next.confirmed = false
              next.selected = false
            }
            if (!next.confirmed) next.selected = false
            return next
          }),
        })),
      resetDeduction: () => setDed(initialDeduction),
      photos,
      setPhotos: (fn) => setPhotosState(fn),
      roomNickname,
      setRoomNickname,
    }),
    [deduction, photos, roomNickname],
  )
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}

/** 확인·선택된 항목과 "내가 근거를 물어볼 금액" */
export function useSelection() {
  const { deduction } = useStore()
  const selected = deduction.items.filter((it) => it.selected && it.confirmed && typeof it.amount === 'number')
  const askTotal = selected.reduce((sum, it) => sum + (it.amount ?? 0), 0)
  const itemSum = deduction.items.reduce((sum, it) => sum + (typeof it.amount === 'number' ? it.amount : 0), 0)
  return { selected, askTotal, itemSum }
}
