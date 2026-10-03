import { useEffect, useState } from 'react'

export type Route = 'home' | 'deduct' | 'record' | 'cert' | 'pricing' | 'privacy' | 'event' | 'help' | 'lawyer' | 'signup'
const ROUTES: Route[] = ['home', 'deduct', 'record', 'cert', 'pricing', 'privacy', 'event', 'help', 'lawyer', 'signup']

/** 화면 이름 — 문서 제목(document.title)과 화면 이동 알림에 쓴다. 각 화면의 h1 과 맞춘다. */
export const SCREEN_NAME: Record<Route, string> = {
  home: '처음',
  deduct: '공제 내역 정리',
  record: '방 상태 기록',
  cert: '내용증명 서식',
  pricing: '가격 안내',
  privacy: '개인정보 처리방침',
  event: '출시 기념 이벤트',
  help: '무료 법률상담 기관·변호사 찾기',
  lawyer: '변호사 찾아보기',
  signup: '회원가입',
}

/** 브라우저 탭 제목 — 첫 화면만 서비스 이름이 앞에 온다 */
export function documentTitle(route: Route): string {
  return route === 'home' ? '보증금 지킴이 — 공제 문자 정리' : `${SCREEN_NAME[route]} | 보증금 지킴이`
}

/** 해시 주소 — <a href> 에 그대로 쓴다 (go() 와 같은 규칙) */
export function hrefOf(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`
}

function parse(): { route: Route; query: URLSearchParams } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, qs] = raw.split('?')
  const route = (ROUTES as string[]).includes(path) ? (path as Route) : 'home'
  return { route, query: new URLSearchParams(qs ?? '') }
}

export function useRoute() {
  const [state, setState] = useState(parse)
  useEffect(() => {
    const on = () => {
      setState(parse())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return state
}

export function go(route: Route, query?: Record<string, string>) {
  const qs = query ? `?${new URLSearchParams(query).toString()}` : ''
  window.location.hash = route === 'home' ? '#/' : `#/${route}${qs}`
}
