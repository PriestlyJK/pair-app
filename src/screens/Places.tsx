import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet'
import type { LayerSpecification, StyleSpecification, MapGeoJSONFeature } from 'maplibre-gl'
import { useStore, usePersist } from '../store'
import { Img, Header, Sheet, Seg, Ava, PhotoPick, shrinkImage, useName, useG, plural } from '../ui'
import { TODAY_KEY, human } from '../dates'
import { sendEvent } from '../sync'
import { RefImg, dropImg, saveImage, imgUrl } from '../photos'
import { Stars } from './Together'
import { A, type Who } from '../data'

/* Карта мест: где были и куда хотим. Карта — OpenStreetMap через OpenFreeMap (бесплатно, без ключей),
   перекрашенная в тёплые цвета приложения; поиск — Photon и Nominatim.
   Документ 'places': у места есть категория, статус (были / хотим), дата, заметка, фото и звёзды каждого.
   «Туман»: карта прикрыта кремовой дымкой, а вокруг мест, где вы были, она рассеивается —
   так ваша карта «прорисовывается» по мере того, как вы где-то бываете. */

export type PlaceCat = 'cafe' | 'food' | 'sweets' | 'bar' | 'shop' | 'walk' | 'fun' | 'culture' | 'music' | 'trip' | 'home' | 'special' | 'other'
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
  { id: 'shop', name: 'Шопинг', icon: 'cheatsheet/gifts/gift_brands' },
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

// ---------- Поиск мест ----------
/* Photon (komoot) — ищет «по-человечески», с опечатками и рядом с тобой; Nominatim — запасной.
   Названия на карте в Украине записаны по-украински («Мост-Сіті»), а пишем мы часто по-русски
   («мост сити»), поэтому ищем сразу два варианта: как написано и «по-украински». */
export interface Found { name: string; addr: string; lat: number; lng: number; cat: PlaceCat; cc?: string }
function guessCat(cls = '', type = ''): PlaceCat {
  if (/cafe|coffee/.test(type)) return 'cafe'
  if (/ice_cream|confectionery|bakery|pastry|chocolate/.test(type)) return 'sweets'
  if (/restaurant|fast_food|food_court|pizza/.test(type)) return 'food'
  if (/bar|pub|biergarten|nightclub|beer|alcohol/.test(type)) return 'bar'
  if (/mall|department_store|clothes|clothing|shoes|boutique|gift|jewelry|cosmetics|perfumery|fashion|books|florist|marketplace|shop|commercial|retail/.test(type) || cls === 'shop') return 'shop'
  if (/park|garden|forest|wood|beach|water|peak|nature_reserve|viewpoint|promenade|pedestrian|footway|square|picnic/.test(type) || cls === 'natural' || cls === 'leisure') return 'walk'
  if (/museum|theatre|gallery|arts_centre|library|artwork|monument|memorial|castle/.test(type) || cls === 'historic') return 'culture'
  if (/concert|music|stadium/.test(type)) return 'music'
  if (/cinema|bowling|amusement|zoo|aquarium|theme_park|escape|sports|water_park|attraction|playground/.test(type)) return 'fun'
  if (/hotel|hostel|guest_house|motel|lodging|city|town|village|station|aerodrome|airport/.test(type) || cls === 'place' || cls === 'boundary') return 'trip'
  return 'other'
}

