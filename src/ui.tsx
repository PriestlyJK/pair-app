import { useEffect, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { A, type Assignee } from './data'
import { useStore } from './store'
import { isPartnerHere, onPresence } from './sync'
import { crowned, gameOn } from './game'

export function Img({ src, size, className, style }: { src: string; size?: number; className?: string; style?: CSSProperties }) {
  return <img src={A(src)} alt="" draggable={false} className={className} style={{ width: size, height: size, ...style }} />
}

export function Coin({ n, size = 18, className = '' }: { n: number | string; size?: number; className?: string }) {
  return (
    <span className={'coin ' + className}>
      <Img src="coins/coin" size={size} />
      <b>{n}</b>
    </span>
  )
}

export function Bar({ value, max = 100, color = 'var(--apricot)', thin }: { value: number; max?: number; color?: string; thin?: boolean }) {
  return (
    <div className={'bar' + (thin ? ' thin' : '')}>
      <i style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%`, background: color }} />
    </div>
  )
}

// online — зелёная точка «в сети» (для партнёра, пока у него открыто приложение)
/* Корона недели. Пока нет картинки в стиле приложения (hobby/ui/crown) — рисуем векторную. */
export function Crown({ className = '' }: { className?: string }) {
  return <img className={'game-crown ' + className} src={A('game/crown')} alt="" draggable={false} />
}

export function Ava({ who, size = 24, online }: { who: Assignee; size?: number; online?: boolean }) {
  const { profile, game } = useStore()
  if (who === 'both')
    return (
      <span className="ava-pair">
        <Ava who="me" size={size} />
        <Ava who="him" size={size} online={online} />
      </span>
    )
  const p = profile[who]
  const name = p.name.trim()
  const letter = name ? name[0].toUpperCase() : who === 'me' ? 'Я' : p.g === 'f' ? 'Она' : 'Он'
  return (
    <span className={'ava ava-' + who + (p.photo ? ' photo' : '')} style={{ width: size, height: size, fontSize: size * (letter.length > 2 ? 0.32 : 0.42), backgroundImage: p.photo ? `url(${p.photo})` : undefined }}>
      {!p.photo && letter}
      {online && <i className="online-dot" aria-label="в сети" />}
      {size >= 32 && gameOn() && crowned(game).includes(who) && <i className="ava-crown" aria-label="корона недели"><Crown /></i>}
    </span>
  )
}

// Имя для подписи: своё, если задано, иначе «Я» / «Он» / «Она»
export function useName() {
  const { profile } = useStore()
  return (who: 'me' | 'him') => profile[who].name.trim() || (who === 'me' ? 'Я' : profile.him.g === 'f' ? 'Она' : 'Он')
}

/* Род в текстах. Приложением пользуются оба, у каждого «я» и «партнёр» свои,
   поэтому «он/она», «сделал/сделала» берём из профилей (по умолчанию: я — она, партнёр — он).
   g.p('сделал', 'сделала') — про партнёра, g.m('рад', 'рада') — про меня. */
export function useG() {
  const { profile } = useStore()
  const mine = profile.me.g ?? 'f', his = profile.him.g ?? 'm'
  const m = (male: string, female: string) => (mine === 'm' ? male : female)
  const p = (male: string, female: string) => (his === 'm' ? male : female)
  return {
    m, p,
    he: p('он', 'она'), He: p('Он', 'Она'),
    his: p('его', 'её'), His: p('Его', 'Её'),
    to: p('ему', 'ей'), // дать ему / ей
    about: p('о нём', 'о ней'), About: p('О нём', 'О ней'),
    for: p('для него', 'для неё'), from: p('от него', 'от неё'),
    named: !!profile.him.name.trim(),
  }
}

// Уменьшает фото с телефона: квадрат для аватарки или до max по длинной стороне. Возвращает JPEG data URL.
export async function shrinkImage(file: File, max: number, square = false, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const w = img.naturalWidth, h = img.naturalHeight
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')!
    if (square) {
      const s = Math.min(w, h)
      c.width = c.height = Math.min(max, s)
      ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, c.width, c.height)
    } else {
      const k = Math.min(1, max / Math.max(w, h))
      c.width = Math.round(w * k); c.height = Math.round(h * k)
      ctx.drawImage(img, 0, 0, c.width, c.height)
    }
    return c.toDataURL('image/jpeg', quality)
  } finally { URL.revokeObjectURL(url) }
}

/* Пока открыта камера или галерея, айфон считает приложение свёрнутым. В это время нельзя
   перезагружаться под новую версию — иначе снимок с камеры теряется. После выбора даём ещё
   полминуты, чтобы фото успело уйти в облако. */
let pickingUntil = 0
export const isPicking = () => Date.now() < pickingUntil

// Кнопка выбора фото: на iPhone открывает галерею или камеру
export function PhotoPick({ onPick, children, className = 'btn sm soft' }: { onPick: (f: File) => void; children: ReactNode; className?: string }) {
  return (
    <label className={className} style={{ cursor: 'pointer' }} onClick={() => { pickingUntil = Date.now() + 10 * 60_000 }}>
      {children}
      <input type="file" accept="image/*" hidden
        onChange={e => { pickingUntil = Date.now() + 30_000; const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }}
        ref={el => { if (el) el.oncancel = () => { pickingUntil = 0 } }} />
    </label>
  )
}

export function Sheet({ open, onClose, title, icon, children, tall }: { open: boolean; onClose: () => void; title?: ReactNode; icon?: string; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])
  if (!open) return null
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className={'sheet' + (tall ? ' tall' : '')} onClick={e => e.stopPropagation()}>
        <div className="grip" />
        {title && (
          <div className="sheet-head">
            {icon && <Img src={icon} size={44} />}
            <h3>{title}</h3>
            <button className="x" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Header({ title, sub, icon, right, onBack }: { title: ReactNode; sub?: ReactNode; icon?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <header className="hdr">
      {onBack && <button className="back" onClick={onBack} aria-label="Назад">‹</button>}
      {icon && <Img src={icon} size={44} />}
      <div className="hdr-t">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </header>
  )
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; name: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.id} className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.name}</button>
      ))}
    </div>
  )
}

export const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b > 1 && b < 5) return few
  if (b === 1) return one
  return many
}

export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

// Партнёр сейчас в приложении
export function usePartnerHere() {
  return useSyncExternalStore(onPresence, isPartnerHere)
}
