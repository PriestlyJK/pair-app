import { useState, type ReactNode } from 'react'
import { useStore, usePersist, type ShopTab } from '../store'
import { Img, Coin, Header, Bar, Sheet, useG, useName } from '../ui'
import { SHOP, type ShopItem, type Who } from '../data'
import { FitPet } from './Home'
import { sendEvent, getLink } from '../sync'
import { FREE_COUPON_MAX } from '../game'

const TABS: { id: ShopTab; name: string; icon: string }[] = [
  { id: 'food', name: 'Еда', icon: 'shop/food/treat_fish' },
  { id: 'toys', name: 'Игрушки', icon: 'shop/toys/ball' },
  { id: 'acc', name: 'Аксессуары', icon: 'shop/accessories/acc_bow' },
  { id: 'furniture', name: 'Мебель', icon: 'shop/furniture/armchair' },
  { id: 'coupons', name: 'Купоны', icon: 'shop/coupons/coupon_small' },
  { id: 'jar', name: 'Копилка', icon: 'coins/savings_jar_2' },
]
const JAR_GOAL = 4000

export default function Shop() {
  const s = useStore()
  const tab = s.shop ?? 'food'
  const [tryOn, setTryOn] = useState<ShopItem | null>(null)

  function buy(it: ShopItem) {
    if (tab === 'food') {
      if (!s.spend(it.price)) return
      s.setPet(p => ({ ...p, satiety: Math.min(100, p.satiety + (it.id === 'bowl' ? 50 : 15)), happiness: Math.min(100, p.happiness + (it.id === 'bowl' ? 0 : it.id === 'cupcake' ? 30 : 10)) }))
      s.toast(`${s.pet.name} съел: ${it.name.toLowerCase()}`, it.icon)
      return
    }
    if (s.owned.includes(it.id)) {
      if (tab === 'acc') { s.setPet(p => ({ ...p, acc: p.acc === it.id ? null : it.id })); s.toast(s.pet.acc === it.id ? 'Сняли' : 'Надели!', it.icon) }
      return
    }
    if (!s.spend(it.price)) return
    s.own(it.id)
    if (tab === 'acc') s.setPet(p => ({ ...p, acc: it.id }))
    s.toast(`Куплено: ${it.name}`, it.icon)
    setTryOn(null)
  }

  return (
    <div className="shop">
      <div className="app">
        <div className="screen">
          <Header
            title="Магазин"
            sub="Копите вместе и по отдельности"
            onBack={s.closeShop}
            right={<span className="coin-pill"><Img src="coins/coin" /> {s.coins.me}</span>}
          />
          <div className="chips">
            {TABS.map(t => (
              <button key={t.id} className={'chip' + (t.id === tab ? ' on' : '')} onClick={() => s.openShop(t.id)}>
                <Img src={t.icon} />{t.name}
              </button>
            ))}
          </div>

          {tab === 'coupons' ? <Coupons /> : tab === 'jar' ? <Jar /> : (
            <>
              {tab === 'furniture' && <p className="small muted b" style={{ margin: '0 4px' }}>Мебель сразу появляется в комнате питомца.</p>}
              {tab === 'acc' && <p className="small muted b" style={{ margin: '0 4px' }}>Нажми на вещь, чтобы примерить. Купленное надевается и снимается бесплатно.</p>}
              <div className="items">
                {SHOP[tab].map(it => {
                  const has = tab !== 'food' && s.owned.includes(it.id)
                  const wearing = tab === 'acc' && s.pet.acc === it.id
                  return (
                    <div key={it.id} className={'item' + (has ? ' owned' : '')} onClick={() => tab === 'acc' && !has && setTryOn(it)}>
                      {has && <span className="badge">{wearing ? 'надето' : 'есть'}</span>}
                      <Img src={it.icon} />
                      <b>{it.name}</b>
                      <small>{it.note ?? ''}</small>
                      <button className="btn" onClick={e => { e.stopPropagation(); buy(it) }}>
                        {has ? (tab === 'acc' ? (wearing ? 'Снять' : 'Надеть') : tab === 'toys' ? 'Уже есть' : 'В комнате') : <><Img src="coins/coin" />{it.price}</>}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <Sheet open={!!tryOn} onClose={() => setTryOn(null)} title={tryOn ? `Примерка: ${tryOn.name}` : ''} icon={tryOn?.icon}>
        {tryOn && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
              <FitPet stage={s.pet.stage} pose="happy" acc={tryOn.id} box={170} />
            </div>
            <button className="btn wide" onClick={() => buy(tryOn)}>Купить за <Coin n={tryOn.price} size={22} /></button>
          </>
        )}
      </Sheet>
    </div>
  )
}

const TIER: Record<string, string> = { small: 'Малый', medium: 'Средний', large: 'Большой' }

function CouponCard({ icon, name, size, right, used }: { icon: string; name: string; size: string; right: ReactNode; used?: boolean }) {
  return (
    <div className={'cpn ' + size + (used ? ' used' : '')}>
      <div className="cpn-art">
        <img className="cpn-ticket" src={`assets/shop/coupons/coupon_${size}.webp`} alt="" />
        <img className="cpn-ic" src={`assets/${icon}.webp`} alt="" />
      </div>
      <div className="grow">
        <span className="cpn-tier">{TIER[size]} купон</span>
        <b>{name}</b>
      </div>
      {right}
      {used && <img className="cpn-stamp" src="assets/shop/coupons/coupon_used_stamp.webp" alt="" />}
    </div>
  )
}

// Купоны создаёт каждый для другого: ты придумываешь, партнёр покупает за свои монеты, и наоборот.
interface Offer { id: number; name: string; price: number; size: string; by: Who }
const sizeOf = (p: number) => (p >= 500 ? 'large' : p >= 150 ? 'medium' : 'small')
const ICON_OF: Record<string, string> = { small: 'common/gift', medium: 'common/two_hearts', large: 'tracker/type_wish' }

function Coupons() {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [offers, setOffers] = usePersist<Offer[]>('offers', [])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState(100)
  const fromHim = offers.filter(o => o.by === 'him')
  const mine = offers.filter(o => o.by === 'me')
  const hisBought = s.allCoupons.filter(c => c.owner === 'him' && !c.used)

  // Купон даром с колеса: любой, кроме больших
  const freeLeft = s.game.me?.coupon ?? 0
  const isFree = (o: Offer) => freeLeft > 0 && o.price <= FREE_COUPON_MAX
  function buy(o: Offer) {
    const free = isFree(o)
    if (free) s.setGame(g => ({ ...g, me: { ...g.me, coupon: Math.max(0, (g.me?.coupon ?? 1) - 1) } }))
    else if (!s.spend(o.price)) { s.toast(`Не хватает монет: нужно ${o.price}`, 'coins/coin'); return }
    s.addCoupon({ id: 'offer-' + o.id, name: o.name, icon: ICON_OF[o.size], size: o.size })
    sendEvent('coupon_buy', { name: o.name })
    s.toast(free ? 'Купон твой — даром, с колеса' : 'Купон твой — предъяви, когда захочешь', ICON_OF[o.size])
  }

  return (
    <>
      <div className="row" style={{ margin: '0 4px' }}>
        <Img src="shop/coupons/inventory" size={44} />
        <div className="grow"><b>Купоны {g.from}</b><div className="small muted b">{name('him')} придумывает, ты покупаешь за свои монеты</div></div>
      </div>
      {freeLeft > 0 && (
        <div className="card row free-cpn">
          <Img src="game/wheel_icon" size={44} />
          <span className="grow small b">Купон с колеса{freeLeft > 1 ? ` ×${freeLeft}` : ''}: любой малый или средний — даром</span>
        </div>
      )}
      {fromHim.length ? (
        <div className="col" style={{ gap: 10 }}>
          {fromHim.map(o => (
            <CouponCard key={o.id} icon={ICON_OF[o.size]} name={o.name} size={o.size}
              right={<button className={'btn sm' + (isFree(o) ? ' sage' : '')} onClick={() => buy(o)}>{isFree(o) ? 'Даром' : <Coin n={o.price} />}</button>} />
          ))}
        </div>
      ) : (
        <div className="empty-col"><Img src="shop/coupons/coupon_small" />{getLink() ? `${g.He} пока не ${g.p('создал', 'создала')} купонов` : `Купоны ${g.from} появятся, когда вы будете в паре`}</div>
      )}

      {s.coupons.length > 0 && (
        <>
          <div className="sec-title">Мои купоны</div>
          <div className="col" style={{ gap: 10 }}>
            {s.coupons.map(c => (
              <CouponCard key={c.uid} icon={c.icon} name={c.name} size={c.size} used={c.used}
                right={c.used ? null : (
                  <button className="btn sm sage" onClick={() => { s.useCoupon(c.uid); sendEvent('coupon', { name: c.name }); s.toast('Купон предъявлен', c.icon) }}>Предъявить</button>
                )} />
            ))}
          </div>
        </>
      )}

      <div className="sec-title">Я предлагаю {g.to}</div>
      <div className="col" style={{ gap: 10 }}>
        {mine.map(o => (
          <CouponCard key={o.id} icon={ICON_OF[o.size]} name={o.name} size={o.size}
            right={
              <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
                <Coin n={o.price} />
                <button className="x-btn" aria-label="Убрать" onClick={() => setOffers(xs => xs.filter(x => x.id !== o.id))}>×</button>
              </div>
            } />
        ))}
        {!mine.length && <p className="small muted b" style={{ margin: '0 4px' }}>Придумай, что можешь сделать {g.for}: ужин, массаж, фильм на {g.his} выбор. {g.He} купит за свои монеты.</p>}
        {hisBought.length > 0 && (
          <p className="small b" style={{ margin: '0 4px' }}>У {g.p('него', 'неё')} есть: {hisBought.map(c => `«${c.name}»`).join(', ')}. Ждите, когда {g.he} {g.p('предъявит', 'предъявит')} 😉</p>
        )}
      </div>

      <button className="btn wide peach" onClick={() => setCreating(true)}>+ Создать купон {g.for}</button>

      <Sheet open={creating} onClose={() => setCreating(false)} title={`Купон ${g.for}`} icon="shop/coupons/coupon_medium">
        <input className="input" placeholder="Например: «Я готовлю ужин»" maxLength={50} value={title} onChange={e => setTitle(e.target.value)} />
        <div className="field"><span>Цена: от 50, чтобы копить по-настоящему</span>
          <div className="price-pick" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {[50, 100, 150, 250, 300, 500, 750, 1000].map(p => (
              <button key={p} className={p === price ? 'on' : ''} onClick={() => setPrice(p)}>{p}</button>
            ))}
          </div>
        </div>
        <p className="small muted b">Малый 50–100 · средний 150–300 · большой 500–1000</p>
        <button className="btn wide" onClick={() => {
          if (!title.trim()) return
          setOffers(xs => [...xs, { id: Date.now(), name: title.trim(), price, size: sizeOf(price), by: 'me' }])
          setCreating(false); setTitle(''); s.toast('Купон создан', ICON_OF[sizeOf(price)])
        }}>Создать</button>
      </Sheet>
    </>
  )
}

function Jar() {
  const s = useStore()
  const name = useName()
  const total = s.jar.me + s.jar.him
  const lvl = total >= JAR_GOAL ? 3 : total >= JAR_GOAL * 0.5 ? 2 : total > 0 ? 1 : 0
  return (
    <>
      <div className="card jar">
        <Img src={`coins/savings_jar_${lvl}`} />
        <h3 style={{ fontSize: 22 }}>{total} / {JAR_GOAL}</h3>
        <div style={{ width: '100%' }}><Bar value={total} max={JAR_GOAL} color="linear-gradient(90deg,#F8DE96,#E8B04A)" /></div>
        <span className="b">Общая копилка на второго питомца</span>
        <div className="row small b muted" style={{ gap: 16 }}>
          <span>Мой вклад: {s.jar.me}</span>
          <span>{name('him')}: {s.jar.him}</span>
        </div>
      </div>
      <div className="grid3">
        {[10, 50, 100].map(n => (
          <button key={n} className="btn" onClick={() => s.addToJar(n)}>+{n}</button>
        ))}
      </div>
      <div className="card row">
        <Img src="shop/coupons/second_pet" size={64} />
        <div className="grow">
          <b>Второй питомец</b>
          <div className="small muted b">Снова выбираете вслепую, кидаете кубик на имя. Живёт в той же комнате.</div>
        </div>
      </div>
    </>
  )
}
