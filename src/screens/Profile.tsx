import { useState } from 'react'
import { useStore } from '../store'
import { Ava, PhotoPick, shrinkImage } from '../ui'
import type { Who } from '../data'

// Аватарки и имена. Имя нужно только для подписей, по умолчанию «Я» и «Он».
export function ProfileSheet() {
  const s = useStore()
  const [sure, setSure] = useState(false)

  async function pick(who: Who, f: File) {
    try {
      const photo = await shrinkImage(f, 256, true)
      s.setProfile(p => ({ ...p, [who]: { ...p[who], photo } }))
      s.toast('Аватарка обновлена', 'common/camera')
    } catch {
      s.toast('Не получилось открыть фото', 'states/st_error')
    }
  }

  return (
    <>
      {(['me', 'him'] as Who[]).map(who => (
        <div key={who} className="prof">
          <Ava who={who} size={76} />
          <div className="grow col" style={{ gap: 8 }}>
            <input
              className="input"
              placeholder={who === 'me' ? 'Твоё имя, можно пусто' : 'Его имя, можно пусто'}
              value={s.profile[who].name}
              maxLength={20}
              onChange={e => s.setProfile(p => ({ ...p, [who]: { ...p[who], name: e.target.value } }))}
            />
            <div className="row" style={{ gap: 8 }}>
              <PhotoPick onPick={f => pick(who, f)} className="btn sm">{s.profile[who].photo ? 'Другое фото' : 'Выбрать фото'}</PhotoPick>
              {s.profile[who].photo && (
                <button className="btn sm soft" onClick={() => s.setProfile(p => ({ ...p, [who]: { ...p[who], photo: null } }))}>Убрать</button>
              )}
            </div>
          </div>
        </div>
      ))}
      <p className="small muted b">Его аватарку он потом поставит у себя сам. Пока всё хранится только в этом браузере.</p>
      {!sure ? (
        <button className="btn wide soft" onClick={() => setSure(true)}>Начать заново с примером</button>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          <b className="small">Сотрутся все отметки, покупки, расстановка комнаты и аватарки.</b>
          <div className="grid2">
            <button className="btn soft" onClick={() => setSure(false)}>Отмена</button>
            <button className="btn coral" onClick={s.resetAll}>Стереть</button>
          </div>
        </div>
      )}
    </>
  )
}
