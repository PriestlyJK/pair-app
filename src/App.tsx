import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { StoreProvider, useStore, type Tab } from './store'
import { Img } from './ui'
import { cloud, getLink, resolveLink, startSync, type Link } from './sync'
import { AuthScreen, PairScreen, InstallGate, Onboarding, Splash, needInstall } from './screens/Start'
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
  const { tab, go, shop, profile } = useStore()
  if (!profile.me.ready) return <Onboarding />
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

type Phase = 'boot' | 'auth' | 'pair' | 'offline' | 'ready'
type User = { id: string; email: string }

// Вход → пара → (первый запуск) → приложение. Без облака сразу приложение, всё хранится на телефоне.
function Gate() {
  const [phase, setPhase] = useState<Phase>(cloud ? 'boot' : 'ready')
  const [user, setUser] = useState<User | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  async function decide(session: Session | null) {
    if (!session) { setPhase('auth'); return }
    const u = { id: session.user.id, email: session.user.email ?? '' }
    setUser(u)
    const cached = getLink()
    // Уже знаем свою пару — открываемся сразу, свежие данные подтянутся сами
    if (cached && cached.user === u.id) { startSync(cached); setPhase('ready'); return }
    setPhase('boot')
    const l = await resolveLink(u.id, u.email)
    if (l === 'offline') setPhase('offline')
    else if (!l) setPhase('pair')
    else { await startSync(l); setPhase('ready') }
  }

  useEffect(() => {
    if (!cloud) return
    const { data } = cloud.auth.onAuthStateChange((ev, session) => {
      // Внутри обработчика нельзя ждать запросы к Supabase — откладываем
      if (ev === 'INITIAL_SESSION') setTimeout(() => decide(session))
      else if (ev === 'SIGNED_IN' && (phaseRef.current === 'auth' || phaseRef.current === 'boot')) setTimeout(() => decide(session))
      else if (ev === 'SIGNED_OUT') setPhase('auth')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (phase === 'boot') return <Splash />
  if (phase === 'auth') return <AuthScreen />
  if (phase === 'offline')
    return (
      <div className="start">
        <Img src="states/st_offline" className="start-art" />
        <h1>Нет связи</h1>
        <p className="muted b">Первый вход нужен с интернетом — дальше приложение работает и без него.</p>
        <button className="btn wide" onClick={() => cloud!.auth.getSession().then(({ data }) => decide(data.session))}>Попробовать ещё раз</button>
      </div>
    )
  if (phase === 'pair' && user) return <PairScreen user={user} onDone={(_: Link) => setPhase('ready')} />
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}

export default function App() {
  // Открыли ссылку в браузере (или из письма) — экран установки / подтверждения / нового пароля
  if (needInstall || /type=recovery/.test(location.hash)) return <InstallGate />
  return <Gate />
}