// Русское написание → украинское: и→і, ы→и, э→е, ё→е, ъ→ʼ, плюс крупные города
const CITY_UK: Record<string, string> = {
  киев: 'київ', львов: 'львів', харьков: 'харків', одесса: 'одеса', днепр: 'дніпро', днепропетровск: 'дніпро',
  запорожье: 'запоріжжя', винница: 'вінниця', 'ивано-франковск': 'івано-франківськ', черновцы: 'чернівці',
  чернигов: 'чернігів', ровно: 'рівне', тернополь: 'тернопіль', луцк: 'луцьк', хмельницкий: 'хмельницький',
  николаев: 'миколаїв', сумы: 'суми', житомир: 'житомир', ужгород: 'ужгород', полтава: 'полтава',
  кропивницкий: 'кропивницький', черкассы: 'черкаси', кривой: 'кривий', рог: 'ріг', карпаты: 'карпати',
}
export function toUk(q: string) {
  return q.toLowerCase().replace(/[а-яёіїєґʼ'-]+/g, w => CITY_UK[w] ?? w.replace(/и/g, 'і').replace(/ы/g, 'и').replace(/э/g, 'е').replace(/ё/g, 'е').replace(/ъ/g, 'ʼ'))
}

// Точка, рядом с которой ищем: приближенная карта → последнее «я здесь» → ваши места → центр Украины
export interface Bias { lat: number; lng: number; zoom: number }
const UA_CENTER: Bias = { lat: 48.6, lng: 31.2, zoom: 6 }
export function rememberHere(lat: number, lng: number) { try { localStorage.setItem('pair.here', JSON.stringify({ lat, lng, at: Date.now() })) } catch { /* нет доступа */ } }
function lastHere(): Bias | null {
  try { const h = JSON.parse(localStorage.getItem('pair.here') ?? 'null'); return h ? { lat: h.lat, lng: h.lng, zoom: 12 } : null } catch { return null }
}
function biasFor(view: { center: L.LatLng; zoom: number } | undefined, places: Place[]): Bias {
  if (view && view.zoom >= 9) return { lat: view.center.lat, lng: view.center.lng, zoom: view.zoom }
  const h = lastHere()
  if (h) return h
  const last = [...places].sort((a, b) => b.id - a.id)[0]
  if (last) return { lat: last.lat, lng: last.lng, zoom: 10 }
  return UA_CENTER
}
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }
async function photon(q: string, b: Bias, signal?: AbortSignal): Promise<Found[]> {
  const ps = new URLSearchParams({ q, limit: '10', lat: b.lat.toFixed(4), lon: b.lng.toFixed(4), zoom: String(Math.round(Math.min(b.zoom, 14))), location_bias_scale: '0.3' })
  const r = await fetch(`https://photon.komoot.io/api/?${ps}`, { signal })
  if (!r.ok) throw new Error(String(r.status))
  const d = (await r.json()) as { features: PhotonFeature[] }
  return d.features.filter(f => f.properties.name).map(f => {
    const p = f.properties
    const street = [p.street, p.housenumber].filter(Boolean).join(', ')
    const addr = [street, p.city ?? p.town ?? p.village ?? p.district, p.city ? undefined : p.state, p.countrycode !== 'UA' ? p.country : undefined].filter(Boolean).join(', ')
    return { name: p.name!, addr, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], cat: guessCat(p.osm_key, `${p.osm_value} ${p.osm_key}`), cc: p.countrycode }
  })
}

type NomRow = { name?: string; display_name: string; lat: string; lon: string; category?: string; type?: string }
const shortAddr = (d: string, name?: string) => d.split(', ').filter(x => x !== name).slice(0, 3).join(', ')
const toFound = (x: NomRow): Found => ({ name: x.name || x.display_name.split(',')[0], addr: shortAddr(x.display_name, x.name), lat: +x.lat, lng: +x.lon, cat: guessCat(x.category, x.type) })
const NOM = 'https://nominatim.openstreetmap.org'
async function nominatim(q: string, b: Bias, signal?: AbortSignal): Promise<Found[]> {
  const d = b.zoom >= 9 ? 0.6 : 6
  const ps = new URLSearchParams({ format: 'jsonv2', q, limit: '8', 'accept-language': 'ru,uk,en', viewbox: [b.lng - d, b.lat + d, b.lng + d, b.lat - d].map(n => n.toFixed(4)).join(','), bounded: '0' })
  const r = await fetch(`${NOM}/search?${ps}`, { signal })
  if (!r.ok) throw new Error(String(r.status))
  return ((await r.json()) as NomRow[]).map(toFound)
}

