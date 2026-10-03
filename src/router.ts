import { useEffect, useState } from 'react'

export type Route = 'home' | 'deduct' | 'record' | 'cert' | 'pricing' | 'privacy'
const ROUTES: Route[] = ['home', 'deduct', 'record', 'cert', 'pricing', 'privacy']

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
