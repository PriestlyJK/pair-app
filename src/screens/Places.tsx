import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import type { StyleSpecification } from 'maplibre-gl'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, Seg, Ava, PhotoPick, shrinkImage, useName, useG, plural } from '../ui'
import { TODAY_KEY, human } from '../dates'
import { sendEvent } from '../sync'
import { RefImg, dropImg, saveImage, imgUrl } from '../photos'
import { Stars } from './Together'
import { A, type Who } from '../data'

/* Карта мест: где были и куда хотим. Карта — OpenStreetMap через OpenFreeMap (бесплатно, без ключей),
   перекрашенная в тёплые цвета приложения; поиск — Nominatim.
   Документ 'places': у места есть категория, статус (были / хотим), дата, заметка, фото и звёзды каждого.
   «Туман»: карта прикрыта кремовой дымкой, а вокруг мест, где вы были, она рассеивается —
   так ваша карта «прорисовывается» по мере того, как вы где-то бываете. */

export type PlaceCat = 'cafe' | 'food' | 'sweets' | 'bar' | 'walk' | 'fun' | 'culture' | 'music' | 'trip' | 'home' | 'special' | 'other'
type Status = 'been' | 'want'
export interface Place {
  id: number; name: string; lat: number; lng: number; cat: PlaceCat; status: Status; by: Who
  date?: string; note?: string; addr?: string; photos?: string[]; stars?: Partial<Record<Who, number>>
}

export const CATS: { id: PlaceCat; name: string; icon: string }[] = [
  { id: 'cafe', name: 'Кофейни', icon: 'cheatsheet/food/food_coffee' },
  { id: 'food', name: 'Поесть', icon: 'cheatsheet/food/food_fastfood' },
  { id: 'sweets', name: 'Десерты', icon: 'cheatsheet/food/food_sweets' },
  { id: 'bar', name: 'Бары', icon: 'cheatsheet/food/food_drinks' },
  { id: 'walk', name: 'Прогулки', icon: 'common/leaf' },
  { id: 'fun', name: 'Развлечения', icon: 'cheatsheet/people/ppl_friends' },
  { id: 'culture', name: 'Музеи, театры', icon: 'cheatsheet/tastes/taste_books' },
  { id: 'music', name: 'Концерты', icon: 'cheatsheet/tastes/taste_music' },
  { id: 'trip', name: 'Поездки', icon: 'tracker/labels/label_trip' },
  { id: 'home', name: 'Дома', icon: 'shop/furniture/house' },
  { id: 'special', name: 'Особые', icon: 'meetings/meet_place' },
  { id: 'other', name: 'Другое', icon: 'common/star' },
]
const catOf = (c?: string) => CATS.find(x => x.id === c) ?? CATS[CATS.length - 1]
const MAX_PHOTOS = 6

// ---------- Поиск мест (Nominatim, бесплатно; не чаще раза в секунду — ищем только по кнопке) ----------
interface Found { name: string; addr: string; lat: number; lng: number; cat: PlaceCat }
function guessCat(cls = '', type = ''): PlaceCat {
  if (/cafe|coffee/.test(type)) return 'cafe'
  if (/ice_cream|confectionery|bakery|pastry|chocolate/.test(type)) return 'sweets'
  if (/restaurant|fast_food|food_court|pizza/.test(type)) return 'food'
  if (/bar|pub|biergarten|nightclub/.test(type)) return 'bar'
  if (/park|garden|forest|wood|beach|water|peak|nature_reserve|viewpoint|promenade|pedestrian|footway|square/.test(type) || cls === 'natural' || cls === 'leisure') return 'walk'
  if (/museum|theatre|gallery|arts_centre|library|artwork|monument|memorial|castle/.test(type) || cls === 'historic') return 'culture'
  if (/concert|music|stadium/.test(type)) return 'music'
  if (/cinema|bowling|amusement|zoo|aquarium|theme_park|escape|sports|water_park|attraction/.test(type)) return 'fun'
  if (/hotel|hostel|guest_house|motel|city|town|village|station|aerodrome|airport/.test(type) || cls === 'place' || cls === 'boundary') return 'trip'
  return 'other'
}
type NomRow = { name?: string; display_name: string; lat: string; lon: string; category?: string; type?: string }
const shortAddr = (d: string, name?: string) => d.split(', ').filter(x => x !== name).slice(0, 3).join(', ')
const toFound = (x: NomRow): Found => ({ name: x.name || x.display_name.split(',')[0], addr: shortAddr(x.display_name, x.name), lat: +x.lat, lng: +x.lon, cat: guessCat(x.category, x.type) })
const NOM = 'https://nominatim.openstreetmap.org'
async function searchPlaces(q: string, view?: L.LatLngBounds): Promise<Found[]> {
  const ps = new URLSearchParams({ format: 'jsonv2', q, limit: '8', 'accept-language': 'ru,uk,en' })
  if (view) { ps.set('viewbox', [view.getWest(), view.getNorth(), view.getEast(), view.getSouth()].map(n => n.toFixed(4)).join(',')); ps.set('bounded', '0') }
  const r = await fetch(`${NOM}/search?${ps}`)
  if (!r.ok) throw new Error(String(r.status))
  const seen = new Set<string>()
  return ((await r.json()) as NomRow[]).map(toFound).filter(f => { const k = f.name + '|' + f.addr; return !seen.has(k) && !!seen.add(k) })
}
async function whatIsHere(lat: number, lng: number): Promise<Found> {
  try {
    const r = await fetch(`${NOM}/reverse?${new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', 'accept-language': 'ru,uk,en' })}`)
    const x = (await r.json()) as NomRow
    return { ...toFound(x), lat, lng }
  } catch {
    return { name: '', addr: '', lat, lng, cat: 'other' }
  }
}

