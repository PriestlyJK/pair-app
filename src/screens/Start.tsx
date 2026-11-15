import { useEffect, useState, type ReactNode } from 'react'
import { cloud, sendEvent, signOut, startSync, type Link } from '../sync'
import { useStore, NEW_PET } from '../store'
import { Img, PhotoPick, shrinkImage, Ava } from '../ui'
import type { Gender } from '../store'
import { PetView } from '../pet'
import { TODAY_KEY } from '../dates'

// ---------- Где мы открыты ----------
const ua = navigator.userAgent
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isAndroid = /Android/.test(ua)
const isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua)
export const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const devHost = import.meta.env.DEV || /^(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(location.hostname)
// В браузере (не с экрана «Домой») показываем установку. ?web — открыть как есть, для проверки на компьютере.
export const needInstall = !standalone && !devHost && !new URLSearchParams(location.search).has('web')

function Shell({ children, art = 'brand/splash' }: { children: ReactNode; art?: string }) {
  return (
    <div className="start">
      <Img src={art} className="start-art" />
      {children}
    </div>
  )
}

export function Splash() {
  return <Shell><p className="muted b">Загружаем ваше…</p></Shell>
}

// ---------- Экран установки (если открыли ссылку в браузере) ----------
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3E7BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-4px' }}>
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
    </svg>
  )
}

export function InstallGate() {
  const [prompt, setPrompt] = useState<(Event & { prompt(): void }) | null>(null)
  const [copied, setCopied] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState('')
  const hash = location.hash
  const confirmed = /type=(signup|email|magiclink|invite)/.test(hash)
  const url = location.origin + location.pathname

  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setPrompt(e as Event & { prompt(): void }) }
    window.addEventListener('beforeinstallprompt', on)
    const sub = cloud?.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') setRecovery(true) })
    if (/type=recovery/.test(hash)) setRecovery(true)
    return () => { window.removeEventListener('beforeinstallprompt', on); sub?.data.subscription.unsubscribe() }
  }, [hash])

  if (recovery)
    return (
      <Shell>
        <h1>Новый пароль</h1>
        {msg ? <p className="b">{msg}</p> : (
          <>
            <input className="input" type="password" autoComplete="new-password" placeholder="Новый пароль, от 6 символов" value={pw} onChange={e => setPw(e.target.value)} />
            <button className="btn wide" onClick={async () => {
              if (pw.length < 6) { setMsg(''); return }
              const { error } = await cloud!.auth.updateUser({ password: pw })
              setMsg(error ? 'Не получилось, попробуй запросить письмо ещё раз' : 'Пароль изменён. Открой приложение «Мы» с экрана «Домой» и войди.')
            }}>Сохранить</button>
          </>
        )}
      </Shell>
    )

  return (
    <Shell>
      {confirmed ? (
        <>
          <h1>Почта подтверждена</h1>
          <p className="muted b">Вернись в приложение «Мы» на экране «Домой» и войди. Если его ещё нет — поставь по шагам ниже.</p>
        </>
      ) : (
        <>
          <h1>Мы</h1>
          <p className="muted b">Приложение для двоих на расстоянии. Оно ставится на экран «Домой» и работает как обычное приложение: на весь экран и без браузера.</p>
        </>
      )}
      {isIOS ? (
        isIOSSafari ? (
          <ol className="steps">
            <li>Нажми <ShareIcon /> «Поделиться» внизу Safari</li>
            <li>Пролистай и выбери <b>«На экран „Домой“»</b></li>
            <li>Нажми <b>«Добавить»</b> и открой «Мы» с иконки</li>
          </ol>
        ) : (
          <>
            <p className="b">Открой эту ссылку в Safari — ставить приложения на айфоне умеет он.</p>
            <button className="btn wide" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true) }}>{copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}</button>
          </>
        )
      ) : isAndroid ? (
        prompt ? <button className="btn wide" onClick={() => prompt.prompt()}>Установить приложение</button> : (
          <ol className="steps">
            <li>Открой меню браузера ⋮</li>
            <li>Выбери <b>«Установить приложение»</b> или «Добавить на главный экран»</li>
          </ol>
        )
      ) : (
        <>
          <p className="b">Открой эту ссылку на телефоне:</p>
          <div className="linkbox">{url}</div>
          <button className="btn wide soft" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true) }}>{copied ? 'Скопировано' : 'Скопировать'}</button>
          {prompt && <button className="btn wide" onClick={() => prompt.prompt()}>Установить на компьютер</button>}
        </>
      )}
    </Shell>
  )
}

