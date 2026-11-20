import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import { useStore, usePersist, describe, hoursToHungry, HUNGRY, type Pet, type RoomPos } from '../store'
import { sendEvent, getLink, type PairEvent } from '../sync'
import { PhotoCard } from './Photos'
import { Img, Bar, Sheet, Coin, Ava, plural, useName, useG, usePartnerHere } from '../ui'
import { PetView, useHasAccArt, ACC_ICON, type Pose } from '../pet'
import { BBOX } from '../bbox'
import { TOUCHES, SHOP, type Who } from '../data'
import { TODAY_KEY, diffDays, human, isSunday, weekEnd, weekRange, weekStart } from '../dates'
import { ProfileSheet } from './Profile'
import { PushNudge } from '../push'
import { DiaryCard } from './DiaryCard'
import { CrownCard, WheelButton, WheelSheet } from './Wheel'
import { AuctionCard } from './Auction'
import HobbyScreen, { HobbyCard } from './Hobby'
import { SoonCard, ChallengeCard, HoldHands } from './HomeCards'

// Дневник открывается с главной (#home/diary) — отдельным куском, только когда нужен
const Diary = lazy(() => import('./Diary'))

// «только что», «5 мин назад», «вчера в 21:40»
function agoText(iso: string) {
  const d = new Date(iso), min = Math.round((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин назад`
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === new Date().toDateString()) return `сегодня в ${hm}`
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `вчера в ${hm}`
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} в ${hm}`
}

// Подпись под сытостью: голоден или через сколько проголодается
function hungerNote(p: Pet) {
  if (p.satiety < HUNGRY) return 'хочет есть'
  const h = hoursToHungry(p)
  return h < 1 ? 'скоро захочет есть' : `сыт ещё ~${Math.round(h)} ч`
}

type Tod = 'day' | 'evening' | 'night'
const autoTod = (): Tod => {
  const h = new Date().getHours()
  return h >= 23 || h < 7 ? 'night' : h >= 18 ? 'evening' : 'day'
}

// Начальные точки комнаты из slots.json Кодекса: x — центр, y — низ видимой части предмета, w — ширина видимой части (доли картинки комнаты).
type Spot = { x: number; y: number; w: number }
const SLOTS: Record<string, Spot> = {
  wall_top: { x: 0.5, y: 0.18, w: 0.4 },
  wall_left: { x: 0.13, y: 0.45, w: 0.16 },
  wall_right: { x: 0.86, y: 0.45, w: 0.17 },
  wall_right_high: { x: 0.86, y: 0.3, w: 0.11 },
  sill: { x: 0.67, y: 0.46, w: 0.11 },
  sill_left: { x: 0.33, y: 0.46, w: 0.08 },
  back_left: { x: 0.17, y: 0.74, w: 0.21 },
  back_right: { x: 0.83, y: 0.74, w: 0.2 },
  back_center: { x: 0.5, y: 0.66, w: 0.2 },
  mid_left: { x: 0.18, y: 0.84, w: 0.17 },
  mid_right: { x: 0.82, y: 0.84, w: 0.17 },
  front_left: { x: 0.16, y: 0.91, w: 0.15 },
  front_right: { x: 0.84, y: 0.91, w: 0.15 },
  rug: { x: 0.5, y: 0.875, w: 0.42 },
  bed: { x: 0.5, y: 0.835, w: 0.3 },
}
const PREFER: Record<string, string[]> = {
  garland: ['wall_top'], frame: ['wall_left'], shelf: ['wall_right'], clock: ['wall_right_high'],
  plant: ['sill', 'sill_left'], nightlight: ['sill_left', 'sill'],
  house: ['back_left', 'back_right'], scratcher: ['back_right', 'back_left'], armchair: ['back_left', 'back_right'], aquarium: ['back_center'],
  blanket: ['mid_left', 'front_left'], toybasket: ['mid_right', 'front_right'], pillow: ['front_left', 'mid_left', 'front_right'],
  rug: ['rug'], bed: ['bed'],
}
const FURN = Object.fromEntries(SHOP.furniture.map(f => [f.id, f]))
const BOWL: Spot = { x: 0.7, y: 0.915, w: 0.1 }
// Миска только на полу, куда кот может подойти (раньше её можно было поставить на подоконник — там кот ел «из другой миски»)
const bowlPos = (p?: RoomPos): RoomPos => (p ? { ...p, y: Math.max(p.y, 0.62) } : BOWL)
const SIT = ['bed', 'pillow', 'blanket', 'armchair']
// Лежанка (доли её картинки 1024×1024): куда кладём низ спящего кота — на подушку чуть за передним бортом,
// и контур переднего борта: его рисуем второй раз поверх кота, чтобы тот лежал внутри, а не висел снаружи
const BED_SEAT = { u: 0.44, v: 0.61 }
const BED_RIM = 'polygon(0% 100%, 0% 50%, 12% 50%, 20% 53%, 25% 56.5%, 58% 56.5%, 62% 52%, 68% 47%, 78% 43.5%, 100% 42%, 100% 100%)'

// Где что может стоять: на стене, на полу, плоско на полу, мелочь (и на подоконнике тоже)
type Kind = 'wall' | 'floor' | 'flat' | 'small'
const kindOf = (id: string): Kind =>
  ['garland', 'frame', 'shelf', 'clock'].includes(id) ? 'wall' : id === 'rug' ? 'flat' : ['plant', 'nightlight', 'bowl'].includes(id) ? 'small' : 'floor'
const BOUNDS: Record<Kind | 'pet', [number, number]> = { wall: [0.14, 0.58], floor: [0.6, 0.955], flat: [0.66, 0.955], small: [0.38, 0.955], pet: [0.62, 0.955] }
// Чем ближе к зрителю (ниже), тем крупнее
const depth = (y: number) => 0.4 + 0.66 * y
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function defaults(owned: string[]) {
  const used = new Set<string>()
  const out: Record<string, Spot> = {}
  for (const id of owned) {
    const slot = PREFER[id]?.find(s => !used.has(s))
    if (!slot) continue
    used.add(slot)
    out[id] = SLOTS[slot]
  }
  return out
}
export const petDefault = (owned: string[]): RoomPos => ({ x: owned.includes('bed') ? 0.3 : 0.45, y: 0.915 })

// Ставит картинку так, чтобы её видимая часть была шириной w и стояла низом на y
function Placed({ src, x, y, w, canvas, z, flip, className = '', children, style, onPointerDown }: {
  src: string; x: number; y: number; w?: number; canvas?: number; z?: number; flip?: boolean; className?: string; children?: ReactNode
  style?: CSSProperties; onPointerDown?: (e: RPointerEvent<HTMLDivElement>) => void
}) {
  const bb = BBOX[src] ?? [0, 0, 1, 1]
  const cw = canvas ?? (w ?? 0.2) / (bb[2] - bb[0])
  const cx = flip ? 1 - (bb[0] + bb[2]) / 2 : (bb[0] + bb[2]) / 2
  const l = flip ? 1 - bb[2] : bb[0], r = flip ? bb[0] : 1 - bb[2]
  const content = children ?? <img src={`assets/${src}.webp`} alt="" draggable={false} />
  return (
    <div
      className={'ri ' + (flip ? 'flip ' : '') + className}
      onPointerDown={onPointerDown}
      style={{
        left: `${x * 100}%`, top: `${y * 100}%`, width: `${cw * 100}%`, zIndex: z ?? Math.round(y * 100),
        transform: `translate(${-cx * 100}%, ${-bb[3] * 100}%)`,
        ['--fl' as string]: `${(1 - bb[3]) * 100}%`, ['--l' as string]: `${l * 100}%`, ['--r' as string]: `${r * 100}%`,
        ...style,
      }}
    >
      {flip ? <div className="flipper">{content}</div> : content}
    </div>
  )
}

// Часть картинки (u — по ширине, v — по высоте холста) в рамке шириной w с низом на y. Так шторы делятся на две половины.
function Crop({ src, u0, u1, v0, v1, x, y, w }: { src: string; u0: number; u1: number; v0: number; v1: number; x: number; y: number; w: number }) {
  const scale = w / (u1 - u0)
  const h = ((v1 - v0) * scale) / 1.5
  return (
    <div className="ri crop" style={{ left: `${(x - w / 2) * 100}%`, top: `${(y - h) * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, zIndex: 3, transform: 'none' }}>
      <img src={`assets/${src}.webp`} alt="" draggable={false} style={{ position: 'absolute', width: `${100 / (u1 - u0)}%`, left: `${(-u0 / (u1 - u0)) * 100}%`, top: `${((-v0 * scale) / 1.5 / h) * 100}%` }} />
    </div>
  )
}

const PET_CANVAS = 0.4 // ширина холста питомца в долях комнаты у переднего края

// Что кот «принёс»: касание от партнёра или мысль о том, кто давно не заходил
interface Carry { icon?: string; ava?: Who; label: string; onTap: () => void }
interface RoomProps {
  tod: Tod; pose: Pose; fx: string | null; bowlFull: boolean; toy?: string | null; bowlHidden?: boolean
  carry?: Carry | null
  edit?: boolean; onEditDone?: () => void
  walkMs?: number
  onPet?: () => void; onFloor?: (x: number, y: number) => void; onPetDrag?: (dragging: boolean) => void
}

export function Room({ tod, pose, fx, bowlFull, toy, carry, bowlHidden = false, edit = false, onEditDone, walkMs = 0, onPet, onFloor, onPetDrag }: RoomProps) {
  const { pet, owned, room, setRoom, toast } = useStore()
  const layer = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)
  const floor = useRef<{ sx: number; sy: number } | null>(null)
  const liveRef = useRef<{ id: string; x: number; y: number } | null>(null)
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  useEffect(() => { if (!edit) setSel(null) }, [edit])

  const furn = owned.filter(id => FURN[id] && id !== 'curtains')
  const defs = defaults(furn)
  const shown = furn.filter(id => defs[id] && !room.hidden.includes(id))
  const posOf = (id: string): RoomPos => {
    if (live?.id === id) return { ...room.pos[id], x: live.x, y: live.y }
    if (id === 'bowl') return bowlPos(room.pos.bowl)
    return room.pos[id] ?? (id === 'pet' ? petDefault(owned) : defs[id])
  }
  const widthOf = (id: string, y: number) => {
    const d = id === 'bowl' ? BOWL : defs[id]
    return kindOf(id) === 'wall' ? d.w : d.w * depth(y) / depth(d.y)
  }

  const hasBed = shown.includes('bed')
  const onBed = pose === 'sleep' && hasBed && live?.id !== 'pet'
  const bed: RoomPos = hasBed ? posOf('bed') : { x: 0.5, y: 0.835 }
  // Лежанка нарисована в три четверти: подушка левее центра картинки, а передний борт стоит перед тем, кто внутри.
  // bedAt — точка картинки лежанки (u, v — доли холста) в координатах комнаты, bedUV — обратно.
  const bedBox = BBOX[FURN.bed.icon] ?? [0, 0, 1, 1]
  const bedCw = hasBed ? widthOf('bed', bed.y) / (bedBox[2] - bedBox[0]) : 1
  const bedCx = (bedBox[0] + bedBox[2]) / 2
  const bedDir = bed.flip ? -1 : 1
  const bedAt = (u: number, v: number) => ({ x: bed.x + bedDir * (u - bedCx) * bedCw, y: bed.y + (v - bedBox[3]) * bedCw / 1.5 })
  const bedUV = (p: { x: number; y: number }) => ({ u: bedCx + bedDir * (p.x - bed.x) / bedCw, v: bedBox[3] + (p.y - bed.y) * 1.5 / bedCw })
  // Спит внутри, на подушке; раньше низ кота ставился почти у ножек и он висел на переднем борту
  const pp = onBed ? { ...bedAt(BED_SEAT.u, BED_SEAT.v), flip: room.pos.pet?.flip } : posOf('pet')
  const petScale = depth(onBed ? bed.y : pp.y) / depth(0.915)
  // Если лапы кота внутри лежанки, подушки, пледа или кресла — он сидит на вещи, а не прячется за ней
  const sitOn = onBed ? undefined : SIT.filter(id => shown.includes(id)).map(id => {
    const p = posOf(id)
    const w = widthOf(id, p.y)
    const b = BBOX[FURN[id].icon] ?? [0, 0, 1, 1]
    return { id, p, w, h: (w * (b[3] - b[1])) / (b[2] - b[0]) / 1.5 }
  }).filter(o => Math.abs(pp.x - o.p.x) < o.w * 0.45 && pp.y <= o.p.y + 0.01 && pp.y >= o.p.y - o.h * 0.75).sort((a, b) => b.p.y - a.p.y)[0]
  // Кот внутри лежанки (спит или днём посажен на подушку) — поверх него ещё раз рисуем передний борт
  const inBed = hasBed && live?.id !== 'pet' && (onBed || (!walkMs && sitOn?.id === 'bed' && (() => {
    const t = bedUV(pp)
    return t.v > 0.45 && t.v < 0.7 && t.u > 0.18 && t.u < 0.72
  })()))
  const petZ = live?.id === 'pet' || (inBed && live?.id === 'bed') ? 141 : onBed ? Math.round(bed.y * 100) + 1 : sitOn ? Math.round(sitOn.p.y * 100) + 1 : Math.round(pp.y * 100) + 1
  const key = `pet/${pet.breed}/${pet.stage}_${pose}`
  const bb = BBOX[key] ?? [0, 0, 1, 1]
  const hungry = pet.satiety < HUNGRY && pose !== 'eat' && tod !== 'night'
  const toyX = clamp(pp.x + (pp.flip ? 0.13 : -0.13), 0.08, 0.92)

  function local(e: { clientX: number; clientY: number }) {
    const r = layer.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, r }
  }
  function down(e: RPointerEvent<HTMLDivElement>, id: string) {
    if (id !== 'pet' && !edit) return
    if (id === 'pet' && onBed) return // спящего не таскаем
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = posOf(id)
    drag.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false }
  }
  function move(e: RPointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6) return
    if (!d.moved) { d.moved = true; if (d.id === 'pet') onPetDrag?.(true) }
    const r = layer.current!.getBoundingClientRect()
    const [y0, y1] = BOUNDS[d.id === 'pet' || d.id === 'bowl' ? 'pet' : kindOf(d.id)]
    const v = { id: d.id, x: clamp(d.ox + (e.clientX - d.sx) / r.width, 0.07, 0.93), y: clamp(d.oy + (e.clientY - d.sy) / r.height, y0, y1) }
    liveRef.current = v
    setLive(v)
  }
  function up(e: RPointerEvent<HTMLDivElement>) {
    const d = drag.current
    drag.current = null
    if (d) {
      const v = liveRef.current
      liveRef.current = null
      setLive(null)
      if (d.id === 'pet' && d.moved) onPetDrag?.(false)
      if (!d.moved || !v) {
        if (d.id === 'pet') onPet?.()
        else setSel(s => (s === d.id ? null : d.id))
        return
      }
      setRoom(r => ({ ...r, pos: { ...r.pos, [d.id]: { ...r.pos[d.id], x: v.x, y: v.y } } }))
      if (edit && d.id !== 'pet') setSel(d.id)
      return
    }
    const f = floor.current
    floor.current = null
    if (!f || Math.hypot(e.clientX - f.sx, e.clientY - f.sy) > 8) return
    if (edit) setSel(null)
    const p = local(e)
    if (p.y > 0.5) onFloor?.(clamp(p.x, 0.08, 0.92), clamp(p.y, ...BOUNDS.pet))
  }

  const curtains = owned.includes('curtains') && !room.hidden.includes('curtains')
  const hidden = room.hidden.filter(id => owned.includes(id))

  return (
    <>
    <div className={'room ' + tod + (edit ? ' edit' : '')}>
      <div
        className="room-layer"
        ref={layer}
        onPointerDown={e => { floor.current = { sx: e.clientX, sy: e.clientY } }}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { drag.current = null; floor.current = null; liveRef.current = null; setLive(null); onPetDrag?.(false) }}
      >
        <img className="bg" src={`assets/pet/room/room_${tod}.webp`} alt="" draggable={false} />
        {curtains && (() => {
          const cb = BBOX['shop/furniture/curtains'] ?? [0.05, 0.07, 0.95, 0.93]
          const mid = (cb[0] + cb[2]) / 2
          return (
            <>
              <Crop src="shop/furniture/curtains" u0={cb[0]} u1={mid} v0={cb[1]} v1={cb[3]} x={0.28} y={0.47} w={0.2} />
              <Crop src="shop/furniture/curtains" u0={mid} u1={cb[2]} v0={cb[1]} v1={cb[3]} x={0.72} y={0.47} w={0.2} />
            </>
          )
        })()}
        {shown.map(id => {
          const p = posOf(id)
          const k = kindOf(id)
          const dragging = live?.id === id
          return (
            <Placed
              key={id} src={FURN[id].icon} x={p.x} y={p.y} w={widthOf(id, p.y)} flip={p.flip}
              z={dragging ? 140 : k === 'flat' ? 1 : k === 'wall' ? 4 : undefined}
              className={(id === 'nightlight' ? 'glow ' : '') + (k === 'flat' || k === 'wall' ? '' : 'shadowed ') + (edit ? 'drag ' : '') + (sel === id ? 'sel ' : '') + (dragging ? 'lift' : '')}
              onPointerDown={e => down(e, id)}
            />
          )
        })}
        {!bowlHidden && (() => {
          const p = posOf('bowl')
          return (
            <Placed src={bowlFull ? 'shop/food/bowl_basic' : 'shop/food/bowl_empty'} x={p.x} y={p.y} w={widthOf('bowl', p.y)}
              z={live?.id === 'bowl' ? 140 : undefined}
              className={'shadowed ' + (edit ? 'drag ' : '') + (sel === 'bowl' ? 'sel ' : '') + (live?.id === 'bowl' ? 'lift' : '')}
              onPointerDown={e => down(e, 'bowl')} />
          )
        })()}
        {toy && <Placed src={toy} x={toyX} y={clamp(pp.y + 0.01, 0, 0.955)} w={0.08 * petScale} z={petZ + 1} className="shadowed" />}
        <Placed
          src={key} x={pp.x} y={pp.y} canvas={PET_CANVAS * petScale * (onBed ? 0.9 : 1)} flip={pp.flip}
          z={petZ}
          className={'pet-spot' + (onBed || sitOn ? '' : ' shadowed') + (live?.id === 'pet' ? ' lift' : '') + (walkMs ? ' walking' : '')}
          style={walkMs ? { transition: `left ${walkMs}ms linear, top ${walkMs}ms linear, width ${walkMs}ms linear` } : undefined}
          onPointerDown={e => down(e, 'pet')}
        >
          <PetView pose={pose} className={walkMs ? 'hop' : pose === 'idle' || pose === 'sleep' ? 'breathe' : 'bounce'} key={pose + (walkMs ? 'w' : '')} />
          {fx && <img className="fx" style={{ top: `${bb[1] * 100}%` }} src={`assets/pet/effects/${fx}.webp`} alt="" key={fx + pose} />}
          {hungry && <img className="fx loop" style={{ top: `${bb[1] * 100 - 14}%` }} src="assets/pet/effects/fx_hunger_bubble.webp" alt="" />}
          {carry && !edit && (
            <button className={'carry' + (carry.ava ? ' ava' : '')} style={{ top: `${bb[1] * 100 - 6}%` }} aria-label={carry.label}
              onPointerDown={e => e.stopPropagation()} onClick={carry.onTap}>
              <span className="carry-in">
                {carry.ava ? <><Ava who={carry.ava} size={30} /><img className="carry-heart" src="assets/common/heart_pale.webp" alt="" /></> : <img src={`assets/${carry.icon}.webp`} alt="" />}
              </span>
            </button>
          )}
        </Placed>
        {inBed && (
          <Placed src={FURN.bed.icon} x={bed.x} y={bed.y} w={widthOf('bed', bed.y)} flip={bed.flip} z={petZ + 1}
            className={'rim' + (edit ? ' drag' : '') + (sel === 'bed' ? ' sel' : '')}>
            <img src={`assets/${FURN.bed.icon}.webp`} alt="" draggable={false} style={{ clipPath: BED_RIM }} />
          </Placed>
        )}
      </div>
    </div>

      {edit && (
        <div className="room-edit">
          {sel ? (
            <div className="re-bar">
              <Img src={sel === 'bowl' ? 'shop/food/bowl_basic' : FURN[sel].icon} />
              <b className="grow">{sel === 'bowl' ? 'Миска' : FURN[sel].name}</b>
              {kindOf(sel) !== 'wall' && (
                <button className="btn sm soft" onClick={() => setRoom(r => ({ ...r, pos: { ...r.pos, [sel]: { ...posOf(sel), flip: !posOf(sel).flip } } }))}>Отразить</button>
              )}
              {sel !== 'bowl' && (
                <button className="btn sm soft" onClick={() => { setRoom(r => ({ ...r, hidden: [...r.hidden, sel] })); setSel(null); toast(`${FURN[sel].name}: убрано`, FURN[sel].icon) }}>Убрать</button>
              )}
            </div>
          ) : (
            <div className="re-hint">Перетаскивай вещи пальцем. Нажми на вещь, чтобы отразить или убрать её. Закончить — «Готово» или нажми в любое место вне комнаты.</div>
          )}
          {hidden.length > 0 && (
            <div className="re-tray">
              <span className="small b">Убрано:</span>
              {hidden.map(id => (
                <button key={id} onClick={() => setRoom(r => ({ ...r, hidden: r.hidden.filter(x => x !== id) }))} aria-label={'Вернуть ' + FURN[id].name}>
                  <Img src={FURN[id].icon} />
                </button>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm soft grow" onClick={() => { setRoom({ pos: {}, hidden: [] }); setSel(null); toast('Комната как была', 'nav/home') }}>Сбросить</button>
            <button className="btn sm sage grow" onClick={onEditDone}>✓ Готово</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function Home() {
  const s = useStore()
  if (s.sub === 'hobby') return <HobbyScreen />
  if (s.sub === 'diary') return <Suspense fallback={<div className="screen" />}><Diary /></Suspense>
  return <HomeMain />
}

function HomeMain() {
  const s = useStore()
  const { pet } = s
  // Время суток идёт по часам телефона. Кнопками можно подсмотреть другое, но при возвращении
  // в приложение и при смене утра/вечера/ночи комната снова показывает настоящее время.
  const [auto, setAuto] = useState<Tod>(autoTod)
  const [manual, setManual] = useState<Tod | null>(null)
  const [atBowl, setAtBowl] = useState(false)
  const tod = manual ?? auto
  useEffect(() => {
    const tick = () => setAuto(autoTod())
    const onVis = () => { if (document.visibilityState === 'visible') { setManual(null); tick() } }
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', onVis) }
  }, [])
  useEffect(() => { setManual(null) }, [auto])
  const [action, setAction] = useState<Pose | null>(null)
  const [fx, setFx] = useState<string | null>(null)
  const [toy, setToy] = useState<string | null>(null)
  const [touchOpen, setTouchOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)
  const [petOpen, setPetOpen] = useState(false)
  const [profOpen, setProfOpen] = useState(false)
  const here = usePartnerHere()
  const [edit, setEdit] = useState(false)
  const [wheelOpen, setWheelOpen] = useState(false)
  // «Расставить» живёт в магазине: оттуда приходим сюда с #home/arrange
  useEffect(() => {
    if (s.sub !== 'arrange') return
    s.go('home')
    setEdit(true)
    setTimeout(() => document.querySelector('.room-edit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.sub])
  // Когда каждый последний раз открывал приложение: кот скучает по тому, кто давно не заходил
  const [lastSeen, setLastSeen] = usePersist<Partial<Record<Who, string>>>('last_seen', {})
  useEffect(() => { if (lastSeen.me !== TODAY_KEY) setLastSeen(v => ({ ...v, me: TODAY_KEY })) }, [lastSeen.me, setLastSeen])
  const [walkMs, setWalkMs] = useState(0)
  const [lifted, setLifted] = useState(false)
  const [sent, setSent] = usePersist<Record<Who, Record<string, number>>>('sent', { me: {}, him: {} })
  const name = useName()
  const g = useG()
  const [inbox, setInbox] = usePersist<PairEvent[]>('inbox', [])
  const last = inbox[inbox.length - 1]
  const lastMsg = last ? describe(last, name('him'), s.profile.him.g) : null
  // Кот приносит непрочитанное касание, а если партнёр давно не заходил — скучает по нему
  const away = getLink() && !here && lastSeen.him ? diffDays(TODAY_KEY, lastSeen.him) : 0
  const carry = lastMsg
    ? { icon: lastMsg.icon, label: 'Непрочитанное', onTap: () => setInboxOpen(true) }
    : away >= 2
      ? {
          ava: 'him' as Who, label: `${s.pet.name || 'Питомец'} скучает`,
          onTap: () => { s.toast(`${s.pet.name || 'Питомец'} скучает: ${name('him')} не ${g.p('заходил', 'заходила')} уже ${away} ${plural(away, 'день', 'дня', 'дней')}`, 'common/heart_pale'); setTouchOpen(true) },
        }
      : null
  const [flyer, setFlyer] = useState<{ icon: string; k: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const walkTimer = useRef<number | undefined>(undefined)
  const walkUntil = useRef(0) // когда кот дойдёт, куда идёт сейчас
  const afterEat = useRef<number | undefined>(undefined)

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(walkTimer.current); clearTimeout(afterEat.current) }, [])

  // Режим расстановки закрывается и кнопкой «Готово», и нажатием в любое место вне комнаты
  useEffect(() => {
    if (!edit) return
    const off = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('.room-wrap, .room-edit, .sheet')) setEdit(false)
    }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [edit])

  const basePose: Pose = tod === 'night' ? 'sleep' : pet.satiety < 25 ? 'sad' : 'idle'
  const pose = lifted ? 'happy' : action ?? basePose

  function act(p: Pose, ms: number, effect: string | null = null, toyIcon: string | null = null) {
    clearTimeout(timer.current)
    setAction(p); setFx(effect); setToy(toyIcon)
    timer.current = window.setTimeout(() => { setAction(null); setFx(null); setToy(null) }, ms)
  }
  // Кот идёт в точку пола; возвращает время пути
  function walkTo(x: number, y: number, face?: boolean) {
    const cur = s.room.pos.pet ?? petDefault(s.owned)
    const dist = Math.hypot(x - cur.x, (y - cur.y) * 1.5)
    if (dist < 0.02) {
      if (face !== undefined && face !== cur.flip) s.setRoom(r => ({ ...r, pos: { ...r.pos, pet: { ...cur, flip: face } } }))
      // Уже идёт сюда (например, «Покормить» нажали дважды) — ждём, пока дойдёт
      return Math.max(0, walkUntil.current - Date.now())
    }
    const ms = Math.round(clamp(dist * 2600, 400, 1800))
    clearTimeout(walkTimer.current)
    walkUntil.current = Date.now() + ms
    setWalkMs(ms)
    s.setRoom(r => ({ ...r, pos: { ...r.pos, pet: { x, y, flip: face ?? (Math.abs(x - cur.x) > 0.01 ? x > cur.x : cur.flip) } } }))
    walkTimer.current = window.setTimeout(() => setWalkMs(0), ms)
    return ms
  }
  function onFloor(x: number, y: number) {
    if (tod === 'night') { s.toast(`${pet.name} спит`, 'common/moon'); return }
    stopEating()
    walkTo(x, y)
  }
  // Кота увели в другое место (нажали на пол или перенесли), пока он шёл к миске или ел, — там он есть не будет
  function stopEating() {
    clearTimeout(timer.current); clearTimeout(afterEat.current)
    setAtBowl(false); setAction(null); setFx(null); setToy(null)
  }
  // Держались за руки: кот радуется, раз в день — монеты каждому
  function joined() {
    act('happy', 2600, 'fx_hearts')
    s.setPet(p => ({ ...p, happiness: Math.min(100, p.happiness + 10) }))
    if (s.game.me?.hands !== TODAY_KEY) {
      s.setGame(gm => ({ ...gm, me: { ...gm.me, hands: TODAY_KEY } }))
      s.earn(5, `Держитесь за руки · +5`, 'common/two_hearts')
    } else s.toast('Держитесь за руки', 'common/two_hearts')
  }
  function tapPet() {
    if (tod === 'night' && !action) { s.toast(`${pet.name} спит`, 'common/moon'); return }
    s.setPet(p => ({ ...p, happiness: Math.min(100, p.happiness + 2) }))
    act('happy', 1800, 'fx_hearts')
  }
  function feed() {
    if (pet.satiety >= 90) { s.toast(`${pet.name} ещё сытый, покормишь позже`, 'shop/food/bowl_basic'); return }
    // Бесплатная еда с колеса тратится первой
    const free = (s.game.me?.feed ?? 0) > 0
    if (free) s.setGame(g => ({ ...g, me: { ...g.me, feed: Math.max(0, (g.me?.feed ?? 1) - 1) } }))
    else if (!s.spend(5)) return
    s.setPet(p => ({ ...p, satiety: Math.min(100, p.satiety + 50) }))
    s.toast(free ? 'Покормили · бесплатно, с колеса' : 'Покормили · −5', 'shop/food/bowl_basic')
    if (tod === 'night') return
    /* Подходит к нашей миске и ест из неё. В картинке «ест» миска уже нарисована — левее центра кота
       (у котёнка на 0.137 ширины холста, у взрослого на 0.153). Ставим кота так, чтобы эта миска встала
       ровно на место миски в комнате, а комнатную на время еды прячем: выглядит, будто он ест из неё. */
    const bowl = bowlPos(s.room.pos.bowl)
    clearTimeout(timer.current)
    const cur = s.room.pos.pet ?? petDefault(s.owned)
    const off = (pet.stage === 'adult' ? 0.153 : 0.137) * PET_CANVAS * depth(bowl.y) / depth(0.915)
    let right = cur.x < bowl.x // подходит слева — смотрит вправо, миска у него справа
    if (right && bowl.x - off < 0.06) right = false
    if (!right && bowl.x + off > 0.94) right = true
    const x = right ? bowl.x - off : bowl.x + off, y = clamp(bowl.y, ...BOUNDS.pet)
    const ms = walkTo(x, y, right)
    timer.current = window.setTimeout(() => { setAtBowl(true); act('eat', 2600) }, ms)
    // Поел — отходит на шаг, чтобы не загораживать миску
    clearTimeout(afterEat.current)
    afterEat.current = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      walkTo(clamp(x + (right ? -0.14 : 0.14), 0.08, 0.92), clamp(y - 0.03, ...BOUNDS.pet), !right)
    }, ms + 2700)
  }
  function play() {
    const toys = SHOP.toys.filter(t => s.owned.includes(t.id))
    if (!toys.length) { s.toast('Сначала купи игрушку', 'shop/toys/ball'); s.openShop('toys'); return }
    const t = toys[Math.floor(Math.random() * toys.length)]
    s.setPet(p => ({ ...p, happiness: Math.min(100, p.happiness + 10) }))
    act('play', 2600, 'fx_sparkles', t.icon)
  }
  function sendTouch(t: (typeof TOUCHES)[number]) {
    setSent(x => ({ ...x, me: { ...x.me, [t.id]: (x.me[t.id] ?? 0) + 1 } }))
    sendEvent('touch', { id: t.id })
    setInbox([])
    setFlyer({ icon: t.icon, k: Date.now() })
    setTouchOpen(false)
    setTimeout(() => s.toast(`«${t.name}» отправлено`, t.icon), 500)
    setTimeout(() => setFlyer(null), 1200)
  }

  // Встречи: сколько было до приложения (из настроек) + отмеченные в календаре
  const meetKeys = Object.keys(s.meetings).sort()
  const past = meetKeys.filter(k => k <= TODAY_KEY)
  const next = meetKeys.find(k => k > TODAY_KEY)
  const metToday = !!s.meetings[TODAY_KEY]
  function toggleToday() {
    s.setMeetings(m => {
      const n = { ...m }
      if (n[TODAY_KEY]) delete n[TODAY_KEY]
      else n[TODAY_KEY] = 'Встреча'
      return n
    })
    if (metToday) s.toast('Отметка убрана', 'meetings/meet_empty')
    else { s.toast(`Встреча №${s.meetCount + 1}!`, 'meetings/meet_button'); sendEvent('meet', { day: TODAY_KEY }) }
  }

  const days = s.daysTogether
  const wk = weekStart(TODAY_KEY)
  const sprint = s.tasks.filter(t => t.status !== 'backlog' && (t.status !== 'done' || !t.doneAt || t.doneAt >= wk))
  const done = sprint.filter(t => t.status === 'done').length
  const daysLeft = diffDays(weekEnd(TODAY_KEY), TODAY_KEY)

  return (
    <div className="screen">
      <div className="home-top">
        <button className="ava-btn" onClick={() => setProfOpen(true)} aria-label="Аватарки">
          <Ava who="both" size={40} online={here} />
        </button>
        <div className="grow">
          <h1>Мы</h1>
          <p>{days != null ? `${days} ${plural(days, 'день', 'дня', 'дней')} вместе` : `${name('me')} и ${name('him')}`}</p>
        </div>
        <button className="coin-pill shop-pill" onClick={() => s.openShop()} aria-label="Магазин">
          <Img src="coins/coin" /> {s.coins.me}
          <i className="pill-sep" />
          <Img src="nav/shop" />
        </button>
      </div>

      <div>
        <div className="room-wrap">
          <Room tod={tod} pose={pose} fx={fx} onPet={tapPet} bowlFull={pet.satiety >= HUNGRY} toy={toy} bowlHidden={pose === 'eat' && atBowl}
            edit={edit} onEditDone={() => setEdit(false)} walkMs={walkMs} onFloor={onFloor} onPetDrag={d => { if (d) stopEating(); setLifted(d) }}
            carry={lifted || walkMs ? null : carry} />
          {!edit && <HoldHands onJoined={joined} />}
          <div className="room-ui">
            <button className="name-tag" onClick={() => setPetOpen(true)}>
              <span className="lvl"><Img src="pet/ui/level_badge" /><b>{pet.level}</b></span>
              {pet.name}
              {pet.acc && <Img src={ACC_ICON[pet.acc]} className="tag-acc" />}
            </button>
            <div className="tod">
              {(['day', 'evening', 'night'] as Tod[]).map(t => (
                <button key={t} className={t === tod ? 'on' : ''} onClick={() => { setManual(t === auto ? null : t); setAction(null) }} aria-label={t}>
                  <Img src={t === 'day' ? 'common/sun' : t === 'evening' ? 'common/cloud' : 'common/moon'} />
                </button>
              ))}
            </div>
          </div>
          {edit
            ? <button className="arrange on" onClick={() => setEdit(false)}>✓ Готово</button>
            : <WheelButton onOpen={() => setWheelOpen(true)} />}
        </div>
      </div>

      <div className="card stats">
        <div className="stat">
          <div className="row"><Img src="shop/food/bowl_basic" />Сытость</div>
          <Bar value={pet.satiety} color="linear-gradient(90deg,#F5C77A,#F2A27A)" />
          <span className={'stat-note' + (pet.satiety < HUNGRY ? ' warn' : '')}>{hungerNote(pet)}</span>
        </div>
        <div className="stat">
          <div className="row"><Img src="common/heart" />Счастье</div>
          <Bar value={pet.happiness} color="linear-gradient(90deg,#F7B7B2,#E98A86)" />
          <span className={'stat-note' + (pet.happiness < 30 ? ' warn' : '')}>{pet.happiness < 30 ? 'скучает' : pet.happiness >= 80 ? 'доволен' : 'нормально'}</span>
        </div>
        <div className="stat">
          <div className="row"><Img src="common/star" />Опыт</div>
          <Bar value={pet.xp} max={pet.xpNext} color="linear-gradient(90deg,#F8DE96,#E8B04A)" />
          <span className="stat-note">{pet.xp}/{pet.xpNext} до ур. {pet.level + 1}</span>
        </div>
      </div>

      <div className="actions">
        <button className="btn soft" onClick={feed}><Img src="shop/food/bowl_basic" />Покормить<small>{s.game.me?.feed ? `бесплатно ×${s.game.me.feed}` : '−5 монет'}</small></button>
        <button className="btn soft" onClick={play}><Img src="shop/toys/ball" />Поиграть<small>бесплатно</small></button>
        <button className="btn soft" onClick={() => s.openShop()}><Img src="nav/shop" />Магазин<small>{s.coins.me} монет</small></button>
      </div>

      {lastMsg && (
        <div className="inbox">
          <Img src={lastMsg.icon} />
          <div className="grow">
            <b>{lastMsg.text}</b>
            <small>
              {inbox.length > 1 && <><button className="more" onClick={() => setInboxOpen(true)}>и ещё {inbox.length - 1}</button> · </>}
              {agoText(last!.created_at)}
            </small>
          </div>
          <button className="btn sm peach" onClick={() => setTouchOpen(true)}>Ответить</button>
          <button className="x" aria-label="Скрыть" onClick={() => setInbox([])}>×</button>
        </div>
      )}

      <PushNudge />

      <button className="think" onClick={() => setTouchOpen(true)}>
        <Img src="touches/touch_button" />
        <div>
          <b>Думаю о тебе</b>
          <span>Обнять, поцеловать, сказать «скучаю»</span>
        </div>
      </button>

      <SoonCard />

      <DiaryCard />

      <ChallengeCard />

      <HobbyCard />
      <CrownCard />
      <AuctionCard />

      <div className="grid2">
        <PhotoCard />
        <div className="card col" style={{ gap: 6, alignItems: 'center', textAlign: 'center' }}>
          <h3>Встречи</h3>
          <div className="meet"><Img src="meetings/meet_counter" /><b>{s.meetCount}</b></div>
          <span className="small muted b">
            {next ? `следующая через ${diffDays(next, TODAY_KEY)} ${plural(diffDays(next, TODAY_KEY), 'день', 'дня', 'дней')}` : past.length ? `последняя ${human(past[past.length - 1])}` : 'пока не отмечали'}
          </span>
          <button className={'btn sm meet-btn ' + (metToday ? 'soft' : 'sage')} onClick={toggleToday}>{metToday ? 'Вместе ✓' : 'Мы встретились'}</button>
          <button className="linkish" onClick={() => s.go('calendar')}>все встречи в календаре</button>
        </div>
      </div>

      <button className="card row" style={{ textAlign: 'left' }} onClick={() => s.go('board')}>
        <Img src="tracker/sprint_start" size={52} />
        <div className="grow col" style={{ gap: 6 }}>
          <div className="row"><b className="grow">Эта неделя · {weekRange(TODAY_KEY)}</b>{sprint.length > 0 && <span className="small muted b">{done} из {sprint.length}</span>}</div>
          {sprint.length > 0 && <Bar value={done} max={sprint.length} color="linear-gradient(90deg,#C8DDB9,#7FA66E)" />}
          <span className="small muted b">
            {!sprint.length ? 'Добавьте задачи на неделю на доске' : isSunday(TODAY_KEY) ? 'Сегодня воскресенье: итоги недели' : `до конца недели ${daysLeft} ${plural(daysLeft, 'день', 'дня', 'дней')}`}
          </span>
        </div>
      </button>

      <Sheet open={touchOpen} onClose={() => setTouchOpen(false)} title="Думаю о тебе" icon="touches/touch_button">
        <p className="muted b small">{getLink() ? `${g.He} получит сразу, а если приложение закрыто — увидит, когда откроет` : 'Заработает, когда вы будете в паре'}</p>
        <div className="touch-grid">
          {TOUCHES.map(t => (
            <button key={t.id} onClick={() => sendTouch(t)}>
              <Img src={t.icon} />
              {t.name}
            </button>
          ))}
        </div>
      </Sheet>

      {/* Все непрочитанные касания: на главной видно только последнее и «и ещё N» */}
      <Sheet open={inboxOpen && inbox.length > 0} onClose={() => setInboxOpen(false)} title="Непрочитанное" icon="touches/touch_button">
        <div className="inbox-list">
          {[...inbox].reverse().map(e => {
            const m = describe(e, name('him'), s.profile.him.g)
            return m && (
              <div key={e.id} className="row">
                <Img src={m.icon} size={40} />
                <div className="grow col">
                  <b>{m.text}</b>
                  <small>{agoText(e.created_at)}</small>
                </div>
              </div>
            )
          })}
        </div>
        <div className="grid2">
          <button className="btn soft" onClick={() => { setInbox([]); setInboxOpen(false) }}>Прочитано</button>
          <button className="btn peach" onClick={() => { setInboxOpen(false); setTouchOpen(true) }}>Ответить</button>
        </div>
      </Sheet>

      <WheelSheet open={wheelOpen} onClose={() => setWheelOpen(false)} />

      <Sheet open={petOpen} onClose={() => setPetOpen(false)} title={pet.name} icon="pet/ui/level_badge">
        <PetSheet />
      </Sheet>

      <Sheet open={profOpen} onClose={() => setProfOpen(false)} title="Мы" icon="onboarding/ob_pair">
        <ProfileSheet />
      </Sheet>

      {flyer && <img className="flyer" key={flyer.k} src={`assets/${flyer.icon}.webp`} alt="" />}
    </div>
  )
}

function PetSheet() {
  const s = useStore()
  const { pet } = s
  const [preview, setPreview] = useState<'baby' | 'adult'>(pet.stage)
  const [nm, setNm] = useState(pet.name)
  const accs = SHOP.acc.filter(a => s.owned.includes(a.id))
  return (
    <>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <FitPet stage={preview} box={140} />
        <div className="grow col">
          <div className="kv">
            <span>Порода</span><span>Рыжий домашний</span>
            <span>Возраст</span><span>{pet.stage === 'baby' ? 'маленький' : 'взрослый'}</span>
            <span>Уровень</span><span>{pet.level} · {pet.xp}/{pet.xpNext}</span>
          </div>
          <span className="small muted b">Взрослеет на 10 уровне. Опыт = заработанные вами монеты.</span>
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <input className="input grow" maxLength={16} value={nm} placeholder="Имя питомца" onChange={e => setNm(e.target.value)} />
        {nm.trim() && nm.trim() !== pet.name && <button className="btn sm" onClick={() => { s.setPet(p => ({ ...p, name: nm.trim() })); s.toast('Имя сохранено', 'pet/ui/level_badge') }}>Сохранить</button>}
      </div>
      <div className="seg">
        <button className={preview === 'baby' ? 'on' : ''} onClick={() => setPreview('baby')}>Маленький</button>
        <button className={preview === 'adult' ? 'on' : ''} onClick={() => setPreview('adult')}>Взрослый</button>
      </div>
      <div className="sec-title">Надеть</div>
      <div className="grid3">
        <button className={'item mini' + (!pet.acc ? ' owned' : '')} onClick={() => s.setPet(p => ({ ...p, acc: null }))}>
          <Img src="common/cross_badge" />
          <b>Без аксессуара</b>
        </button>
        {accs.map(a => (
          <button key={a.id} className={'item mini' + (pet.acc === a.id ? ' owned' : '')} onClick={() => s.setPet(p => ({ ...p, acc: a.id }))}>
            <Img src={a.icon} />
            <b>{a.name}</b>
          </button>
        ))}
      </div>
      <button className="btn wide" onClick={() => s.openShop('acc')}>Ещё аксессуары <Coin n="100+" /></button>
    </>
  )
}

// Питомец, вписанный по видимой части в квадрат box×box. Если картинки «кот в этой вещи» ещё нет, вещь показана значком рядом.
export function FitPet({ stage, box, pose = 'idle', acc }: { stage: 'baby' | 'adult'; box: number; pose?: Pose; acc?: string | null }) {
  const { pet } = useStore()
  const a = acc === undefined ? pet.acc : acc
  const has = useHasAccArt(pet.breed, a, `${stage}_${pose}`)
  const bb = BBOX[`pet/${pet.breed}/${stage}_${pose}`] ?? [0, 0, 1, 1]
  const canvas = box / Math.max(bb[2] - bb[0], bb[3] - bb[1])
  const cx = ((bb[0] + bb[2]) / 2) * canvas
  return (
    <div style={{ width: box, height: box, flex: 'none', position: 'relative' }}>
      <div style={{ position: 'absolute', width: canvas, left: box / 2 - cx, top: box - bb[3] * canvas }}>
        <PetView pose={pose} stage={stage} acc={a} className="breathe" />
      </div>
      {a && has === false && <Img src={ACC_ICON[a]} className="acc-sticker" style={{ width: box * 0.36, height: box * 0.36 }} />}
    </div>
  )
}