// ---------- Карта ----------
// Стиль OpenFreeMap «Positron», перекрашенный под приложение: серое → тёплое кремовое, вода голубая, парки шалфейные
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const OVERRIDE: Record<string, Record<string, string>> = {
  background: { 'background-color': '#F7ECDD' },
  water: { 'fill-color': '#BEDCEA' },
  waterway: { 'line-color': '#A9D0E2' },
  park: { 'fill-color': '#E0EACF' },
  landcover_wood: { 'fill-color': '#D5E3C2' },
  water_name_point_label: { 'text-color': '#4E7E98' },
  water_name_line_label: { 'text-color': '#4E7E98' },
  waterway_line_label: { 'text-color': '#5F8DA6' },
}
function parseColor(c: string): [number, number, number, number] | null {
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c)
  if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, x => x + x) : m[1]; return rgbToHsl(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1) }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c)
  if (m) return rgbToHsl(+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4])
  m = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(c)
  if (m) return [+m[1], +m[2] / 100, +m[3] / 100, m[4] == null ? 1 : +m[4]]
  return null
}
function rgbToHsl(r: number, g: number, b: number, a: number): [number, number, number, number] {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn
  if (!d) return [0, 0, l, a]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, s, l, a]
}
// Серые цвета стиля → тёплые: светлые становятся кремовыми, тёмные (подписи) — шоколадными
function warm(c: string): string {
  const v = parseColor(c)
  if (!v) return c
  const [, sat, l, a] = v
  if (sat > 0.2) return c
  const nl = l < 0.5 ? Math.max(l, 0.24) : l
  const ns = l < 0.5 ? 0.3 : l > 0.97 ? 0.6 : 0.42
  return `hsla(${l < 0.5 ? 18 : 30}, ${Math.round(ns * 100)}%, ${Math.round(nl * 100)}%, ${a})`
}
const warmAll = (v: unknown): unknown => (typeof v === 'string' ? warm(v) : Array.isArray(v) ? v.map(warmAll) : v)
let styleCache: Promise<StyleSpecification> | null = null
function warmStyle() {
  styleCache ??= fetch(STYLE_URL).then(r => r.json()).then((st: StyleSpecification) => {
    st.layers = st.layers.map(l => {
      const paint = Object.fromEntries(Object.entries((l as { paint?: object }).paint ?? {}).map(([k, v]) => [k, /color/.test(k) ? warmAll(v) : v]))
      Object.assign(paint, OVERRIDE[l.id])
      const out = { ...l, paint } as typeof l
      // Подписи — на местном языке (в Украине по-украински), без латинского дубля
      if (l.type === 'symbol' && l.layout && JSON.stringify(l.layout['text-field'] ?? '').includes('name')) {
        out.layout = { ...l.layout, 'text-field': ['coalesce', ['get', 'name:uk'], ['get', 'name'], ['get', 'name_en']] } as typeof l.layout
      }
      return out
    })
    return st
  }).catch(e => { styleCache = null; throw e })
  return styleCache
}

