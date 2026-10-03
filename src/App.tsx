import { StoreProvider } from './state'
import { go, useRoute } from './router'
import Home from './screens/Home'
import Deduct from './screens/Deduct'
import Record from './screens/Record'
import Cert from './screens/Cert'
import Pricing from './screens/Pricing'
import Privacy from './screens/Privacy'

function Screen() {
  const { route, query } = useRoute()
  switch (route) {
    case 'deduct':
      return <Deduct sample={query.get('sample') === '1'} />
    case 'record':
      return <Record />
    case 'cert':
      return <Cert />
    case 'pricing':
      return <Pricing />
    case 'privacy':
      return <Privacy />
    default:
      return <Home />
  }
}

export default function App() {
  return (
    <StoreProvider>
      <div className="app">
        <header className="topbar">
          <button type="button" className="brand" onClick={() => go('home')}>
            🏠 보증금 지킴이
          </button>
          <nav className="topnav">
            <button type="button" onClick={() => go('deduct')}>공제 정리</button>
            <button type="button" onClick={() => go('record')}>방 상태 기록</button>
            <button type="button" onClick={() => go('pricing')}>가격</button>
          </nav>
        </header>
        <main className="main">
          <Screen />
        </main>
        <footer className="footer">
          <p>보증금 지킴이는 공개 자료를 찾아 보여 주는 정보 제공 도구이며, 법률 판단이나 대리를 하지 않습니다.</p>
          <p>
            <button type="button" className="linklike" onClick={() => go('privacy')}>개인정보 처리방침</button>
            {' · '}
            <button type="button" className="linklike" onClick={() => go('pricing')}>가격 안내</button>
          </p>
        </footer>
      </div>
    </StoreProvider>
  )
}