// ---------- Вход и регистрация ----------
const ERR: [RegExp, string][] = [
  [/invalid login/i, 'Неверная почта или пароль'],
  [/already registered|already exists/i, 'Эта почта уже зарегистрирована — войди'],
  [/at least 6|password.*short|weak/i, 'Пароль слишком короткий: нужно от 6 символов'],
  [/email.*invalid|invalid.*email|valid email/i, 'Проверь адрес почты'],
  [/not confirmed/i, 'Почта ещё не подтверждена: открой ссылку из письма'],
  [/rate limit|too many/i, 'Слишком много попыток, подожди пару минут'],
  [/fetch|network/i, 'Нет связи с интернетом'],
]
const ru = (m: string) => ERR.find(([r]) => r.test(m))?.[1] ?? m

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('up')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState('')
  const appUrl = location.origin + location.pathname

  async function submit() {
    setErr('')
    if (!email.includes('@')) { setErr('Проверь адрес почты'); return }
    if (pw.length < 6) { setErr('Пароль: от 6 символов'); return }
    setBusy(true)
    const r = mode === 'up'
      ? await cloud!.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: appUrl } })
      : await cloud!.auth.signInWithPassword({ email: email.trim(), password: pw })
    setBusy(false)
    if (r.error) { setErr(ru(r.error.message)); return }
    if (mode === 'up' && !r.data.session) setSent(email.trim())
  }
  async function forgot() {
    if (!email.includes('@')) { setErr('Впиши почту, и пришлём ссылку для нового пароля'); return }
    const { error } = await cloud!.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl })
    setErr(error ? ru(error.message) : 'Письмо со ссылкой отправлено. Открой его на этом телефоне.')
  }

  if (sent)
    return (
      <Shell art="common/envelope">
        <h1>Проверь почту</h1>
        <p className="muted b">Отправили письмо на {sent}. Открой ссылку в нём, потом вернись сюда и войди с тем же паролем.</p>
        <button className="btn wide" onClick={() => { setSent(''); setMode('in') }}>Почта подтверждена, войти</button>
      </Shell>
    )

  return (
    <Shell art="onboarding/ob_welcome">
      <h1>Мы</h1>
      <p className="muted b">Общий кот, задачи, календарь и фото дня — для двоих, когда вы далеко.</p>
      <div className="seg">
        <button className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Регистрация</button>
        <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Вход</button>
      </div>
      <input className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="Почта" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} placeholder={mode === 'up' ? 'Придумай пароль, от 6 символов' : 'Пароль'} value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      {err && <p className="err">{err}</p>}
      <button className="btn wide" disabled={busy} onClick={submit}>{busy ? '…' : mode === 'up' ? 'Создать аккаунт' : 'Войти'}</button>
      {mode === 'in' && <button className="linkish" onClick={forgot}>Забыли пароль?</button>}
    </Shell>
  )
}

