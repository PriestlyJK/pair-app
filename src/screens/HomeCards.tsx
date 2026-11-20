import { useStore, usePersist } from '../store'
import { Img, Ava, plural, useName, useG } from '../ui'
import type { Who } from '../data'
import { TODAY_KEY, diffDays } from '../dates'
import { nextEvent } from '../days'
import { CH_KINDS, REWARD, type Challenge, type ChKind } from './TogetherSections'

// «Скоро»: день рождения, годовщина или круглая дата в ближайшую неделю. В остальные дни карточки нет.
export function SoonCard() {
  const s = useStore()
  const name = useName()
  const bdays = (['me', 'him'] as Who[]).map(w => ({ who: w, date: s.profile[w].bday, name: name(w) }))
  const nx = nextEvent(TODAY_KEY, s.settings.since, bdays, 7)
  if (!nx) return null
  const e = nx.ev[0]
  const when = nx.inDays === 0 ? 'Сегодня' : nx.inDays === 1 ? 'Завтра' : `Через ${nx.inDays} ${plural(nx.inDays, 'день', 'дня', 'дней')}`
  return (
    <button className={'card row soon-card' + (nx.inDays === 0 ? ' today' : '')} onClick={() => s.go('calendar')}>
      <Img src={e.icon} size={54} />
      <span className="grow">
        <small>{when}</small>
        <b>{e.name}</b>
        {nx.ev.length > 1 && <small>и {nx.ev.slice(1).map(x => x.name.toLowerCase()).join(', ')}</small>}
      </span>
    </button>
  )
}

// Идущий челлендж: прогресс обоих и отметка за сегодня прямо с главной
export function ChallengeCard() {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [list, setList] = usePersist<Challenge[]>('challenges', [])
  const [kinds] = usePersist<ChKind[]>('ch_kinds', CH_KINDS)
  const live = list.filter(c => !c.claimed && diffDays(TODAY_KEY, c.start) < c.days)
  if (!live.length) return null
  const kindOf = (id: string) => kinds.find(k => k.id === id) ?? CH_KINDS.find(k => k.id === id)

  return (
    <>
      {live.slice(0, 2).map(c => {
        const nm = c.name ?? kindOf(c.kind)?.name ?? 'Челлендж'
        const ic = c.icon ?? kindOf(c.kind)?.icon ?? 'challenges/challenge'
        const day = Math.min(c.days, diffDays(TODAY_KEY, c.start) + 1)
        const meToday = c.me.includes(TODAY_KEY)
        const finished = c.me.length >= c.days && c.him.length >= c.days
        const toggle = () => setList(xs => xs.map(x => (x.id === c.id ? { ...x, me: meToday ? x.me.filter(k => k !== TODAY_KEY) : [...x.me, TODAY_KEY] } : x)))
        return (
          <div key={c.id} className="card ch-card">
            <button className="row ch-head" onClick={() => s.go('together', 'challenges')}>
              <Img src={ic} size={46} />
              <span className="grow">
                <b>{nm}</b>
                <small>день {day} из {c.days} · награда {REWARD(c.days)} {plural(REWARD(c.days), 'монета', 'монеты', 'монет')}</small>
              </span>
            </button>
            {(['me', 'him'] as Who[]).map(w => (
              <div key={w} className="ch-prog">
                <Ava who={w} size={22} />
                <i><b style={{ width: `${Math.min(100, (c[w].length / c.days) * 100)}%` }} /></i>
                <span>{c[w].length}/{c.days}{c[w].includes(TODAY_KEY) ? ' ✓' : ''}</span>
              </div>
            ))}
            {finished
              ? <button className="btn wide" onClick={() => s.go('together', 'challenges')}>Забрать {REWARD(c.days)} монет</button>
              : <button className={'btn wide ' + (meToday ? 'soft' : 'sage')} onClick={toggle}>{meToday ? 'Сегодня сделано ✓' : `Я сегодня ${g.m('сделал', 'сделала')}`}</button>}
            {!finished && !c.him.includes(TODAY_KEY) && meToday && <small className="ch-note">{name('him')} сегодня ещё не {g.p('отметился', 'отметилась')}</small>}
          </div>
        )
      })}
    </>
  )
}
