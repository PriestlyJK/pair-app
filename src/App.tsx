import { StoreProvider, useStore, type Tab } from './store'
import { Img } from './ui'
import Home from './screens/Home'
import Board from './screens/Board'
import Calendar from './screens/Calendar'
import Together from './screens/Together'
import Cheatsheet from './screens/Cheatsheet'
import Shop from './screens/Shop'

const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'home', name: 'Дом', icon: 'nav/home' },
  { id: 'board', name: 'Доска', icon: 'nav/board' },
  { id: 'calendar', name: 'Календарь', icon: 'nav/calendar' },
  { id: 'together', name: 'Вместе', icon: 'nav/together' },
  { id: 'cheatsheet', name: 'Шпаргалка', icon: 'nav/cheatsheet' },
]

function Shell() {
  const { tab, go, shop } = useStore()
  return (
    <>
      <main className="app" key={tab}>
        {tab === 'home' && <Home />}
        {tab === 'board' && <Board />}
        {tab === 'calendar' && <Calendar />}
        {tab === 'together' && <Together />}
        {tab === 'cheatsheet' && <Cheatsheet />}
      </main>
      <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={'tab' + (t.id === tab ? ' on' : '')} onClick={() => go(t.id)}>
            <Img src={t.icon} />
            {t.name}
          </button>
        ))}
      </nav>
      {shop && <Shop />}
    </>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
