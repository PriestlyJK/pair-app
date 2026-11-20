import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { getLink } from '../sync'
import { A } from '../data'
import { addDays, diffDays } from '../dates'
import { Ava, Crown, Img, Sheet, plural, useG, useName } from '../ui'
import {
  PRIZES, prizeOf, rollPrize, sectorHalf, sectorMid, spinsLeft, today, thisWeek, lastWeek, earnedIn, crowned, gameOn, wheel,
  CROWN_BONUS, GIFT_COINS, MAX_SPINS, type PrizeId,
} from '../game'

// Колесо — картинка. Иконки призов и подписи кладём поверх, по центрам нарисованных секторов, и крутим вместе с ней.
function WheelDisc() {
  return (
    <>
      <img className="wheel-disc" src={A('game/wheel')} alt="" draggable={false} />
      <svg viewBox="-100 -100 200 200" className="wheel-svg" aria-hidden="true">
        {PRIZES.map((p, i) => (
          <g key={p.id} transform={`rotate(${sectorMid(i)})`}>
            <text y="-67" textAnchor="middle" className="wheel-lbl">{p.label}</text>
            <image href={A(p.icon)} x="-15" y="-62" width="30" height="30" />
          </g>
        ))}
      </svg>
    </>
  )
}

// Конфетти: вспышка поверх колеса при крупном призе
const BIG: PrizeId[] = ['c100', 'coupon']

export function WheelSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [rot, setRot] = useState(0)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<PrizeId | null>(null)
  const timer = useRef(0)
  const claim = useRef(s.claimSpin)
  claim.current = s.claimSpin
  const me = s.game.me ?? {}
  const left = spinsLeft(me)
  const paired = !!getLink()

  // Ушли с главной посреди прокрутки — приз выдаём сразу
  useEffect(() => () => {
    if (!timer.current) return
    clearTimeout(timer.current); timer.current = 0; wheel.spinning = false; claim.current()
  }, [])
  useEffect(() => { if (!open && !busy) setRes(null) }, [open, busy])

  function spin() {
    if (busy || left < 1) return
    if (me.spin) claim.current() // вдруг висит невыданный приз
    const prize = rollPrize(), i = PRIZES.findIndex(p => p.id === prize), id = Date.now()
    // Останавливаемся внутри сектора, но не у самой границы
    const jitter = (Math.random() * 2 - 1) * (sectorHalf(i) - 8)
    s.setGame(gm => { const r = gm.me ?? {}; return { ...gm, me: { ...r, at: today(), left: spinsLeft(r) - 1, spin: { id, prize } } } })
    const want = (((-(sectorMid(i) + jitter)) % 360) + 360) % 360
    setRot(r => r - (((r % 360) + 360) % 360) + 360 * 6 + want)
    setRes(null); setBusy(true); wheel.spinning = true
    timer.current = window.setTimeout(() => {
      timer.current = 0; wheel.spinning = false
      setBusy(false); setRes(prize); claim.current()
    }, 4600)
  }

  const P = res ? prizeOf(res) : null
  const text: Record<PrizeId, [string, string]> = {
    c5: ['+5 монет', 'Уже в кошельке'],
    c10: ['+10 монет', 'Уже в кошельке'],
    c25: ['+25 монет', 'Уже в кошельке'],
    c100: ['Джекпот! +100 монет', 'Такое выпадает редко'],
    feed: ['Бесплатная еда', `Следующее кормление ${s.pet.name || 'питомца'} — без монет`],
    luck: ['Удача ×2', 'Следующая закрытая задача принесёт вдвое больше монет'],
    gift: ['Подарок', paired ? `${name('him')} получит +${GIFT_COINS} монет, когда откроет приложение` : `Пока вы не в паре — +${GIFT_COINS} монет тебе`],
    coupon: ['Купон даром', `Любой малый или средний купон ${g.from} — бесплатно`],
  }
  const stash = [
    me.feed ? { icon: prizeOf('feed').icon, t: `еда ×${me.feed}` } : null,
    me.coupon ? { icon: prizeOf('coupon').icon, t: `купон ×${me.coupon}` } : null,
    me.luck ? { icon: prizeOf('luck').icon, t: `удача ×${me.luck}` } : null,
  ].filter(Boolean) as { icon: string; t: string }[]

  return (
    <Sheet open={open} onClose={onClose} title="Колесо дня" icon="game/wheel_icon">
      <div className="wheel-box">
        <i className="wheel-shadow" />
        <div className="wheel-rot" style={{ transform: `rotate(${rot}deg)` }}><WheelDisc /></div>
        <img className="wheel-pin" src={A('game/wheel_pin')} alt="" draggable={false} />
        <button className="wheel-hub" disabled={busy || left < 1} onClick={spin}>
          <img src={A('game/wheel_hub')} alt="" draggable={false} />
          <span>{busy ? '…' : left ? 'Крутить' : 'Завтра'}</span>
        </button>
        {res && BIG.includes(res) && <img className="wheel-fx" key={rot} src={A('game/confetti')} alt="" draggable={false} />}
      </div>

      {P && res ? (
        <div className="card wheel-res" key={res + rot}>
          <Img src={P.icon} />
          <div className="grow">
            <b>{text[res][0]}</b>
            <small>{text[res][1]}</small>
          </div>
          {res === 'coupon' && <button className="btn sm" onClick={() => { onClose(); s.openShop('coupons') }}>Выбрать</button>}
        </div>
      ) : (
        <p className="wheel-info">
          {left ? `Прокруток в запасе: ${left}` : 'На сегодня всё — завтра будет новая прокрутка'}
          <br /><span>Одна прокрутка в день, пропущенные копятся до {MAX_SPINS === 3 ? 'трёх' : MAX_SPINS}</span>
        </p>
      )}

      {stash.length > 0 && (
        <div className="stash">
          <small>В запасе:</small>
          {stash.map(x => <span key={x.t}><Img src={x.icon} />{x.t}</span>)}
        </div>
      )}
    </Sheet>
  )
}

function WeekSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore()
  const name = useName()
  const wk = thisWeek(), lw = lastWeek()
  const a = earnedIn(s.game.me, wk), b = earnedIn(s.game.him, wk)
  const la = earnedIn(s.game.me, lw), lb = earnedIn(s.game.him, lw)
  const cr = crowned(s.game)
  const days = diffDays(addDays(wk, 6), today())
  const share = a + b ? Math.round((a / (a + b)) * 100) : 50
  const holder = !cr.length ? null : cr.length === 2 ? 'Корону носите вы оба' : cr[0] === 'me' ? 'Корону носишь ты' : `Корону носит ${name('him')}`

  return (
    <Sheet open={open} onClose={onClose} title={<span className="row" style={{ gap: 8 }}><Crown className="title-crown" />Корона недели</span>}>
      <div className="duel">
        <div className={'duel-side' + (a > b ? ' lead' : '')}>
          <Ava who="me" size={56} />
          <b>{a}</b>
          <span>{a > b ? 'ты впереди' : name('me')}</span>
        </div>
        <span className="duel-vs">:</span>
        <div className={'duel-side' + (b > a ? ' lead' : '')}>
          <Ava who="him" size={56} />
          <b>{b}</b>
          <span>{b > a ? `${name('him')} впереди` : name('him')}</span>
        </div>
      </div>
      <div className={'duel-bar' + (a + b ? '' : ' empty')}><i style={{ width: `${share}%` }} /></div>
      <p className="wheel-info">{days > 0 ? `До итогов ${days} ${plural(days, 'день', 'дня', 'дней')}` : 'Итоги сегодня в полночь'}</p>

      <div className="card flat col" style={{ gap: 6 }}>
        <b>Как это работает</b>
        <span className="small muted b">
          Считаются монеты, заработанные с понедельника по воскресенье: задачи, фото дня, челленджи, колесо. Траты не отнимают очков.
          Кто заработал больше, всю следующую неделю носит корону на аватарке и получает +{CROWN_BONUS} монет.
        </span>
      </div>

      <p className="small muted b" style={{ margin: '0 4px' }}>
        {la || lb ? <>Прошлая неделя: ты {la} · {name('him')} {lb}. {holder}.</> : 'Прошлую неделю ещё не считали: первая корона — по итогам этой.'}
      </p>
    </Sheet>
  )
}

// Корона недели — карточка на главной
export function CrownCard() {
  const s = useStore()
  const name = useName()
  const [open, setOpen] = useState(false)
  const wk = thisWeek()
  const a = earnedIn(s.game.me, wk), b = earnedIn(s.game.him, wk)
  const days = diffDays(addDays(wk, 6), today())
  const tie = a ? 'ничья' : days > 0 ? `итоги через ${days} ${plural(days, 'день', 'дня', 'дней')}` : 'итоги сегодня в полночь'

  return (
    <>
      <button className="card crown-card" onClick={() => setOpen(true)}>
        <Crown className="cc-crown" />
        <span className="grow">
          <b>Корона недели</b>
          <small>{gameOn() ? (a === b ? tie : a > b ? 'ты впереди' : `${name('him')} впереди`) : 'заработает, когда вы будете в паре'}</small>
        </span>
        {gameOn() && <span className="gt-score"><Ava who="me" size={22} />{a}<i>:</i>{b}<Ava who="him" size={22} /></span>}
      </button>
      <WeekSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// Колесо в комнате, под переключателем времени суток. Само окно колеса рисует главная.
export function WheelButton({ onOpen }: { onOpen: () => void }) {
  const s = useStore()
  const left = spinsLeft(s.game.me)
  return (
    <button className={'wheel-btn' + (left ? ' ready' : '')} onClick={onOpen} aria-label="Колесо дня">
      <Img src="game/wheel_icon" />
      {left > 0 && <i className="dc-badge">{left}</i>}
    </button>
  )
}
