// Подключение к Supabase. Эти два значения публичные (их видит любое приложение-клиент),
// доступ к данным защищён правилами в базе: каждый видит только свою пару.
// Если оставить пустыми — приложение работает только на этом телефоне.
export const SUPABASE_URL = 'https://ilivzufmwmbcefwrjlpj.supabase.co'
export const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsaXZ6dWZtd21iY2Vmd3JqbHBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2OTA4MzAsImV4cCI6MjExMDI2NjgzMH0.YT01WVzKsOKxwhsNPjbhi074lOsVbNWHocR3kEagSgI'

// Функция Supabase, которая шлёт уведомления на телефон (код — supabase/functions/push/index.ts)
export const PUSH_FUNCTION = 'smart-service'

// Функция Supabase с каталогом фильмов для «Подбора» (код — supabase/functions/movies/index.ts, ключ TMDB лежит в её секретах)
export const MOVIES_FUNCTION = 'movies'