// ---------- Пара по коду ----------
export function PairScreen({ user, onDone }: { user: { id: string; email: string }; onDone: (l: Link) => void }) {
  const [mode, setMode] = useState<'choose' | 'join' | 'created'>('choose')
  const [code, setCode] = useState('')
  const [link, setLink] = useState<Link | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true); setErr('')
    const { data, error } = await cloud!.rpc('create_couple')
    setBusy(false)
    if (error) { setErr(ru(error.message)); return }
    const d = data as { couple_id: string; slot: 'a'; code: string }
    const l: Link = { user: user.id, email: user.email, couple: d.couple_id, slot: 'a', code: d.code }
    // Если до регистрации уже пользовались приложением на этом телефоне — забираем эти данные в облако
    await startSync(l, { uploadLocal: true })
    setLink(l); setMode('created')
  }
  async function join() {
    const c = code.trim().toUpperCase()
    if (c.length !== 6) { setErr('Код из 6 символов'); return }
    setBusy(true); setErr('')
    const { data, error } = await cloud!.rpc('join_couple', { p_code: c })
    setBusy(false)
    if (error) { setErr(/not found/.test(error.message) ? 'Такого кода нет. Проверь буквы' : /full/.test(error.message) ? 'В этой паре уже двое' : ru(error.message)); return }
    const d = data as { couple_id: string; slot: 'b' }
    const l: Link = { user: user.id, email: user.email, couple: d.couple_id, slot: 'b', code: c }
    await startSync(l)
    sendEvent('joined')
    onDone(l)
  }

  if (mode === 'created' && link)
    return (
      <Shell art="onboarding/ob_pair">
        <h1>Код вашей пары</h1>
        <div className="pair-code">{link.code}</div>
        <p className="muted b">Отправь код второму: нужно поставить «Мы», зарегистрироваться и ввести код — и вы в одном приложении. Код всегда есть в профиле.</p>
        <button className="btn wide peach" onClick={() => navigator.share?.({ text: `Присоединяйся ко мне в «Мы»: ${location.origin + location.pathname}\nКод пары: ${link.code}` }).catch(() => {})}>Отправить код</button>
        <button className="btn wide" onClick={() => onDone(link)}>Дальше</button>
      </Shell>
    )

  return (
    <Shell art="onboarding/ob_pair">
      <h1>Вы вдвоём</h1>
      {mode === 'choose' ? (
        <>
          <p className="muted b">Один создаёт пару и отправляет код, второй присоединяется по коду. Кто первый — неважно.</p>
          <button className="btn wide" disabled={busy} onClick={create}>Создать пару</button>
          <button className="btn wide soft" onClick={() => setMode('join')}>У меня есть код</button>
        </>
      ) : (
        <>
          <p className="muted b">Введи код, который тебе прислали</p>
          <input className="input code-in" maxLength={6} autoCapitalize="characters" autoComplete="off" placeholder="ABC123" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
          <button className="btn wide" disabled={busy} onClick={join}>Присоединиться</button>
          <button className="linkish" onClick={() => setMode('choose')}>назад</button>
        </>
      )}
      {err && <p className="err">{err}</p>}
      <button className="linkish" onClick={() => signOut().then(() => location.reload())}>выйти из аккаунта</button>
    </Shell>
  )
}

// ---------- Первый запуск: имена, дата, котёнок ----------
function GenderSeg({ value, onChange }: { value: Gender; onChange: (g: Gender) => void }) {
  return (
    <div className="seg mini">
      <button className={value === 'f' ? 'on' : ''} onClick={() => onChange('f')}>она</button>
      <button className={value === 'm' ? 'on' : ''} onClick={() => onChange('m')}>он</button>
    </div>
  )
}

const PET_NAMES = ['Персик', 'Булочка', 'Мандарин', 'Тыковка', 'Бублик', 'Рыжик', 'Пончик', 'Кекс', 'Сырник', 'Апельсин', 'Ириска', 'Маффин']

