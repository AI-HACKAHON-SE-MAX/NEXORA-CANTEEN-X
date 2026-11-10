-- Adds marked demo orders to the existing order transaction and staff queue.
-- Run this once against the connected Supabase project before deploying the app.
alter table public.orders add column if not exists is_demo boolean not null default false;

create or replace function public.create_order_tx(
  p_order_day date,
  p_order_key_hash text,
  p_university_id_hash text,
  p_customer_name text,
  p_idempotency_key uuid,
  p_estimated_minutes integer,
  p_estimated_ready_at timestamptz,
  p_items jsonb,
  p_is_demo boolean
)
returns table (
  id uuid,
  token text,
  status text,
  total_price integer,
  discount_amount integer,
  estimated_minutes integer,
  estimated_ready_at timestamptz,
  created_at timestamptz,
  items jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Delegate to the established order transaction so demo orders receive the
  -- same validation, price locks, active-order limit, token and item snapshot.
  return query select * from public.create_order_tx(
    p_order_day, p_order_key_hash, p_university_id_hash, p_customer_name,
    p_idempotency_key, p_estimated_minutes, p_estimated_ready_at, p_items
  );
  if p_is_demo then
    update public.orders set is_demo = true where idempotency_key = p_idempotency_key;
  end if;
end;
$$;

revoke all on function public.create_order_tx(date, text, text, text, uuid, integer, timestamptz, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.create_order_tx(date, text, text, text, uuid, integer, timestamptz, jsonb, boolean)
  to service_role;