const metersPerPx = (lat: number, z: number) => (40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) / 2 ** (z + 8)
function ring(lat: number, lng: number, r: number): L.LatLngTuple[] {
  const dLat = r / 111320, dLng = r / (111320 * Math.cos((lat * Math.PI) / 180))
  return Array.from({ length: 40 }, (_, i) => { const a = (i / 40) * 2 * Math.PI; return [lat + dLat * Math.sin(a), lng + dLng * Math.cos(a)] })
}
function pinIcon(p: Place, photo?: string | null) {
  const cls = `pin ${p.status}${photo ? ' photo' : ''}`
  return L.divIcon({
    className: 'pin-wrap',
    html: photo ? `<div class="${cls}"><img src="${photo}" alt=""></div>` : `<div class="${cls}"><img src="${A(catOf(p.cat).icon)}" alt=""></div>`,
    iconSize: photo ? [48, 56] : [40, 48],
    iconAnchor: photo ? [24, 56] : [20, 46],
  })
}

function PlacesMap({ places, fog, pick, onPick, onOpen, onView, focus }: {
  places: Place[]; fog: boolean; pick: boolean; onPick: (lat: number, lng: number) => void; onOpen: (id: number) => void
  onView: (b: L.LatLngBounds) => void; focus: { lat: number; lng: number; n: number } | null
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef<L.LayerGroup | null>(null)
  const veil = useRef<L.Polygon | null>(null)
  const trail = useRef<L.Polyline | null>(null)
  const fitted = useRef(false)
  const [noMap, setNoMap] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const cb = useRef({ onPick, onOpen, onView, pick })
  cb.current = { onPick, onOpen, onView, pick }

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, worldCopyJump: true }).setView([48.6, 31.2], 5)
    m.attributionControl.addAttribution('<a href="https://openfreemap.org">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
    let gone = false
    warmStyle()
      .then(style => {
        if (gone) return
        const gl = maplibreGL({ style, attributionControl: false }).addTo(m)
        // Карта «проявляется», когда нарисована
        gl.getMaplibreMap().once('idle', () => { if (!gone) { gl.getContainer().classList.add('drawn'); setDrawn(true) } })
      })
      .catch(() => { if (!gone) setNoMap(true) })
    m.attributionControl.setPrefix(false)
    m.createPane('veil').style.zIndex = '350'
    pins.current = L.layerGroup().addTo(m)
    m.on('click', e => { if (cb.current.pick) cb.current.onPick(e.latlng.lat, e.latlng.lng) })
    // Поиск сначала ищет рядом с тем, что видно на карте
    m.on('moveend', () => cb.current.onView(m.getBounds()))
    map.current = m
    const t = setTimeout(() => m.invalidateSize(), 350)
    return () => { gone = true; clearTimeout(t); m.remove(); map.current = null; fitted.current = false }
  }, [])

  // Значки мест: иконка категории или первое фото «полароидом»
  useEffect(() => {
    const m = map.current, g = pins.current
    if (!m || !g) return
    g.clearLayers()
    let alive = true
    for (const p of places) {
      const mk = L.marker([p.lat, p.lng], { icon: pinIcon(p), riseOnHover: true, zIndexOffset: p.status === 'been' ? 100 : 0 })
      mk.on('click', () => cb.current.onOpen(p.id))
      g.addLayer(mk)
      const ref = p.photos?.[0]
      if (ref) imgUrl(ref).then(u => { if (alive && u) mk.setIcon(pinIcon(p, u)) })
    }
    if (!fitted.current && places.length) {
      fitted.current = true
      if (places.length === 1) m.setView([places[0].lat, places[0].lng], 14)
      else m.fitBounds(L.latLngBounds(places.map(p => [p.lat, p.lng] as L.LatLngTuple)).pad(0.25), { maxZoom: 15 })
    }
    return () => { alive = false }
  }, [places])

  // Туман и пунктир «наш путь» — по местам, где вы уже были
  useEffect(() => {
    const m = map.current
    if (!m) return
    const been = places.filter(p => p.status === 'been')
    const renderer = L.svg({ padding: 0.6, pane: 'veil' })
    const draw = () => {
      veil.current?.remove(); veil.current = null
      if (!fog) return
      const z = m.getZoom()
      const holes = been.map(p => ring(p.lat, p.lng, Math.max(300, 50 * metersPerPx(p.lat, z))))
      const world: L.LatLngTuple[] = [[85, -900], [85, 900], [-85, 900], [-85, -900]]
      veil.current = L.polygon([world, ...holes], { pane: 'veil', renderer, stroke: false, fillColor: '#E8D7C2', fillOpacity: 0.74, interactive: false }).addTo(m)
    }
    draw()
    m.on('zoomend', draw)
    trail.current?.remove(); trail.current = null
    const pts = been.filter(p => p.date).sort((a, b) => (a.date! < b.date! ? -1 : 1)).map(p => [p.lat, p.lng] as L.LatLngTuple)
    if (pts.length >= 2) trail.current = L.polyline(pts, { color: '#E0846C', weight: 3, opacity: 0.8, dashArray: '1 9', lineCap: 'round', interactive: false }).addTo(m)
    return () => { m.off('zoomend', draw); veil.current?.remove(); veil.current = null }
  }, [places, fog])

  useEffect(() => { if (focus && map.current) map.current.flyTo([focus.lat, focus.lng], Math.max(map.current.getZoom(), 15), { duration: 0.8 }) }, [focus])

  return (
    <>
      <div ref={el} className={'leaf' + (pick ? ' picking' : '')} />
      {!drawn && !noMap && <div className="map-off drawing"><Img src="cheatsheet/dreams/dream_travel" size={56} />Рисую карту…</div>}
      {noMap && <div className="map-off"><Img src="states/st_offline" size={56} />Карта не загрузилась — нет связи. Места и фото на месте.</div>}
    </>
  )
}

