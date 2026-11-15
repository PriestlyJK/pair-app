/* Слияние изменений с двух телефонов (трёхстороннее).
   base — версия, которую телефон последней видел в облаке; local — что у нас сейчас; remote — что в облаке теперь.
   Берём изменения обоих: разные поля и разные элементы списков складываются, удаления сохраняются.
   Если оба поменяли одно и то же поле по-разному — остаётся наше (мы записываем последними).

   Списки с id (задачи, места, фильмы, желания…) сливаем по id.
   Списки без id (фото места, метки, пункты чек-листа) — как наборы: добавленное с обеих сторон остаётся,
   удалённое с любой стороны уходит. */

type Obj = Record<string, unknown>
const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x)

export function deepEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => deepEq(x, b[i]))
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined)
    return ka.length === kb.length && ka.every(k => deepEq(a[k], b[k]))
  }
  return false
}

// Стабильная строка для сравнения элементов без id
function stable(x: unknown): string {
  if (Array.isArray(x)) return '[' + x.map(stable).join(',') + ']'
  if (isObj(x)) return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(x[k])).join(',') + '}'
  return JSON.stringify(x) ?? 'undefined'
}

const idKey = (x: unknown) => (isObj(x) && (typeof x.id === 'number' || typeof x.id === 'string') ? `${typeof x.id}:${x.id}` : null)

export function merge3(base: unknown, local: unknown, remote: unknown): unknown {
  if (deepEq(local, remote)) return local
  if (base !== undefined && deepEq(base, local)) return remote
  if (base !== undefined && deepEq(base, remote)) return local
  if (Array.isArray(local) && Array.isArray(remote)) return mergeList(Array.isArray(base) ? base : undefined, local, remote)
  if (isObj(local) && isObj(remote)) return mergeObj(isObj(base) ? base : undefined, local, remote)
  return local
}

function mergeObj(base: Obj | undefined, local: Obj, remote: Obj): Obj {
  const out: Obj = {}
  const keys = [...Object.keys(local), ...Object.keys(remote).filter(k => !(k in local))]
  for (const k of keys) {
    const inL = local[k] !== undefined, inR = remote[k] !== undefined, inB = !!base && base[k] !== undefined
    if (inL && inR) out[k] = merge3(base?.[k], local[k], remote[k])
    else if (inL) {
      // В облаке поле убрали, а мы его не трогали — убираем и у себя
      if (!(inB && deepEq(base![k], local[k]))) out[k] = local[k]
    } else if (inR) {
      if (!(inB && deepEq(base![k], remote[k]))) out[k] = remote[k]
    }
  }
  return out
}

function mergeList(base: unknown[] | undefined, local: unknown[], remote: unknown[]): unknown[] {
  const all = [...local, ...remote, ...(base ?? [])]
  if (all.length && all.every(x => idKey(x) !== null)) {
    const B = new Map((base ?? []).map(x => [idKey(x)!, x]))
    const R = new Map(remote.map(x => [idKey(x)!, x]))
    const L = new Map(local.map(x => [idKey(x)!, x]))
    const out: unknown[] = []
    for (const x of local) {
      const k = idKey(x)!
      if (R.has(k)) out.push(merge3(B.get(k), x, R.get(k)))
      // В облаке удалили: если мы этот элемент не меняли — удаляем, если меняли — оставляем
      else if (!(B.has(k) && deepEq(B.get(k), x))) out.push(x)
    }
    for (const x of remote) {
      const k = idKey(x)!
      if (L.has(k)) continue
      if (!(B.has(k) && deepEq(B.get(k), x))) out.push(x)
    }
    return out
  }
  // Без id — как набор
  const sB = new Set((base ?? []).map(stable)), sL = new Set(local.map(stable)), sR = new Set(remote.map(stable))
  const out = local.filter(x => { const s = stable(x); return sR.has(s) || !sB.has(s) })
  const seen = new Set(out.map(stable))
  for (const x of remote) {
    const s = stable(x)
    if (!seen.has(s) && !sL.has(s) && !sB.has(s)) { out.push(x); seen.add(s) }
  }
  return out
}
