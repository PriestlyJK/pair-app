-- «Мы»: база для пары. Вставить целиком в Supabase → SQL Editor → Run.
-- Можно запускать повторно: всё создаётся «если ещё нет».

-- Пара и её участники. slot 'a' — кто создал пару, 'b' — кто присоединился по коду.
create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists members (
  user_id uuid primary key references auth.users on delete cascade,
  couple_id uuid not null references couples on delete cascade,
  slot text not null check (slot in ('a', 'b')),
  created_at timestamptz not null default now(),
  unique (couple_id, slot)
);

-- Все данные приложения: по документу на раздел (задачи, кот, календарь…)
create table if not exists docs (
  couple_id uuid not null references couples on delete cascade,
  key text not null,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (couple_id, key)
);

-- Фотографии (фото дня), в виде сжатого jpeg
create table if not exists blobs (
  couple_id uuid not null references couples on delete cascade,
  id text not null,
  data text not null,
  created_at timestamptz not null default now(),
  primary key (couple_id, id)
);

-- Мгновенные события для партнёра: объятия, «выложил фото» и т. п.
create table if not exists events (
  id bigint generated always as identity primary key,
  couple_id uuid not null references couples on delete cascade,
  from_user uuid not null default auth.uid(),
  kind text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists events_couple_time on events (couple_id, created_at desc);

-- Пара текущего пользователя
create or replace function my_couple() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from members where user_id = auth.uid()
$$;

alter table couples enable row level security;
alter table members enable row level security;
alter table docs enable row level security;
alter table blobs enable row level security;
alter table events enable row level security;

drop policy if exists "couple read" on couples;
create policy "couple read" on couples for select using (id = my_couple());

drop policy if exists "members read" on members;
create policy "members read" on members for select using (couple_id = my_couple());

drop policy if exists "docs rw" on docs;
create policy "docs rw" on docs for all using (couple_id = my_couple()) with check (couple_id = my_couple());

drop policy if exists "blobs rw" on blobs;
create policy "blobs rw" on blobs for all using (couple_id = my_couple()) with check (couple_id = my_couple());

drop policy if exists "events read" on events;
create policy "events read" on events for select using (couple_id = my_couple());
drop policy if exists "events add" on events;
create policy "events add" on events for insert with check (couple_id = my_couple() and from_user = auth.uid());

-- Создать пару: возвращает код для партнёра
create or replace function create_couple() returns json
language plpgsql security definer set search_path = public as $$
declare c uuid; k text; i int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already paired'; end if;
  -- 6 символов без похожих букв и цифр (нет O/0, I/1)
  loop
    k := '';
    for i in 1..6 loop
      k := k || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from couples where code = k);
  end loop;
  insert into couples (code) values (k) returning id into c;
  insert into members (user_id, couple_id, slot) values (auth.uid(), c, 'a');
  return json_build_object('couple_id', c, 'slot', 'a', 'code', k);
end $$;

-- Присоединиться по коду
create or replace function join_couple(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'already paired'; end if;
  select id into c from couples where code = upper(trim(p_code));
  if c is null then raise exception 'code not found'; end if;
  if (select count(*) from members where couple_id = c) >= 2 then raise exception 'couple full'; end if;
  insert into members (user_id, couple_id, slot) values (auth.uid(), c, 'b');
  return json_build_object('couple_id', c, 'slot', 'b');
end $$;

revoke all on function create_couple() from public;
revoke all on function join_couple(text) from public;
grant execute on function create_couple() to authenticated;
grant execute on function join_couple(text) to authenticated;
grant execute on function my_couple() to authenticated;

-- Изменения в реальном времени
do $$ begin
  alter publication supabase_realtime add table docs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table events;
exception when duplicate_object then null; end $$;
