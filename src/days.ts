import { addDays, diffDays } from './dates'
import type { Who } from './data'

/* Важные даты: дни рождения, годовщины и круглые числа дней вместе.
   Их показывают календарь и карточка «Скоро» на главной. */

export interface DayEvent { name: string; icon: string; kind: 'bday' | 'anniv' | 'days' }
export const MILESTONES = [100, 200, 300, 500, 700, 1000, 1500, 2000, 2500, 3000]
const plural = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10, m100 = n % 100
  return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c
}

export interface Bday { who: Who; date?: string; name: string }

export function eventsOn(k: string, since: string, bdays: Bday[]): DayEvent[] {
  const out: DayEvent[] = []
  for (const b of bdays) {
    if (b.date && b.date.slice(5) === k.slice(5)) {
      out.push({ kind: 'bday', icon: 'cheatsheet/people/ppl_birthday', name: b.who === 'me' ? 'Твой день рождения' : `${b.name} празднует день рождения` })
    }
  }
  if (since && k >= since) {
    if (k === since) out.push({ kind: 'anniv', icon: 'dates/date_anniversary', name: 'День, когда всё началось' })
    else if (k.slice(5) === since.slice(5)) {
      const y = Number(k.slice(0, 4)) - Number(since.slice(0, 4))
      out.push({ kind: 'anniv', icon: 'dates/date_anniversary', name: `Годовщина: ${y} ${plural(y, 'год', 'года', 'лет')} вместе` })
    } else {
      const d = diffDays(k, since)
      if (MILESTONES.includes(d)) out.push({ kind: 'days', icon: 'memory/days_together', name: `${d} дней вместе` })
    }
  }
  return out
}

// Ближайшее важное в пределах days дней (сегодня — 0)
export function nextEvent(today: string, since: string, bdays: Bday[], days = 7) {
  for (let i = 0; i <= days; i++) {
    const k = addDays(today, i)
    const ev = eventsOn(k, since, bdays)
    if (ev.length) return { k, inDays: i, ev }
  }
  return null
}
