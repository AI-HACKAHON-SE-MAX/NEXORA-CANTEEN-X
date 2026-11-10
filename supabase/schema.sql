-- CanteenX schema. Run with the Supabase SQL editor as the project owner.
-- Browser roles receive no table or function access; server routes use service_role.

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  description text not null default '',
  price integer not null check (price > 0),
  image_url text,
  prep_minutes integer not null check (prep_minutes > 0),
  is_available boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  token text not null check (token ~ '^[A-Z][0-9]{2}$'),
  order_day date not null,
  order_key_hash text not null check (order_key_hash ~ '^[0-9a-f]{64}$'),
  university_id_hash text not null check (university_id_hash ~ '^[0-9a-f]{64}$'),
  customer_name text not null check (char_length(customer_name) between 2 and 60),
  status text not null default 'received'
    check (status in ('received', 'preparing', 'ready', 'picked_up', 'cancelled', 'expired')),
  total_price integer not null check (total_price > 0),
  estimated_minutes integer not null check (estimated_minutes between 1 and 60),
  estimated_ready_at timestamptz not null,
  idempotency_key uuid not null unique,
  was_stepped_back boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  preparing_at timestamptz,
  ready_at timestamptz,
  picked_up_at timestamptz,
  constraint orders_token_order_day_unique unique (token, order_day)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete restrict,
  item_name text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price integer not null check (unit_price > 0)
);

alter table public.order_items add column if not exists item_name text;
update public.order_items oi set item_name = m.name
from public.menu_items m where oi.menu_item_id = m.id and oi.item_name is null;
alter table public.order_items alter column item_name set not null;

create table if not exists public.token_counters (
  day date primary key,
  n integer not null default 0 check (n between 0 and 2575)
);

create table if not exists public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null check (count > 0)
);

create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at);
create index if not exists orders_university_id_hash_status_idx
  on public.orders (university_id_hash, status);
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);

alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.token_counters enable row level security;
alter table public.rate_limits enable row level security;

grant usage on schema public to service_role;
revoke all on table public.menu_items, public.orders, public.order_items,
  public.token_counters, public.rate_limits from public, anon, authenticated;
grant all on table public.menu_items, public.orders, public.order_items,
  public.token_counters, public.rate_limits to service_role;

create or replace function public.next_token(p_day date)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_n integer;
  v_letter text;
  v_number integer;
begin
  insert into public.token_counters (day, n)
  values (p_day, 1)
  on conflict (day) do update
    set n = public.token_counters.n + 1
  returning n into v_n;

  if v_n > 2574 then
    raise exception using errcode = 'P0001', message = 'daily_limit';
  end if;

  v_letter := chr(ascii('A') + ((v_n - 1) / 99));
  v_number := ((v_n - 1) % 99) + 1;
  return v_letter || lpad(v_number::text, 2, '0');
end;
$$;

