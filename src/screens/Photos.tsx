import { useState } from 'react'
import { useStore } from '../store'
import { Img, Header, Sheet, Ava, PhotoPick, useName, plural, useG } from '../ui'
import { TODAY_KEY, human } from '../dates'
import { GRADS, themeOf, useImg, usePhotos, type DayPhoto, type PhotoDay } from '../photos'
import type { Who } from '../data'

// Сам снимок: настоящее фото из IndexedDB или градиент-заглушка из примера
export function Shot({ p, locked, className = '' }: { p?: DayPhoto; locked?: boolean; className?: string }) {
  const src = useImg(p?.ref)
  if (!p) return <div className={'shot empty ' + className}><Img src="photo/photo_empty" /></div>
  const [, n, icon] = p.ref.startsWith('grad:') ? p.ref.split(':') : []
  return (
    <div className={'shot ' + (locked ? 'locked ' : '') + className} style={n != null ? { background: GRADS[Number(n) % GRADS.length] } : undefined}>
      {src ? <img src={src} alt="" className="real" draggable={false} /> : icon ? <Img src={icon} className="demo-ic" /> : null}
      {locked && <span className="lock"><Img src="common/lock" size={30} /></span>}
    </div>
  )
}

// Карточка на главной
export function PhotoCard() {
  const g = useG()
  const s = useStore()
  const { today, streak, theme, post } = usePhotos()
  const name = useName()
  return (
    <div className="card col photo-card" style={{ gap: 4 }}>
      <button className="row" style={{ gap: 6, background: 'none', textAlign: 'left' }} onClick={() => s.go('together', 'photos')}>
        <Img src="common/camera" size={28} />
        <h3 className="grow">Фото дня</h3>
        {streak > 0 && <span className="streak"><Img src="common/flame" size={16} />{streak}</span>}
      </button>
      <button className="small muted b theme-line" onClick={() => s.go('together', 'photos')}>«{theme}»</button>
      <div className="polaroids">
        {today.me ? (
          <button className="polaroid a" onClick={() => s.go('together', 'photos')}>
            <Shot p={today.me} className="ph" />
            <small>моё</small>
          </button>
        ) : (
          <PhotoPick onPick={post} className="polaroid a">
            <Shot className="ph" />
            <small>+1 монета</small>
          </PhotoPick>
        )}
        <button className="polaroid b" onClick={() => s.go('together', 'photos')}>
          <Shot p={today.him} locked={!!today.him && !today.me} className="ph" />
          <small>{today.him ? (today.me ? (g.named ? name('him') : g.from) : 'скрыто') : 'ждём'}</small>
        </button>
      </div>
    </div>
  )
}