// Оба варианта написания сразу, без повторов; сначала то, что рядом, потом по стране, потом остальное
async function searchPlaces(q: string, b: Bias, deep: boolean, signal?: AbortSignal): Promise<Found[]> {
  const uk = toUk(q)
  const tries = [photon(uk, b, signal), uk !== q.toLowerCase() ? photon(q, b, signal) : Promise.resolve([])]
  const got = await Promise.allSettled(tries)
  let all = got.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
  // Nominatim — только по кнопке «Найти» (у него лимит: раз в секунду) и если Photon ничего не дал
  if (deep && !all.length) all = await nominatim(q, b, signal).catch(() => [])
  if (!all.length && got.every(r => r.status === 'rejected')) throw new Error('offline')
  const seen = new Set<string>()
  const uniq = all.filter(f => { const k = `${f.name}|${f.lat.toFixed(3)}|${f.lng.toFixed(3)}`; return !seen.has(k) && !!seen.add(k) })
  // Своя страна — та, где ближайший к тебе результат (обычно Украина)
  const near = b.zoom >= 9 ? 60 : 250
  const home = [...uniq].filter(f => f.cc).sort((x, y) => km(b, x) - km(b, y))[0]?.cc ?? 'UA'
  const rank = (f: Found) => { const d = km(b, f); return d <= near ? 0 : f.cc === home || (!f.cc && d <= 900) ? 1 : 2 }
  const ranked = uniq.map((f, i) => ({ f, i, r: rank(f) })).sort((x, y) => x.r - y.r || x.i - y.i)
  // Есть что-то рядом или в своей стране — далёкое показываем не больше двух
  const local = ranked.filter(x => x.r < 2).length
  return (local ? [...ranked.filter(x => x.r < 2), ...ranked.filter(x => x.r === 2).slice(0, 2)] : ranked).map(x => x.f).slice(0, 8)
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
// Кафе, магазины, парки и др. на карте (как в стиле OpenFreeMap «Liberty»), с подписями в тон приложения
const POI_IDS = ['poi_r1', 'poi_r7', 'poi_r20']
const NAME_FIELD = ['coalesce', ['get', 'name:uk'], ['get', 'name'], ['get', 'name_en']]
// Не для свиданий: остановки, аптеки, больницы, банки, парковки и т.п. — их не показываем
const POI_SKIP = ['bus', 'railway', 'railway_light', 'railway_metro', 'parking', 'parking_garage', 'fuel', 'car', 'hospital', 'doctors',
  'dentist', 'pharmacy', 'police', 'post', 'bank', 'school', 'college', 'fire_station', 'prison', 'toilets', 'laundry', 'office',
  'town_hall', 'veterinary', 'hairdresser', 'atm', 'cemetery', 'grave_yard', 'information', 'entrance', 'bicycle_rental', 'kindergarten', 'shelter']
function poiLayers(): LayerSpecification[] {
  const layer = (id: string, minzoom: number, rank: unknown[]) => ({
    id, type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom,
    filter: ['all', ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false], ['!', ['match', ['get', 'class'], POI_SKIP, true, false]], ...rank],
    layout: {
      'icon-image': ['coalesce', ['image', ['get', 'subclass']], ['image', ['get', 'class']], ['image', 'dot_11']],
      'text-field': NAME_FIELD, 'text-font': ['Noto Sans Regular'], 'text-size': 11.5, 'text-max-width': 8,
      'text-anchor': 'top', 'text-offset': [0, 0.7], 'text-optional': true,
    },
    paint: { 'text-color': '#7A5040', 'text-halo-color': '#FFF8EE', 'text-halo-width': 1.4 },
  })
  return [
    layer('poi_r1', 14, [['<', ['get', 'rank'], 7]]),
    layer('poi_r7', 15, [['>=', ['get', 'rank'], 7], ['<', ['get', 'rank'], 20]]),
    layer('poi_r20', 16, [['>=', ['get', 'rank'], 20]]),
  ] as LayerSpecification[]
}
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
    const at = st.layers.findIndex(l => l.id === 'airport')
    st.layers.splice(at < 0 ? st.layers.length : at, 0, ...poiLayers())
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

