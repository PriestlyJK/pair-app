import { useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { StoreProvider, useStore, type Tab } from './store'
import { Img } from './ui'
import { cloud, forgetLink, getLink, onEvent, resolveLink, startSync, type Link } from './sync'
import { AuthScreen, PairScreen, InstallGate, Onboarding, Splash, needInstall } from './screens/Start'
import Home from './screens/Home'
import Board from './screens/Board'
import Calendar from './screens/Calendar'
import Together from './screens/Together'
import Cheatsheet from './screens/Cheatsheet'
import Shop from './screens/Shop'
import { HobbyInbox } from './screens/Hobby'
import { HOBBY_ON } from './hobby'

const TABS: { id: Tab; name: string; icon: string }[] = [
  { id: 'home', name: 'Дом', icon: 'nav/home' },
  { id: 'board', name: 'Доска', icon: 'nav/board' },
  { id: 'calendar', name: 'Календарь', icon: 'nav/calendar' },
  { id: 'together', name: 'Вместе', icon: 'nav/together' },
  { id: 'cheatsheet', name: 'Шпаргалка', icon: 'nav/cheatsheet' },
]

function Shell() {
  const { tab, sub, go, shop, profile } = useStore()
  if (!profile.me.ready) return <Onboarding />
  // Хобби — отдельный режим на весь экран, без нижнего меню
  const full = HOBBY_ON && tab === 'home' && sub === 'hobby'
  return (
    <>
      <main className={'app' + (full ? ' full' : '')} key={tab}>
        {tab === 'home' && <Home />}
        {tab === 'board' && <Board />}
        {tab === 'calendar' && <Calendar />}
        {tab === 'together' && <Together />}
        {tab === 'cheatsheet' && <Cheatsheet />}
      </main>
      {!full && <nav className="tabbar">
        {TABS.map(t => (
          <button key={t.id} className={'tab' + (t.id === tab ? ' on' : '')} onClick={() => go(t.id)}>
            <Img src={t.icon} />
            {t.name}
          </button>
        ))}
      </nav>}
      {shop && <Shop />}
      {HOBBY_ON && <HobbyInbox />}
    </>
  )
}

type Phase = 'boot' | 'auth' | 'pair' | 'offline' | 'ready'
type User = { id: string; email: string }

// Вход, сохранённый на телефоне (Supabase держит его под 'pair.auth'): id пользователя или null
function storedUser(): string | null {
  try {
    const j = JSON.parse(localStorage.getItem('pair.auth') ?? 'null')
    return j?.refresh_token ? (j.user?.id ?? '?') : null
  } catch { return null }
}

// Вход → пара → (первый запуск) → приложение. Без облака сразу приложение, всё хранится на телефоне.
function Gate() {
  const [phase, setPhase] = useState<Phase>(cloud ? 'boot' : 'ready')
  const [user, setUser] = useState<User | null>(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  async function decide(session: Session | null) {
    if (!session) {
      /* Пропуск входа живёт час. Если приложение открыли позже, а сеть ещё не проснулась,
         Supabase не может его обновить и говорит «сессии нет», хотя вход сохранён.
         Тогда не выкидываем на экран входа: открываем приложение из копии на телефоне
         и обновляем вход, когда появится сеть. На вход — только если вход правда отозван. */
      const su = storedUser(), cached = getLink()
      if (su && cached && (su === '?' || su === cached.user)) {
        startSync(cached)
        setPhase('ready')
        keepTrying()
        return
      }
      setPhase('auth')
      return
    }
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

  // Повторяем обновление входа при появлении сети и возвращении в приложение
  function keepTrying() {
    const tryNow = async () => {
      const { data, error } = await cloud!.auth.refreshSession()
      if (!error) {
        off()
        const u = data.session?.user
        if (u) setUser({ id: u.id, email: u.email ?? '' })
        return
      }
      // Вход отозван (сменили пароль, вышли на другом телефоне) — тогда уже просим войти
      if (!/fetch|network|timeout|Failed|retry/i.test(error.message) && !storedUser()) { off(); setPhase('auth') }
    }
    const onVis = () => { if (document.visibilityState === 'visible') tryNow() }
    const off = () => { window.removeEventListener('online', tryNow); document.removeEventListener('visibilitychange', onVis); clearInterval(t) }
    window.addEventListener('online', tryNow)
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(tryNow, 20000)
    setTimeout(tryNow, 1500)
  }

  useEffect(() => {
    if (!cloud) return
    const { data } = cloud.auth.onAuthStateChange((ev, session) => {
      // Внутри обработчика нельзя ждать запросы к Supabase — откладываем
      if (ev === 'INITIAL_SESSION') setTimeout(() => decide(session))
      else if (ev === 'SIGNED_IN' && (phaseRef.current === 'auth' || phaseRef.current === 'boot')) setTimeout(() => decide(session))
      // Выход — только если вход действительно стёрт с телефона
      else if (ev === 'SIGNED_OUT' && !storedUser()) setPhase('auth')
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Нас отвязали от пары (партнёр нажал «Отвязать») — на экран пары, вход при этом остаётся
  useEffect(() => {
    if (phase !== 'ready' || !user || !cloud) return
    let busy = false
    const check = async () => {
      if (busy) return
      busy = true
      const r = await resolveLink(user.id, user.email)
      busy = false
      if (r === null) { forgetLink(); setPhase('pair') }
    }
    check()
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    const off = onEvent(e => { if (e.kind === 'unlinked' && !e.mine) setTimeout(check, 2500) })
    return () => { document.removeEventListener('visibilitychange', onVis); off() }
  }, [phase, user])

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