// Отдельный экран: тема дня, оба фото, подпись, реакция, серия и архив
export function PhotosScreen() {
  const s = useStore()
  const name = useName()
  const { photos, today, streak, theme, post, remove, caption, like } = usePhotos()
  const [open, setOpen] = useState<string | null>(null)
  const [draft, setDraft] = useState<string | null>(null)
  const days = Object.keys(photos).filter(k => k < TODAY_KEY && (photos[k].me || photos[k].him)).sort().reverse()
  const total = Object.values(photos).filter(d => d.me && d.him).length
  const hisLocked = !!today.him && !today.me
  const him = name('him')

  return (
    <div className="screen">
      <Header title="Фото дня" sub="Одно фото в день от каждого" icon="common/camera" onBack={() => s.go('together')} />

      <div className="card theme-card">
        <span className="small muted b">Тема на сегодня</span>
        <b>«{theme}»</b>
        <span className="small muted b">Тема — просто подсказка, можно снять что угодно.</span>
      </div>

      <div className="pair">
        <div className="col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6 }}><Ava who="me" size={24} /><b className="small">{name('me')}</b>{today.me && <span className="small muted b">· {today.me.at}</span>}</div>
          {today.me ? (
            <>
              <Shot p={today.me} className="big" />
              {draft === null ? (
                <button className="cap me" onClick={() => setDraft(today.me?.caption ?? '')}>{today.me.caption ? `«${today.me.caption}»` : '+ подпись'}</button>
              ) : (
                <input className="input cap-input" autoFocus maxLength={60} placeholder="Пара слов" value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { caption(draft.trim()); setDraft(null) }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
              )}
            </>
          ) : (
            <PhotoPick onPick={post} className="shot-pick">
              <Img src="photo/photo_empty" size={56} />
              <b>Выложить фото</b>
              <span className="small muted b">+1 монета{today.him ? ', +2 за пару' : ''}</span>
            </PhotoPick>
          )}
        </div>
        <div className="col" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6 }}><Ava who="him" size={24} /><b className="small">{him}</b>{today.him && !hisLocked && <span className="small muted b">· {today.him.at}</span>}</div>
          <div className="rel">
            <Shot p={today.him} locked={hisLocked} className="big" />
            {today.him && !hisLocked && (
              <button className={'like' + (today.him.liked ? ' on' : '')} onClick={() => like(TODAY_KEY)} aria-label="Нравится">
                <Img src={today.him.liked ? 'common/heart' : 'common/heart_pale'} size={26} />
              </button>
            )}
          </div>
          {today.him?.caption && !hisLocked && <span className="cap">«{today.him.caption}»</span>}
        </div>
      </div>

      {hisLocked && <p className="small b center muted">{him} уже выложил своё. Увидишь, когда выложишь своё фото.</p>}
      {!today.him && <p className="small b center muted">{him} ещё не выложил. Придёт уведомление, когда появится.</p>}

      {today.me && (
        <div className="grid2">
          <PhotoPick onPick={post} className="btn soft">Переснять</PhotoPick>
          <button className="btn soft" onClick={remove}>Убрать своё</button>
        </div>
      )}

      <div className="stats3">
        <div><b>{streak}</b><span>{plural(streak, 'день', 'дня', 'дней')} подряд</span></div>
        <div><b>{total}</b><span>{plural(total, 'пара', 'пары', 'пар')} фото</span></div>
        <div><b>{Object.values(photos).filter(d => d.him?.liked).length}</b><span>сердечек</span></div>
      </div>
      <p className="small muted b center" style={{ marginTop: -4 }}>Серия идёт, пока вы оба выкладываете фото каждый день.</p>

      <div className="sec-title">Архив</div>
      <div className="archive">
        {days.map(k => (
          <button key={k} className="arch" onClick={() => setOpen(k)}>
            <div className="arch-pair">
              <Shot p={photos[k].me} />
              <Shot p={photos[k].him} />
            </div>
            <small>{human(k)}</small>
          </button>
        ))}
      </div>
      {!days.length && <p className="small muted b center">Здесь будут ваши прошлые дни.</p>}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? human(open) : ''} icon="common/camera">
        {open && <DayView k={open} d={photos[open]} onLike={() => like(open)} />}
      </Sheet>
    </div>
  )
}

function DayView({ k, d, onLike }: { k: string; d: PhotoDay; onLike: () => void }) {
  const name = useName()
  return (
    <>
      <span className="small muted b">Тема: «{themeOf(k)}»</span>
      <div className="pair">
        {(['me', 'him'] as Who[]).map(w => (
          <div key={w} className="col" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 6 }}><Ava who={w} size={22} /><b className="small">{name(w)}</b>{d[w] && <span className="small muted b">· {d[w]!.at}</span>}</div>
            <div className="rel">
              <Shot p={d[w]} className="big" />
              {w === 'him' && d.him && (
                <button className={'like' + (d.him.liked ? ' on' : '')} onClick={onLike} aria-label="Нравится">
                  <Img src={d.him.liked ? 'common/heart' : 'common/heart_pale'} size={26} />
                </button>
              )}
            </div>
            {d[w]?.caption && <span className="small b">«{d[w]!.caption}»</span>}
            {!d[w] && <span className="small muted b">без фото</span>}
          </div>
        ))}
      </div>
    </>
  )
}
