import { useEffect, useState } from 'react'
import { A, SHOP } from './data'
import { useStore } from './store'

export type Pose = 'idle' | 'happy' | 'eat' | 'sleep' | 'sad' | 'miss' | 'play' | 'celebrate'
export const POSES: Pose[] = ['idle', 'happy', 'eat', 'sleep', 'sad', 'miss', 'play', 'celebrate']
export const ACC_ICON: Record<string, string> = Object.fromEntries(SHOP.acc.map(a => [a.id, a.icon]))

// Аксессуары не накладываются поверх: Codex рисует кота уже в шапке/шарфе,
// на том же холсте 1024×1024 и в том же месте, что обычная поза.
// Путь: pet/<порода>/acc/<аксессуар>/<stage>_<pose>.webp
const accPath = (breed: string, acc: string, key: string) => `pet/${breed}/acc/${acc}/${key}`

// Какие картинки уже есть: проверяем один раз и запоминаем
const known = new Map<string, Promise<boolean>>()
function exists(path: string) {
  let p = known.get(path)
  if (!p) {
    p = new Promise(res => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = A(path) })
    known.set(path, p)
  }
  return p
}

export function useHasAccArt(breed: string, acc: string | null | undefined, key: string) {
  const path = acc ? accPath(breed, acc, key) : ''
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    let live = true
    if (!path) { setOk(false); return }
    setOk(null)
    exists(path).then(v => { if (live) setOk(v) })
    return () => { live = false }
  }, [path])
  return ok
}

export function PetView({ pose, className = '', breed, stage, acc }: { pose: Pose; className?: string; breed?: string; stage?: 'baby' | 'adult'; acc?: string | null }) {
  const { pet } = useStore()
  const b = breed ?? pet.breed
  const st = stage ?? pet.stage
  const a = acc === undefined ? pet.acc : acc
  const key = `${st}_${pose}`
  const has = useHasAccArt(b, a, key)
  const src = a && has ? accPath(b, a, key) : `pet/${b}/${key}`
  return (
    <div className={'pet ' + className}>
      <img className="body" src={A(src)} alt="" draggable={false} />
    </div>
  )
}
