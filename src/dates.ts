import type { Phase } from './data'

// Даты храним строкой 'YYYY-MM-DD': так их удобно сравнивать и класть в базу.
export const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (k: string, n: number) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d) }
export const diffDays = (a: string, b: string) => Math.round((fromKey(a).getTime() - fromKey(b).getTime()) / 864e5)
export const TODAY_KEY = '2026-11-15'

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const human = (k?: string) => { if (!k) return ''; const d = fromKey(k); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}` }

// ---------- Цикл ----------
// Отмечаются только дни месячных (и по желанию симптомы). Всё остальное считается от них.
export interface CycleDay { flow?: string; sym?: string[]; sex?: string }
export const isPeriod = (c?: CycleDay) => !!c?.flow && c.flow !== 'flow_spotting'

export interface CycleStats { runs: { start: string; len: number }[]; len: number; plen: number }

export function cycleStats(cycle: Record<string, CycleDay>): CycleStats {
  const days = Object.keys(cycle).filter(k => isPeriod(cycle[k])).sort()
  const runs: { start: string; len: number }[] = []
  for (const k of days) {
    const last = runs[runs.length - 1]
    // пропуск в один день не разрывает месячные
    if (last && diffDays(k, addDays(last.start, last.len - 1)) <= 2) last.len = diffDays(k, last.start) + 1
    else runs.push({ start: k, len: 1 })
  }
  const gaps = runs.slice(1).map((r, i) => diffDays(r.start, runs[i].start)).filter(g => g >= 21 && g <= 40)
  const len = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28
  const plen = runs.length ? Math.max(3, Math.min(8, Math.round(runs.reduce((a, r) => a + r.len, 0) / runs.length))) : 5
  return { runs, len, plen }
}

export interface DayInfo { phase: Phase; day: number; predicted: boolean }

export function dayInfo(k: string, st: CycleStats): DayInfo | null {
  let r: CycleStats['runs'][number] | null = null
  for (const x of st.runs) if (x.start <= k) r = x
  if (!r) return null
  let d = diffDays(k, r.start)
  const beyond = d >= st.len
  if (beyond) d = d % st.len
  const period = d < (beyond ? st.plen : r.len)
  const ovu = st.len - 14
  const phase: Phase = period ? 'menstrual' : d < ovu - 2 ? 'follicular' : d <= ovu + 1 ? 'ovulation' : d >= st.len - 5 ? 'pms' : 'luteal'
  return { phase, day: d + 1, predicted: beyond && period }
}

export function nextPeriod(st: CycleStats, from: string) {
  const last = st.runs[st.runs.length - 1]
  if (!last) return null
  let k = addDays(last.start, st.len)
  while (k <= from) k = addDays(k, st.len)
  return k
}