drop function if exists public.create_order_tx(date, text, text, text, uuid, integer, timestamptz, jsonb);
create function public.create_order_tx(
  p_order_day date,
  p_order_key_hash text,
  p_university_id_hash text,
  p_customer_name text,
  p_idempotency_key uuid,
  p_estimated_minutes integer,
  p_estimated_ready_at timestamptz,
  p_items jsonb
)
returns table (
  id uuid,
  token text,
  status text,
  total_price integer,
  estimated_minutes integer,
  estimated_ready_at timestamptz,
  created_at timestamptz,
  items jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_line_count integer;
  v_total_quantity integer;
  v_found_count integer;
  v_total_price integer;
  v_token text;
  v_order_id uuid;
begin
  if p_order_day is null
     or p_order_key_hash is null
     or p_order_key_hash !~ '^[0-9a-f]{64}$'
     or p_university_id_hash is null
     or p_university_id_hash !~ '^[0-9a-f]{64}$'
     or p_customer_name is null
     or char_length(p_customer_name) not between 2 and 60
     or p_idempotency_key is null
     or p_estimated_minutes is null
     or p_estimated_minutes not between 1 and 60
     or p_estimated_ready_at is null then
    raise exception using errcode = 'P0001', message = 'validation_error';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'validation_error';
  end if;
  if jsonb_array_length(p_items) not between 1 and 10 then
    raise exception using errcode = 'P0001', message = 'validation_error';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or jsonb_typeof(item.value -> 'menuItemId') <> 'string'
       or (item.value ->> 'menuItemId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or jsonb_typeof(item.value -> 'quantity') <> 'number'
       or (item.value ->> 'quantity') !~ '^[0-9]+$'
       or case
            when (item.value ->> 'quantity') ~ '^[0-9]+$'
              then (item.value ->> 'quantity')::numeric not between 1 and 10
            else true
          end
  ) then
    raise exception using errcode = 'P0001', message = 'validation_error';
  end if;

  select count(*), coalesce(sum((item.value ->> 'quantity')::integer), 0)
    into v_line_count, v_total_quantity
  from jsonb_array_elements(p_items) as item(value);

  if v_total_quantity > 20
     or (select count(distinct item.value ->> 'menuItemId')
         from jsonb_array_elements(p_items) as item(value)) <> v_line_count then
    raise exception using errcode = 'P0001', message = 'validation_error';
  end if;

  -- Serialize orders for a single hashed University ID before checking its active limit.
  perform pg_advisory_xact_lock(hashtextextended(p_university_id_hash, 0));

  if exists (select 1 from public.orders o where o.idempotency_key = p_idempotency_key) then
    raise exception using errcode = 'P0001', message = 'duplicate_submit';
  end if;

  if (select count(*) from public.orders o
      where o.university_id_hash = p_university_id_hash
        and o.status in ('received', 'preparing', 'ready')) >= 2 then
    raise exception using errcode = 'P0001', message = 'active_order_limit';
  end if;

  -- Hold menu row locks so price, name, and availability cannot change between pricing and insert.
  perform 1
  from jsonb_array_elements(p_items) as item(value)
  join public.menu_items m on m.id = (item.value ->> 'menuItemId')::uuid
  for share of m;

  select count(m.id), coalesce(sum(m.price * (item.value ->> 'quantity')::integer), 0)
    into v_found_count, v_total_price
  from jsonb_array_elements(p_items) as item(value)
  join public.menu_items m
    on m.id = (item.value ->> 'menuItemId')::uuid
   and m.is_available;

  if v_found_count <> v_line_count then
    raise exception using errcode = 'P0001', message = 'item_unavailable';
  end if;

  v_token := public.next_token(p_order_day);

  insert into public.orders (
    token, order_day, order_key_hash, university_id_hash, customer_name,
    status, total_price, estimated_minutes, estimated_ready_at, idempotency_key
  ) values (
    v_token, p_order_day, p_order_key_hash, p_university_id_hash, p_customer_name,
    'received', v_total_price, p_estimated_minutes, p_estimated_ready_at, p_idempotency_key
  ) returning orders.id into v_order_id;

  insert into public.order_items (order_id, menu_item_id, item_name, quantity, unit_price)
  select v_order_id, m.id, m.name, (item.value ->> 'quantity')::integer, m.price
  from jsonb_array_elements(p_items) as item(value)
  join public.menu_items m on m.id = (item.value ->> 'menuItemId')::uuid;

  return query
  select o.id, o.token, o.status, o.total_price, o.estimated_minutes,
         o.estimated_ready_at, o.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('name', oi.item_name, 'quantity', oi.quantity) order by oi.id)
           from public.order_items oi where oi.order_id = o.id
         ), '[]'::jsonb)
  from public.orders o where o.id = v_order_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'duplicate_submit';
end;
$$;

create or replace function public.rate_limit_hit(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
begin
  if p_key is null or char_length(p_key) not between 1 and 200
     or p_window_seconds is null or p_window_seconds < 1
     or p_max is null or p_max < 1 then
    raise exception using errcode = 'P0001', message = 'validation_error';
  end if;

  insert into public.rate_limits as existing (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set window_start = case
          when existing.window_start + make_interval(secs => p_window_seconds) <= v_now
            then v_now else existing.window_start end,
        count = case
          when existing.window_start + make_interval(secs => p_window_seconds) <= v_now
            then 1 else existing.count + 1 end
  returning existing.window_start, existing.count into v_window_start, v_count;

  return query select
    v_count <= p_max,
    greatest(1, ceil(extract(epoch from (
      v_window_start + make_interval(secs => p_window_seconds) - v_now
    )))::integer);
end;
$$;

revoke all on function public.next_token(date) from public, anon, authenticated;
revoke all on function public.create_order_tx(date, text, text, text, uuid, integer, timestamptz, jsonb)
  from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.next_token(date) to service_role;
grant execute on function public.create_order_tx(date, text, text, text, uuid, integer, timestamptz, jsonb)
  to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

revoke all on all sequences in schema public from public, anon, authenticated;
grant all on all sequences in schema public to service_role;