export function Onboarding() {
  const s = useStore()
  // Если партнёр уже всё настроил, лишние шаги пропускаем
  const first = !s.pet.name
  const [myG, setMyG] = useState<Gender>(s.profile.me.g ?? 'f')
  const [hisG, setHisG] = useState<Gender>(s.profile.him.g ?? (myG === 'f' ? 'm' : 'f'))
  // Цикл спрашиваем у девушки и только если его ещё никто не ведёт
  const askCycle = myG === 'f' && !(s.settings.cycleBy && s.settings.cycle && !first)
  const steps = ['names', ...(first || !s.settings.since ? ['since'] : []), ...(first ? ['pet'] : []), ...(askCycle ? ['cycle'] : []), 'ready']
  const [i, setI] = useState(0)
  const step = steps[i]
  const next = () => setI(n => Math.min(steps.length - 1, n + 1))
  const [me, setMe] = useState(s.profile.me.name)
  const [him, setHim] = useState(s.profile.him.name)
  const [since, setSince] = useState(s.settings.since)
  const [base, setBase] = useState(s.settings.meetBase ? String(s.settings.meetBase) : '')
  const [pet, setPet] = useState(s.pet.name)

  function finish() {
    s.setProfile(p => ({ ...p, me: { ...p.me, name: me.trim(), ready: true }, him: { ...p.him, name: p.him.name || him.trim() } }))
    if (first) {
      s.setPet({ ...NEW_PET, name: pet.trim() || 'Персик' })
      s.own('bed')
    }
    s.gift(30, 'Стартовые 30 монет', 'coins/coin_pile')
  }

  return (
    <div className="start">
      <div className="dots-step">{steps.map((x, j) => <i key={x} className={j <= i ? 'on' : ''} />)}</div>
      {step === 'names' && (
        <>
          <Img src="onboarding/ob_pair" className="start-art" />
          <h1>Как вас зовут?</h1>
          <div className="row" style={{ gap: 12, width: '100%' }}>
            <PhotoPick className="ava-pick" onPick={async f => { try { const photo = await shrinkImage(f, 256, true); s.setProfile(p => ({ ...p, me: { ...p.me, photo } })) } catch { /* не открылось */ } }}>
              <Ava who="me" size={64} />
              <small>фото</small>
            </PhotoPick>
            <input className="input grow" placeholder="Твоё имя" maxLength={20} value={me} onChange={e => setMe(e.target.value)} />
          </div>
          <div className="row" style={{ width: '100%' }}>
            <span className="grow b" style={{ textAlign: 'left' }}>Я</span>
            <GenderSeg value={myG} onChange={v => { setMyG(v); if (!s.profile.him.g) setHisG(v === 'f' ? 'm' : 'f') }} />
          </div>
          {!s.profile.him.name && <input className="input" placeholder={hisG === 'f' ? 'Как подписывать её' : 'Как подписывать его'} maxLength={20} value={him} onChange={e => setHim(e.target.value)} />}
          {!s.profile.him.g && (
            <div className="row" style={{ width: '100%' }}>
              <span className="grow b" style={{ textAlign: 'left' }}>{him.trim() || 'Вторая половинка'}</span>
              <GenderSeg value={hisG} onChange={setHisG} />
            </div>
          )}
          <p className="small muted b">Чтобы приложение писало «он» или «она» и «сделал» или «сделала».</p>
          <button className="btn wide" disabled={!me.trim()} onClick={() => {
            s.setProfile(p => ({ ...p, me: { ...p.me, name: me.trim(), g: myG }, him: { ...p.him, name: p.him.name || him.trim(), g: p.him.g ?? hisG } }))
            next()
          }}>Дальше</button>
        </>
      )}
      {step === 'since' && (
        <>
          <Img src="memory/days_together" className="start-art" />
          <h1>С какого дня вы вместе?</h1>
          <p className="muted b">Будем считать дни, годовщины и круглые даты.</p>
          <input className="input" type="date" max={TODAY_KEY} value={since} onChange={e => setSince(e.target.value)} />
          <input className="input" inputMode="numeric" placeholder="Сколько встреч уже было (примерно)" value={base} onChange={e => setBase(e.target.value.replace(/\D/g, ''))} />
          <button className="btn wide" onClick={() => { s.setSettings(x => ({ ...x, since, meetBase: Number(base) || 0 })); next() }}>{since ? 'Дальше' : 'Пропустить'}</button>
        </>
      )}
      {step === 'pet' && (
        <>
          <div className="start-pet"><PetView pose="happy" breed={NEW_PET.breed} stage="baby" acc={null} className="breathe" /></div>
          <h1>Это ваш котёнок</h1>
          <p className="muted b">Он растёт от ваших дел: монеты за задачи, фото и встречи — это его еда и опыт.</p>
          <div className="row" style={{ gap: 8, width: '100%' }}>
            <input className="input grow" placeholder="Как назовёте?" maxLength={16} value={pet} onChange={e => setPet(e.target.value)} />
            <button className="btn soft dice-btn" aria-label="Случайное имя" onClick={() => setPet(PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)])}><Img src="common/dice_d20" /></button>
          </div>
          <button className="btn wide" disabled={!pet.trim()} onClick={next}>Дальше</button>
        </>
      )}
      {step === 'cycle' && (
        <>
          <Img src="cycle/phase_follicular" className="start-art" />
          <h1>Вести календарь цикла?</h1>
          <p className="muted b">Отмечаешь только дни месячных — приложение само посчитает фазы и подскажет {hisG === 'f' ? 'ей' : 'ему'}, когда нужна забота. {hisG === 'f' ? 'Она' : 'Он'} видит фазы, без симптомов.</p>
          <button className="btn wide" onClick={() => { s.setSettings(x => ({ ...x, cycle: true, cycleBy: 'me' })); next() }}>Да, вести</button>
          <button className="btn wide soft" onClick={() => { s.setSettings(x => ({ ...x, cycle: false })); next() }}>Нет, не нужно</button>
          <p className="small muted b">Можно поменять в профиле.</p>
        </>
      )}
      {step === 'ready' && (
        <>
          <Img src="onboarding/ob_ready" className="start-art" />
          <h1>Всё готово</h1>
          <p className="muted b">{first ? 'Для начала: лежанка для котёнка и 30 монет.' : '30 монет для начала.'} Дальше — задачи на неделю, фото дня и встречи.</p>
          <button className="btn wide" onClick={finish}>Начать</button>
        </>
      )}
      {i > 0 && step !== 'ready' && <button className="linkish" onClick={() => setI(n => n - 1)}>назад</button>}
    </div>
  )
}
