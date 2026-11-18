/* Supabase Edge Function «movies» — каталог фильмов, сериалов и аниме для «Подбора» в вотчлисте (данные TMDB).

   Как поставить:
   1. Supabase → Edge Functions → Secrets → Add new secret: имя TMDB_KEY, значение — «Ключ API» с themoviedb.org
      (Settings → API, строка из 32 символов; длинный «Токен доступу для читання» тоже подойдёт).
   2. Edge Functions → Deploy a new function → Via Editor, имя функции movies (как MOVIES_FUNCTION в src/config.ts),
      вставить весь этот файл, Deploy.
   3. В настройках функции «Verify JWT with legacy secret» — выключить: вход проверяем сами, как в push.

   Ключ хранится только здесь, в секретах Supabase: ни в приложение, ни на GitHub он не попадает.
   Пускаем только вошедших пользователей и только запросы к каталогу (список ниже), чтобы ключом не пользовались чужие.

   Вызов (POST): { path: 'discover/movie', params: { page: 2, with_genres: '35' } } → ответ TMDB как есть. */

const env = (k: string): string => (globalThis as any).Deno?.env.get(k) ?? ''

const PATHS = /^(discover\/(movie|tv)|(movie|tv)\/\d{1,9}|search\/multi|trending\/(all|movie|tv)\/(day|week))$/
const PARAMS = new Set([
  'page', 'language', 'sort_by', 'with_genres', 'without_genres', 'with_original_language', 'with_origin_country',
  'vote_count.gte', 'vote_average.gte', 'primary_release_date.gte', 'first_air_date.gte', 'query',
])

const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') ?? 'authorization, x-client-info, apikey, content-type',
})
const json = (req: Request, v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } })

async function handle(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) })
  // Кто спрашивает: только вошедший пользователь приложения
  const u = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: req.headers.get('Authorization') ?? '', apikey: env('SUPABASE_ANON_KEY') || env('SUPABASE_SERVICE_ROLE_KEY') },
  })
  if (!u.ok) return json(req, { error: 'auth' }, 401)

  const body = await req.json().catch(() => ({}))
  const path = String(body.path ?? '')
  if (!PATHS.test(path)) return json(req, { error: 'path' }, 400)
  const key = env('TMDB_KEY').trim()
  if (!key) return json(req, { error: 'no TMDB_KEY secret' }, 500)

  const q = new URLSearchParams({ language: 'ru-RU', include_adult: 'false' })
  for (const [k, v] of Object.entries(body.params ?? {})) {
    if (PARAMS.has(k) && v != null && v !== '') q.set(k, String(v).slice(0, 200))
  }
  const headers: Record<string, string> = { accept: 'application/json' }
  // Короткий «Ключ API» идёт параметром, длинный токен — заголовком
  if (/^[0-9a-f]{32}$/i.test(key)) q.set('api_key', key)
  else headers.Authorization = `Bearer ${key}`

  const r = await fetch(`https://api.themoviedb.org/3/${path}?${q}`, { headers })
  return new Response(await r.text(), { status: r.status, headers: { ...cors(req), 'Content-Type': 'application/json' } })
}

const D = (globalThis as any).Deno
if (D?.serve) D.serve((req: Request) => handle(req).catch(e => json(req, { error: String(e?.message ?? e) }, 500)))