export interface View { center: L.LatLng; zoom: number }
function PlacesMap({ places, fog, pick, onPick, onOpen, onView, onPoi, focus, mark, me }: {
  places: Place[]; fog: boolean; pick: boolean; onPick: (lat: number, lng: number) => void; onOpen: (id: number) => void
  onView: (v: View) => void; onPoi: (f: Found | null) => void; focus: { lat: number; lng: number; n: number; z?: number } | null
  mark: Found | null; me: { lat: number; lng: number } | null
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const pins = useRef<L.LayerGroup | null>(null)
  const veil = useRef<L.Polygon | null>(null)
  const trail = useRef<L.Polyline | null>(null)
  const fitted = useRef(false)
  const [noMap, setNoMap] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const glRef = useRef<L.MaplibreGL | null>(null)
  const cb = useRef({ onPick, onOpen, onView, onPoi, pick })
  cb.current = { onPick, onOpen, onView, onPoi, pick }

  useEffect(() => {
    const m = L.map(el.current!, { zoomControl: false, worldCopyJump: true }).setView([48.6, 31.2], 5)
    m.attributionControl.addAttribution('<a href="https://openfreemap.org">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>')
    let gone = false
    warmStyle()
      .then(style => {
        if (gone) return
        const gl = maplibreGL({ style, attributionControl: false }).addTo(m)
        glRef.current = gl
        // Карта «проявляется», когда нарисована
        gl.getMaplibreMap().once('idle', () => { if (!gone) { gl.getContainer().classList.add('drawn'); setDrawn(true) } })
      })
      .catch(() => { if (!gone) setNoMap(true) })
    m.attributionControl.setPrefix(false)
    m.createPane('veil').style.zIndex = '350'
    pins.current = L.layerGroup().addTo(m)
    m.on('click', e => {
      if (cb.current.pick) { cb.current.onPick(e.latlng.lat, e.latlng.lng); return }
      cb.current.onPoi(poiAt(e.latlng))
    })
    // Поиск сначала ищет рядом с тем, что видно на карте
    const view = () => cb.current.onView({ center: m.getCenter(), zoom: m.getZoom() })
    m.on('moveend', view)
    view()
    map.current = m
    const t = setTimeout(() => m.invalidateSize(), 350)
    return () => { gone = true; clearTimeout(t); m.remove(); map.current = null; glRef.current = null; fitted.current = false }
  }, [])

  // Что за кафе / магазин / парк под пальцем: ищем значок рядом с местом нажатия
  function poiAt(ll: L.LatLng): Found | null {
    const g = glRef.current?.getMaplibreMap()
    const layers = POI_IDS.filter(id => g?.getLayer(id))
    if (!g || !layers.length) return null
    const p = g.project([ll.lng, ll.lat])
    const fs: MapGeoJSONFeature[] = g.queryRenderedFeatures([[p.x - 22, p.y - 22], [p.x + 22, p.y + 22]], { layers })
    let best: Found | null = null, bestD = Infinity
    for (const f of fs) {
      const pr = f.properties as Record<string, string | undefined>
      if (!pr.name || f.geometry.type !== 'Point') continue
      const [lng, lat] = f.geometry.coordinates as [number, number]
      const q = g.project([lng, lat]), d = Math.hypot(q.x - p.x, q.y - p.y)
      if (d < bestD) { bestD = d; best = { name: pr['name:uk'] || pr.name, addr: '', lat, lng, cat: guessCat(pr.class, `${pr.subclass ?? ''} ${pr.class ?? ''}`) } }
    }
    return best
  }

  // Выбранное на карте место — пульсирующее кольцо; «я здесь» — точка
  useEffect(() => {
    const m = map.current
    if (!m || !mark) return
    const mk = L.marker([mark.lat, mark.lng], { icon: L.divIcon({ className: 'pin-wrap', html: '<div class="poi-mark"></div>', iconSize: [44, 44], iconAnchor: [22, 22] }), interactive: false, zIndexOffset: -50 }).addTo(m)
    return () => { mk.remove() }
  }, [mark])
  useEffect(() => {
    const m = map.current
    if (!m || !me) return
    const mk = L.marker([me.lat, me.lng], { icon: L.divIcon({ className: 'pin-wrap', html: '<div class="me-dot"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(m)
    return () => { mk.remove() }
  }, [me])

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
      // Вблизи туман тоньше, чтобы читались кафе и улицы
      const op = z >= 14 ? 0.42 : z >= 11 ? 0.58 : 0.74
      veil.current = L.polygon([world, ...holes], { pane: 'veil', renderer, stroke: false, fillColor: '#E8D7C2', fillOpacity: op, interactive: false }).addTo(m)
    }
    draw()
    m.on('zoomend', draw)
    trail.current?.remove(); trail.current = null
    const pts = been.filter(p => p.date).sort((a, b) => (a.date! < b.date! ? -1 : 1)).map(p => [p.lat, p.lng] as L.LatLngTuple)
    if (pts.length >= 2) trail.current = L.polyline(pts, { color: '#E0846C', weight: 3, opacity: 0.8, dashArray: '1 9', lineCap: 'round', interactive: false }).addTo(m)
    return () => { m.off('zoomend', draw); veil.current?.remove(); veil.current = null }
  }, [places, fog])

  useEffect(() => { if (focus && map.current) map.current.flyTo([focus.lat, focus.lng], focus.z ?? Math.max(map.current.getZoom(), 15), { duration: 0.8 }) }, [focus])

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
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number; z?: number } | null>(null)
  const [poi, setPoi] = useState<Found | null>(null)
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null)
  const [zoom, setZoom] = useState(5)
  const [tipSeen, setTipSeen] = useState(() => { try { return !!localStorage.getItem('pair.poiTip') } catch { return true } })
  const [open, setOpen] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[] | null>(null)
  const [busy, setBusy] = useState<'' | 'search' | 'here' | 'photo'>('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [big, setBig] = useState<string | null>(null)
  const mapBox = useRef<HTMLDivElement>(null)
  const viewRef = useRef<View | undefined>(undefined)
  const searchSeq = useRef<AbortController | null>(null)

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
  // Поиск: пока печатаешь — Photon (оба написания), по кнопке «Найти» — ещё и Nominatim, если пусто
  async function doSearch(deep = true) {
    const text = q.trim()
    if (text.length < 2) return
    searchSeq.current?.abort()
    const ctl = new AbortController()
    searchSeq.current = ctl
    setBusy('search')
    try {
      const res = await searchPlaces(text, biasFor(viewRef.current, places), deep, ctl.signal)
      if (!ctl.signal.aborted) setFound(res)
    } catch {
      if (!ctl.signal.aborted && deep) s.toast('Поиск не ответил — проверь интернет', 'states/st_offline')
    }
    if (searchSeq.current === ctl) setBusy('')
  }
  useEffect(() => {
    if (!adding || q.trim().length < 3) return
    const t = setTimeout(() => doSearch(false), 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, adding])
  // Если доступ к геопозиции уже дан — тихо узнаём, где ты, чтобы искать рядом
  useEffect(() => {
    if (!adding || !navigator.permissions?.query) return
    navigator.permissions.query({ name: 'geolocation' }).then(st => {
      if (st.state === 'granted') navigator.geolocation.getCurrentPosition(pos => rememberHere(pos.coords.latitude, pos.coords.longitude), () => {}, { maximumAge: 600000, timeout: 8000 })
    }).catch(() => {})
  }, [adding])
  function whereAmI(then: (lat: number, lng: number) => void) {
    if (!navigator.geolocation) { s.toast('Телефон не даёт узнать место', 'states/st_error'); return }
    setBusy('here')
    navigator.geolocation.getCurrentPosition(
      pos => { const { latitude: lat, longitude: lng } = pos.coords; rememberHere(lat, lng); setMe({ lat, lng }); setBusy(''); then(lat, lng) },
      () => { setBusy(''); s.toast('Не получилось узнать, где ты. Разреши доступ к геопозиции', 'states/st_error') },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }
  const hereNow = () => whereAmI(async (lat, lng) => startDraft(await whatIsHere(lat, lng)))
  const locate = () => whereAmI((lat, lng) => setFocus({ lat, lng, n: Date.now(), z: 16 }))
  // Нажали на кафе / магазин на карте: если оно уже у вас — открываем, иначе предлагаем добавить
  function tapPoi(f: Found | null) {
    if (!f) { setPoi(null); return }
    const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    const known = places.find(p => km(p, f) < 0.08 && norm(p.name) === norm(f.name))
    if (known) { setPoi(null); setOpen(known.id); return }
    setPoi(f)
    if (!tipSeen) { setTipSeen(true); try { localStorage.setItem('pair.poiTip', '1') } catch { /* нет доступа */ } }
  }
  async function addPoi(f: Found) {
    setPoi(null)
    startDraft(f)
    const here = await whatIsHere(f.lat, f.lng)
    setDraft(d => (d && !d.id && d.lat === f.lat && d.lng === f.lng && !d.addr ? { ...d, addr: here.addr } : d))
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
        <PlacesMap places={places} fog={fog} pick={pick} onPick={pickPoint} focus={focus} mark={poi} me={me} onPoi={tapPoi}
          onOpen={id => { setOpen(id); setPick(false); setPoi(null) }} onView={v => { viewRef.current = v; setZoom(v.zoom) }} />
        <div className="map-ctrl">
          <button className={fog ? 'on' : ''} onClick={toggleFog} aria-label="Туман"><Img src="common/cloud" /></button>
          <button className="on" onClick={locate} disabled={busy === 'here'} aria-label="Где я"><Img src="meetings/meet_place" /></button>
        </div>
        {!poi && !pick && (
          <div className="map-count">
            {zoom < 14 ? 'Приблизь — появятся кафе, магазины и парки'
              : !tipSeen ? 'Нажми на значок кафе или магазина — добавлю его'
              : been.length ? <>Открыто {been.length} {plural(been.length, 'место', 'места', 'мест')}</> : 'Отмечайте, где были, — туман рассеется'}
          </div>
        )}
        {poi && (
          <div className="map-poi">
            <Img src={catOf(poi.cat).icon} size={40} />
            <div className="grow col" style={{ minWidth: 0 }}><b>{poi.name}</b><small className="muted b">{catOf(poi.cat).name}</small></div>
            <button className="btn sm" onClick={() => addPoi(poi)}>Добавить</button>
            <button className="x-btn" onClick={() => setPoi(null)} aria-label="Закрыть">×</button>
          </div>
        )}
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

      <button className="fab" onClick={() => { setAdding(true); setFound(null); setPoi(null) }} aria-label="Добавить место">+</button>

      {/* Новое место: поиск, точка на карте или «я здесь» */}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Новое место" icon="cheatsheet/dreams/dream_travel">
        <div className="search-box">
          <input className="input" type="search" enterKeyHint="search" placeholder="Название, адрес или город" value={q}
            onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); doSearch() } }} />
          {q && <button className="x-btn" onClick={() => { setQ(''); setFound(null) }} aria-label="Очистить">×</button>}
        </div>
        <button className="btn wide" onClick={() => doSearch()} disabled={busy === 'search'}>{busy === 'search' ? 'Ищу…' : 'Найти'}</button>
        {found && (
          <div className="col" style={{ gap: 6 }}>
            {found.map((f, i) => (
              <button key={i} className="found" onClick={() => startDraft(f)}>
                <Img src={catOf(f.cat).icon} size={30} />
                <span className="grow col" style={{ textAlign: 'left' }}><b>{f.name}</b><small className="muted b">{f.addr}</small></span>
              </button>
            ))}
            {!found.length && <p className="small muted b center">Ничего не нашлось. Попробуй добавить город («мост сити днепр») или найди место на карте.</p>}
          </div>
        )}
        {!found && <p className="small muted b">Можно и без поиска: приблизь карту и нажми на значок кафе, магазина или парка.</p>}
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
