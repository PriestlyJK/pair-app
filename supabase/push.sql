-- Уведомления на телефон (Web Push). Запустить один раз: Supabase → SQL Editor → вставить → Run.
-- Можно запускать повторно. Таблицы видит только функция push (через service role), приложению они недоступны.

-- Подписки телефонов: куда слать уведомления каждому
create table if not exists push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users on delete cascade,
  couple_id uuid,
  sub jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists push_subs_user on push_subs (user_id);
alter table push_subs enable row level security;

-- Ключи отправителя (создаются функцией сами при первом запуске)
create table if not exists push_config (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_jwk jsonb not null,
  jwts jsonb not null default '{}'
);
alter table push_config enable row level security;
