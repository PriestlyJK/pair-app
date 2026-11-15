import { useEffect, useState, useSyncExternalStore } from 'react'
import { useStore, type Gender } from '../store'
import { Ava, PhotoPick, shrinkImage, useG, useName, usePartnerHere } from '../ui'
import { cloud, getLink, getStatus, onStatus, partnerJoined, unlinkPartner } from '../sync'
import { TODAY_KEY } from '../dates'
import type { Who } from '../data'

const STATUS: Record<string, [string, string]> = {
  online: ['Всё сохранено в облаке', 'var(--leaf)'],
  syncing: ['Сохраняем…', 'var(--honey, #E8B04A)'],
  offline: ['Нет связи — сохранится, когда появится интернет', 'var(--coral, #E98A86)'],
  local: ['Только на этом телефоне', 'var(--muted)'],
}

function GenderPick({ value, onChange }: { value: Gender; onChange: (g: Gender) => void }) {
  return (
    <div className="seg mini">
      <button className={value === 'f' ? 'on' : ''} onClick={() => onChange('f')}>она</button>
      <button className={value === 'm' ? 'on' : ''} onClick={() => onChange('m')}>он</button>
    </div>
  )
}

// Профиль пары: имена, аватарки, даты, аккаунт и код пары
export function ProfileSheet() {
  const s = useStore()
  const g = useG()
  const link = getLink()
  const status = useSyncExternalStore(onStatus, getStatus)
  const [joined, setJoined] = useState<boolean | null>(null)
  const [sure, setSure] = useState(false)
  const [copied, setCopied] = useState(false)
  const [unlink, setUnlink] = useState<'ask' | 'busy' | 'update-db' | null>(null)
  const here = usePartnerHere()
  const name = useName()

  useEffect(() => { if (link) partnerJoined().then(setJoined) }, [link])

  async function pick(who: Who, f: File) {
    try {
      const photo = await shrinkImage(f, 256, true)
      s.setProfile(p => ({ ...p, [who]: { ...p[who], photo } }))
      s.toast('Аватарка обновлена', 'common/camera')
    } catch {
      s.toast('Не получилось открыть фото', 'states/st_error')
    }
  }
  const setG = (who: Who, v: Gender) => s.setProfile(p => ({ ...p, [who]: { ...p[who], g: v } }))
  const share = () => {
    const text = `Присоединяйся ко мне в «Мы»: ${location.origin + location.pathname}\nКод пары: ${link!.code}`
    if (navigator.share) navigator.share({ text }).catch(() => {})
    else { navigator.clipboard?.writeText(text); setCopied(true) }
  }

  return (
    <>
      {(['me', 'him'] as Who[]).map(who => (
        <div key={who} className="prof">
          <Ava who={who} size={76} online={who === 'him' && here} />
          <div className="grow col" style={{ gap: 8 }}>
            <input
              className="input"
              placeholder={who === 'me' ? 'Твоё имя' : `Как подписывать ${g.his}`}
              value={s.profile[who].name}
              maxLength={20}
              onChange={e => s.setProfile(p => ({ ...p, [who]: { ...p[who], name: e.target.value } }))}
            />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {(who === 'me' || !joined) && (
                <PhotoPick onPick={f => pick(who, f)} className="btn sm">{s.profile[who].photo ? 'Другое фото' : 'Фото'}</PhotoPick>
              )}
              {s.profile[who].photo && (who === 'me' || !joined) && (
                <button className="btn sm soft" onClick={() => s.setProfile(p => ({ ...p, [who]: { ...p[who], photo: null } }))}>Убрать</button>
              )}
              <GenderPick value={s.profile[who].g ?? (who === 'me' ? 'f' : 'm')} onChange={v => setG(who, v)} />
            </div>
          </div>
        </div>
      ))}

      <div className="sec-title">Вы вместе</div>
      <div className="card flat col" style={{ gap: 10 }}>
        <label className="field"><span>С какого дня</span>
          <input className="input date-in" type="date" max={TODAY_KEY} value={s.settings.since} onChange={e => s.setSettings(x => ({ ...x, since: e.target.value }))} />
        </label>
        <label className="field"><span>Встреч до приложения</span>
          <input className="input" inputMode="numeric" value={s.settings.meetBase || ''} placeholder="0"
            onChange={e => s.setSettings(x => ({ ...x, meetBase: Number(e.target.value.replace(/\D/g, '')) || 0 }))} />
        </label>
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={s.settings.cycle} onChange={e => s.setSettings(x => ({ ...x, cycle: e.target.checked }))} />
          <span className="b grow">Календарь цикла</span>
        </label>
      </div>

      {cloud && link ? (
        <>
          <div className="sec-title">Аккаунт</div>
          <div className="card flat col" style={{ gap: 10 }}>
            <div className="row"><span className="grow small muted b">Почта</span><b className="small">{link.email}</b></div>
            <div className="row"><span className="grow small muted b">Синхронизация</span>
              <b className="small" style={{ color: STATUS[status][1] }}>{STATUS[status][0]}</b></div>
            <div className="row">
              <span className="grow small muted b">{joined ? <>{g.He} в паре{here && <b className="online-txt"> · в сети</b>}</> : joined === false ? `${g.He} ещё не ${g.p('присоединился', 'присоединилась')}` : 'Пара'}</span>
              <b className="pair-code sm">{link.code}</b>
            </div>
            {!joined && <button className="btn wide peach" onClick={share}>{copied ? 'Скопировано' : 'Отправить код'}</button>}
            {joined && !unlink && <button className="btn sm soft" style={{ alignSelf: 'flex-start' }} onClick={() => setUnlink('ask')}>Отвязать {g.his} от пары</button>}
            {joined && (unlink === 'ask' || unlink === 'busy') && (
              <div className="col" style={{ gap: 8 }}>
                <b className="small">{name('him')} выйдет из пары и перестанет видеть ваши данные. Всё общее останется у тебя. Код пары тот же: {g.he} сможет вернуться со своими записями, а если войдёт кто-то другой, {g.his} половина начнётся заново.</b>
                <div className="grid2">
                  <button className="btn soft" onClick={() => setUnlink(null)}>Отмена</button>
                  <button className="btn coral" disabled={unlink === 'busy'} onClick={async () => {
                    setUnlink('busy')
                    const err = await unlinkPartner()
                    if (!err) { setUnlink(null); setJoined(false); s.toast(`${name('him')} больше не в паре`, 'common/cross_badge'); return }
                    if (err === 'update-db') { setUnlink('update-db'); return }
                    setUnlink(null); s.toast('Не получилось: ' + err, 'states/st_error')
                  }}>{unlink === 'busy' ? 'Отвязываю…' : 'Отвязать'}</button>
                </div>
              </div>
            )}
            {unlink === 'update-db' && (
              <p className="small b err">Сначала нужно обновить базу: в Supabase → SQL Editor вставить новый кусок из schema.sql и нажать Run. После этого кнопка заработает.</p>
            )}
          </div>
          {!sure ? (
            <button className="btn wide soft" onClick={() => setSure(true)}>Выйти из аккаунта</button>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              <b className="small">Данные останутся в облаке: войдёшь снова — всё вернётся.</b>
              <div className="grid2">
                <button className="btn soft" onClick={() => setSure(false)}>Отмена</button>
                <button className="btn coral" onClick={s.resetAll}>Выйти</button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="small muted b">Сейчас всё хранится только на этом телефоне.</p>
          {!sure ? (
            <button className="btn wide soft" onClick={() => setSure(true)}>Стереть всё и начать заново</button>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              <b className="small">Сотрутся задачи, фото, календарь, кот и покупки. Вернуть не получится.</b>
              <div className="grid2">
                <button className="btn soft" onClick={() => setSure(false)}>Отмена</button>
                <button className="btn coral" onClick={s.resetAll}>Стереть</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