// ---------- Экран ----------
type Filter = 'all' | Status
type Draft = Omit<Place, 'id' | 'by'> & { id?: number; by?: Who; added: string[] }

export default function Places() {
  const s = useStore()
  const g = useG()
  const name = useName()
  const [places, setPlaces] = usePersist<Place[]>('places', [])
  const [fog, setFog] = useState(() => { try { return localStorage.getItem('pair.fog') !== '0' } catch { return true } })
  const [filter, setFilter] = useState<Filter>('all')
  const [cat, setCat] = useState<PlaceCat | 'all'>('all')
  const [pick, setPick] = useState(false)
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[] | null>(null)
  const [busy, setBusy] = useState<'' | 'search' | 'here' | 'photo'>('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [big, setBig] = useState<string | null>(null)
  const mapBox = useRef<HTMLDivElement>(null)
  const viewRef = useRef<L.LatLngBounds | undefined>(undefined)

  const place = places.find(p => p.id === open) ?? null
  const been = places.filter(p => p.status === 'been')
  const list = places
    .filter(p => (filter === 'all' || p.status === filter) && (cat === 'all' || p.cat === cat))
    .sort((a, b) => (a.status !== b.status ? (a.status === 'been' ? -1 : 1) : (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id))
  const cats = CATS.filter(c => places.some(p => p.cat === c.id && (filter === 'all' || p.status === filter)))
  const patch = (id: number, f: (p: Place) => Place) => setPlaces(xs => xs.map(x => (x.id === id ? f(x) : x)))

  function toggleFog() {
    setFog(v => { try { localStorage.setItem('pair.fog', v ? '0' : '1') } catch { /* нет доступа */ } return !v })
  }
  function startDraft(f: Found) {
    setAdding(false); setPick(false); setFound(null); setQ('')
    setDraft({ name: f.name, addr: f.addr, lat: f.lat, lng: f.lng, cat: f.cat, status: 'been', date: TODAY_KEY, added: [] })
    setFocus({ lat: f.lat, lng: f.lng, n: Date.now() })
  }
  async function doSearch() {
    if (!q.trim()) return
    setBusy('search'); setFound(null)
    try { setFound(await searchPlaces(q.trim(), viewRef.current)) } catch { s.toast('Поиск не ответил — попробуй ещё раз', 'states/st_offline') }
    setBusy('')
  }
  function hereNow() {
    if (!navigator.geolocation) { s.toast('Телефон не даёт узнать место', 'states/st_error'); return }
    setBusy('here')
    navigator.geolocation.getCurrentPosition(
      async pos => { const f = await whatIsHere(pos.coords.latitude, pos.coords.longitude); setBusy(''); startDraft(f) },
      () => { setBusy(''); s.toast('Не получилось узнать, где ты. Разреши доступ к геопозиции', 'states/st_error') },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }
  async function pickPoint(lat: number, lng: number) {
    setPick(false)
    startDraft(await whatIsHere(lat, lng))
  }
  async function addPhoto(f: File, onRef: (ref: string) => void) {
    setBusy('photo')
    try {
      const ref = await saveImage(`place-${Date.now()}`, await shrinkImage(f, 1080, false, 0.75))
      if (ref) onRef(ref)
      else s.toast('Нет связи — фото не отправилось', 'states/st_offline')
    } catch { s.toast('Не получилось открыть фото', 'states/st_error') }
    setBusy('')
  }
  function closeDraft(saved: boolean) {
    // Отменили новое место — фото, которые успели загрузить, убираем
    if (!saved && draft) draft.added.forEach(r => dropImg(r))
    setDraft(null)
  }
  function saveDraft() {
    if (!draft || !draft.name.trim()) { s.toast('Как назовём это место?', 'common/star'); return }
    const { added: _a, id, by, ...rest } = draft
    void _a
    const v: Place = { ...rest, name: draft.name.trim(), note: draft.note?.trim() || undefined, date: draft.status === 'been' ? draft.date || TODAY_KEY : undefined, id: id ?? Date.now(), by: by ?? 'me' }
    if (id) setPlaces(xs => xs.map(x => (x.id === id ? v : x)))
    else {
      setPlaces(xs => [...xs, v])
      sendEvent('place', { name: v.name, status: v.status })
      s.toast(v.status === 'been' ? `На карте: ${v.name}` : `${g.He} увидит, куда ты хочешь`, catOf(v.cat).icon)
    }
    closeDraft(true)
    setOpen(v.id)
    setFocus({ lat: v.lat, lng: v.lng, n: Date.now() })
  }
  function remove(p: Place) {
    p.photos?.forEach(r => dropImg(r))
    setPlaces(xs => xs.filter(x => x.id !== p.id))
    setOpen(null)
    s.toast('Место убрано с карты', 'common/cross_badge')
  }
  const mapsLink = (p: Place) => /iPhone|iPad|Mac/.test(navigator.userAgent)
    ? `https://maps.apple.com/?ll=${p.lat},${p.lng}&q=${encodeURIComponent(p.name)}`
    : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`

  return (
    <div className="screen">
      <Header title="Карта мест" sub="Где были и куда хотим" icon="cheatsheet/dreams/dream_travel" onBack={() => s.go('together')} />

      <div className="map-box" ref={mapBox}>
        <PlacesMap places={places} fog={fog} pick={pick} onPick={pickPoint} focus={focus}
          onOpen={id => { setOpen(id); setPick(false) }} onView={b => (viewRef.current = b)} />
        <div className="map-ctrl">
          <button className={fog ? 'on' : ''} onClick={toggleFog} aria-label="Туман"><Img src="common/cloud" /></button>
        </div>
        <div className="map-count">
          {been.length ? <>Открыто {been.length} {plural(been.length, 'место', 'места', 'мест')}</> : 'Отмечайте, где были, — туман рассеется'}
        </div>
        {pick && (
          <div className="map-hint">
            <b>Нажми на карту, где это место</b>
            <button className="btn sm soft" onClick={() => setPick(false)}>Отмена</button>
          </div>
        )}
      </div>

      <div className="chips">
        {([['all', 'Все'], ['been', 'Были'], ['want', 'Хотим']] as [Filter, string][]).map(([id, nm]) => (
          <button key={id} className={'chip' + (filter === id ? ' on' : '')} onClick={() => { setFilter(id); setCat('all') }}>
            {nm} · {id === 'all' ? places.length : places.filter(p => p.status === id).length}
          </button>
        ))}
      </div>
      {cats.length > 1 && (
        <div className="chips">
          <button className={'chip sm' + (cat === 'all' ? ' on' : '')} onClick={() => setCat('all')}>Все категории</button>
          {cats.map(c => (
            <button key={c.id} className={'chip sm' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}><Img src={c.icon} />{c.name}</button>
          ))}
        </div>
      )}

      <div className="col" style={{ gap: 10 }}>
        {list.map(p => (
          <button key={p.id} className="place-it" onClick={() => { setOpen(p.id); setFocus({ lat: p.lat, lng: p.lng, n: Date.now() }) }}>
            <div className={'place-thumb ' + p.status}>
              {p.photos?.[0] ? <RefImg src={p.photos[0]} /> : <Img src={catOf(p.cat).icon} />}
            </div>
            <div className="grow col" style={{ gap: 3, textAlign: 'left' }}>
              <b>{p.name}</b>
              <span className="small muted b">{catOf(p.cat).name}{p.status === 'been' ? (p.date ? ` · ${human(p.date)}` : '') : ' · хотим сходить'}</span>
              {p.status === 'been' && (p.stars?.me || p.stars?.him) ? (
                <span className="row" style={{ gap: 8 }}>
                  {(['me', 'him'] as Who[]).map(w => p.stars?.[w] ? <span key={w} className="row" style={{ gap: 3 }}><Ava who={w} size={16} /><Stars n={p.stars[w]} size={13} /></span> : null)}
                </span>
              ) : null}
            </div>
            {(p.photos?.length ?? 0) > 1 && <span className="small muted b">{p.photos!.length} фото</span>}
          </button>
        ))}
        {!list.length && (
          <div className="empty-col">
            <Img src="cheatsheet/dreams/dream_travel" />
            {places.length ? 'Здесь пусто — смени фильтр' : 'Добавьте первое место: кофейню, где сидели, парк, город, куда ездили, или то, куда хотите сходить'}
          </div>
        )}
      </div>

      <button className="fab" onClick={() => { setAdding(true); setFound(null) }} aria-label="Добавить место">+</button>

      {/* Новое место: поиск, точка на карте или «я здесь» */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Новое место" icon="cheatsheet/dreams/dream_travel">
        <div className="search-box">
          <input className="input" type="search" enterKeyHint="search" placeholder="Название или адрес" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSearch() }} />
        </div>
        <button className="btn wide" onClick={doSearch} disabled={busy === 'search'}>{busy === 'search' ? 'Ищу…' : 'Найти'}</button>
        {found && (
          <div className="col" style={{ gap: 6 }}>
            {found.map((f, i) => (
              <button key={i} className="found" onClick={() => startDraft(f)}>
                <Img src={catOf(f.cat).icon} size={30} />
                <span className="grow col" style={{ textAlign: 'left' }}><b>{f.name}</b><small className="muted b">{f.addr}</small></span>
              </button>
            ))}
            {!found.length && <p className="small muted b center">Ничего не нашлось. Попробуй добавить город или поставь точку на карте.</p>}
          </div>
        )}
        <div className="grid2">
          <button className="btn soft" onClick={() => { setAdding(false); setPick(true); mapBox.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }}>Точка на карте</button>
          <button className="btn soft" onClick={hereNow} disabled={busy === 'here'}>{busy === 'here' ? 'Ищу тебя…' : 'Я сейчас здесь'}</button>
        </div>
      </Sheet>

      {/* Форма места: новое или правка */}
      <Sheet open={!!draft} onClose={() => closeDraft(false)} title={draft?.id ? 'Изменить место' : 'Добавить на карту'} icon={catOf(draft?.cat).icon} tall>
        {draft && (
          <>
            <input className="input" placeholder="Как назовём" maxLength={60} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            {draft.addr && <span className="small muted b" style={{ marginTop: -4 }}>{draft.addr}</span>}
            <Seg value={draft.status} onChange={v => setDraft({ ...draft, status: v })} options={[{ id: 'been', name: 'Мы тут были' }, { id: 'want', name: 'Хотим сюда' }]} />
            {draft.status === 'been' && (
              <label className="field"><span>Когда</span>
                <input className="input date-in" type="date" max={TODAY_KEY} value={draft.date ?? ''} onChange={e => setDraft({ ...draft, date: e.target.value })} />
              </label>
            )}
            <div className="cat-grid">
              {CATS.map(c => (
                <button key={c.id} className={draft.cat === c.id ? 'on' : ''} onClick={() => setDraft({ ...draft, cat: c.id })}>
                  <Img src={c.icon} /><span>{c.name}</span>
                </button>
              ))}
            </div>
            {draft.status === 'been' && (
              <div className="row" style={{ gap: 8 }}>
                <span className="small muted b">Твоя оценка</span>
                <Stars n={draft.stars?.me} size={28} onPick={n => setDraft({ ...draft, stars: { ...draft.stars, me: n || undefined } })} />
              </div>
            )}
            <div className="photo-row">
              {(draft.photos ?? []).map(r => (
                <div key={r} className="ph-mini">
                  <RefImg src={r} />
                  <button className="x-btn" aria-label="Убрать фото" onClick={() => { setDraft({ ...draft, photos: draft.photos!.filter(x => x !== r) }); if (draft.added.includes(r)) dropImg(r) }}>×</button>
                </div>
              ))}
              {(draft.photos?.length ?? 0) < MAX_PHOTOS && (
                <PhotoPick className="ph-mini add" onPick={f => addPhoto(f, ref => setDraft(d => d && { ...d, photos: [...(d.photos ?? []), ref], added: [...d.added, ref] }))}>
                  <Img src="common/camera" size={26} /><small>{busy === 'photo' ? '…' : 'фото'}</small>
                </PhotoPick>
              )}
            </div>
            <input className="input" maxLength={120} placeholder="Заметка (можно пропустить)" value={draft.note ?? ''} onChange={e => setDraft({ ...draft, note: e.target.value })} />
            <button className="btn wide" onClick={saveDraft} disabled={busy === 'photo'}>Сохранить</button>
          </>
        )}
      </Sheet>

      {/* Карточка места */}
      <Sheet open={!!place && !draft} onClose={() => setOpen(null)} title={place?.name} icon={catOf(place?.cat).icon} tall>
        {place && (
          <>
            <span className="small muted b">
              {catOf(place.cat).name} · {place.status === 'been' ? (place.date ? human(place.date) : 'были') : 'хотим сходить'} · {place.by === 'me' ? `${g.m('добавил', 'добавила')} ты` : `${g.p('добавил', 'добавила')} ${name('him')}`}
            </span>
            {place.addr && <span className="small b">{place.addr}</span>}
            {!!place.photos?.length && (
              <div className="place-photos">
                {place.photos.map(r => <button key={r} onClick={() => setBig(r)}><RefImg src={r} /></button>)}
              </div>
            )}
            {place.note && <p className="b" style={{ margin: 0 }}>«{place.note}»</p>}
            {place.status === 'been' && (
              <div className="col" style={{ gap: 6 }}>
                {(['me', 'him'] as Who[]).map(w => (
                  <div key={w} className="row" style={{ gap: 8 }}>
                    <Ava who={w} size={22} />
                    {w === 'me'
                      ? <Stars n={place.stars?.me} size={24} onPick={n => patch(place.id, p => ({ ...p, stars: { ...p.stars, me: n || undefined } }))} />
                      : place.stars?.him ? <Stars n={place.stars.him} size={24} /> : <span className="small muted b">ещё не {g.p('оценил', 'оценила')}</span>}
                  </div>
                ))}
              </div>
            )}
            {place.status === 'want' && (
              <button className="btn wide sage" onClick={() => { patch(place.id, p => ({ ...p, status: 'been', date: TODAY_KEY })); sendEvent('place', { name: place.name, status: 'been' }); s.toast('Были! Туман тут рассеялся', 'cheatsheet/dreams/dream_travel') }}>
                Мы тут были!
              </button>
            )}
            <div className="grid2">
              {(place.photos?.length ?? 0) < MAX_PHOTOS
                ? <PhotoPick className="btn soft" onPick={f => addPhoto(f, ref => patch(place.id, p => ({ ...p, photos: [...(p.photos ?? []), ref] })))}>{busy === 'photo' ? 'Загружаю…' : '+ Фото'}</PhotoPick>
                : <span />}
              <a className="btn soft" href={mapsLink(place)} target="_blank" rel="noreferrer">Маршрут</a>
            </div>
            <div className="grid2">
              <button className="btn soft" onClick={() => setDraft({ ...place, added: [] })}>Изменить</button>
              <button className="btn soft" onClick={() => remove(place)}>Убрать с карты</button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!big} onClose={() => setBig(null)}>
        {big && (
          <div className="col" style={{ gap: 8 }}>
            <RefImg src={big} className="big-photo" />
            {place && place.photos?.includes(big) && (
              <button className="btn soft" onClick={() => { patch(place.id, p => ({ ...p, photos: p.photos!.filter(x => x !== big) })); dropImg(big); setBig(null) }}>Убрать это фото</button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}
