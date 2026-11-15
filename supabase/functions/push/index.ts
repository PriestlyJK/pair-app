/* Supabase Edge Function «push» — уведомления на телефон партнёру (Web Push).

   Как поставить: Supabase → Edge Functions → Deploy a new function → Via Editor,
   имя функции: push, вставить весь этот файл, Deploy. Перед этим один раз запустить supabase/push.sql.

   Ключи VAPID создаются сами при первом запуске и лежат в таблице push_config — её видит только эта функция.
   Никаких сторонних библиотек: шифрование по RFC 8291, подпись VAPID по RFC 8292 — всё на WebCrypto.

   Что умеет (POST, тело JSON, вызывается из приложения с входом пользователя):
     { action: 'key' }                         → открытый ключ для подписки телефона
     { action: 'save', sub }                   → запомнить подписку этого телефона
     { action: 'remove', endpoint }            → забыть подписку
     { action: 'send', title, body, url, test? } → уведомление партнёру (test: себе, для проверки) */

// Контакт отправителя для служб доставки (Apple требует ссылку или mailto)
const SUBJECT = 'https://priestlyjk.github.io/pair-app/'

const te = new TextEncoder()
const env = (k: string): string => (globalThis as any).Deno?.env.get(k) ?? ''

export const b64u = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b)
  let s = ''
  for (const x of u) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export const unb64u = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(t + '==='.slice((t.length + 3) % 4)), c => c.charCodeAt(0))
}
const cat = (...xs: Uint8Array[]) => {
  const out = new Uint8Array(xs.reduce((a, x) => a + x.length, 0))
  let o = 0
  for (const x of xs) { out.set(x, o); o += x.length }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8))
}

// Шифрование содержимого для конкретного телефона (RFC 8291, aes128gcm)
export async function encrypt(payload: Uint8Array, p256dh: string, auth: string) {
  const ua = unb64u(p256dh)
  const secret = unb64u(auth)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const eph = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const as = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256))
  const ikm = await hkdf(secret, shared, cat(te.encode('WebPush: info\0'), ua, as), 32)
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 — признак последней (и единственной) записи
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(payload, new Uint8Array([2]))))
  const head = new Uint8Array(21)
  head.set(salt)
  new DataView(head.buffer).setUint32(16, 4096)
  head[20] = as.length
  return cat(head, as, ct)
}

export type Keys = { publicKey: string; privateJwk: JsonWebKey }

export async function newKeys(): Promise<Keys> {
  const k = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  return { publicKey: b64u(await crypto.subtle.exportKey('raw', k.publicKey)), privateJwk: await crypto.subtle.exportKey('jwk', k.privateKey) }
}

// Подпись VAPID: служба доставки (Apple, Google…) узнаёт, что пишет именно наш сервер
export async function vapidJwt(aud: string, keys: Keys, exp: number) {
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const body = b64u(te.encode(JSON.stringify({ aud, exp, sub: SUBJECT })))
  const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(head + '.' + body))
  return `${head}.${body}.${b64u(sig)}`
}

// ---------- База (через service role, мимо RLS) ----------
async function db(path: string, init: RequestInit = {}) {
  const sr = env('SUPABASE_SERVICE_ROLE_KEY')
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: sr, Authorization: `Bearer ${sr}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  })
  if (!r.ok) throw new Error(`db ${r.status}: ${await r.text()}`)
  const t = await r.text()
  return t ? JSON.parse(t) : null
}

type Config = { keys: Keys; jwts: Record<string, { t: string; exp: number }> }
let cached: Config | null = null
async function config(): Promise<Config> {
  if (cached) return cached
  const q = 'push_config?select=public_key,private_jwk,jwts&id=eq.1'
  let rows = await db(q)
  if (!rows.length) {
    const k = await newKeys()
    await db('push_config', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, public_key: k.publicKey, private_jwk: k.privateJwk, jwts: {} }) })
    rows = await db(q)
  }
  const r = rows[0]
  return (cached = { keys: { publicKey: r.public_key, privateJwk: r.private_jwk }, jwts: r.jwts ?? {} })
}

// Apple просит не обновлять подпись чаще раза в час — держим одну на 12 часов
async function jwtFor(aud: string) {
  const c = await config()
  const now = Math.floor(Date.now() / 1000)
  const have = c.jwts[aud]
  if (have && have.exp - now > 3600) return have.t
  const exp = now + 12 * 3600
  const t = await vapidJwt(aud, c.keys, exp)
  c.jwts[aud] = { t, exp }
  await db('push_config?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ jwts: c.jwts }) }).catch(() => {})
  return t
}

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } }
async function deliver(sub: Sub, msg: object) {
  const c = await config()
  const body = await encrypt(te.encode(JSON.stringify(msg)), sub.keys.p256dh, sub.keys.auth)
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400',
      Urgency: 'high',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${await jwtFor(new URL(sub.endpoint).origin)}, k=${c.keys.publicKey}`,
    },
    body,
  })
  return r.status
}

// ---------- Запросы из приложения ----------
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') ?? 'authorization, x-client-info, apikey, content-type',
})
const json = (req: Request, v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })
const str = (v: unknown, n: number) => String(v ?? '').slice(0, n)

async function handle(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  // Кто пишет: проверяем вход пользователя
  const u = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY') },
  })
  if (!u.ok) return json(req, { error: 'auth' }, 401)
  const me: string = (await u.json()).id
  const body = await req.json().catch(() => ({}))
  const c = await config()
  if (body.action === 'key') return json(req, { key: c.keys.publicKey })

  const couple: string | null = (await db(`members?select=couple_id&user_id=eq.${me}`))[0]?.couple_id ?? null

  if (body.action === 'save') {
    const s = body.sub
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) return json(req, { error: 'sub' }, 400)
    await db('push_subs', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ endpoint: s.endpoint, user_id: me, couple_id: couple, sub: { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } }, updated_at: new Date().toISOString() }),
    })
    return json(req, { ok: true })
  }

  if (body.action === 'remove') {
    await db(`push_subs?endpoint=eq.${encodeURIComponent(str(body.endpoint, 2000))}&user_id=eq.${me}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
    return json(req, { ok: true })
  }

  if (body.action === 'send') {
    let users: string[] = []
    if (body.test) users = [me]
    else if (couple) users = ((await db(`members?select=user_id&couple_id=eq.${couple}`)) as { user_id: string }[]).map(m => m.user_id).filter(id => id !== me)
    if (!users.length) return json(req, { sent: 0, results: [] })
    const subs: { endpoint: string; sub: Sub }[] = await db(`push_subs?select=endpoint,sub&user_id=in.(${users.join(',')})`)
    const msg = { title: str(body.title, 80) || 'Мы', body: str(body.body, 240), url: str(body.url, 60) }
    const results = await Promise.all(subs.map(async s => {
      try {
        const st = await deliver(s.sub, msg)
        // Телефон отписался или удалил приложение — подписка больше не нужна
        if (st === 404 || st === 410) await db(`push_subs?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
        return st
      } catch (e) { return String((e as Error)?.message ?? e) }
    }))
    return json(req, { sent: results.filter(r => typeof r === 'number' && r < 300).length, results })
  }

  return json(req, { error: 'action' }, 400)
}

const D = (globalThis as any).Deno
if (D?.serve) D.serve((req: Request) => handle(req).catch(e => json(req, { error: String(e?.message ?? e) }, 500)))
