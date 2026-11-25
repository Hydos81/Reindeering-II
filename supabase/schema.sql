-- Supabase schema for Đêm Nhạc Thiện Nguyện.
-- Run once in the Supabase SQL Editor. All data access happens on the server
-- with the service role key, so RLS is enabled with no public policies.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  guest_name text not null,
  phone text,
  note text,
  checked_in_at timestamptz,
  ordered_at timestamptz,
  order_id uuid,
  reserved_at timestamptz,
  reservation_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  guest_name text not null,
  seat text not null,
  status text not null default 'new' check (status in ('new', 'done', 'delivered')),
  guest_token text not null unique,
  zalo_message_id text,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  delivered_at timestamptz
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  ticket_id uuid not null unique,
  ticket_code text not null,
  menu_item_id uuid,
  item_name text not null,
  item_image_url text,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value text not null
);

create index if not exists idx_tickets_code on public.tickets (code);
create index if not exists idx_tickets_reservation on public.tickets (reservation_token);
create index if not exists idx_menu_category on public.menu_items (category_id);
create index if not exists idx_order_items_order on public.order_items (order_id);

alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.tickets enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.settings enable row level security;

-- Reserve tickets temporarily while a guest picks drinks (15 minutes default).
-- Returns { ok: true, tickets: [...] } or { ok: false, invalid: [...] }.
create or replace function public.reserve_tickets(
  p_codes text[],
  p_token text,
  p_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_ticket public.tickets%rowtype;
  v_invalid jsonb := '[]'::jsonb;
  v_cutoff timestamptz := now() - make_interval(mins => p_ttl_minutes);
  v_result jsonb;
begin
  foreach v_code in array p_codes loop
    select * into v_ticket from public.tickets where code = v_code for update;

    if not found then
      v_invalid := v_invalid || jsonb_build_object('code', v_code, 'reason', 'NOT_FOUND');
    elsif v_ticket.ordered_at is not null then
      v_invalid := v_invalid || jsonb_build_object('code', v_code, 'reason', 'ALREADY_ORDERED');
    elsif v_ticket.checked_in_at is null then
      v_invalid := v_invalid || jsonb_build_object('code', v_code, 'reason', 'NOT_CHECKED_IN');
    elsif v_ticket.reserved_at is not null
          and v_ticket.reserved_at >= v_cutoff
          and v_ticket.reservation_token is distinct from p_token then
      v_invalid := v_invalid || jsonb_build_object('code', v_code, 'reason', 'RESERVED');
    end if;
  end loop;

  if jsonb_array_length(v_invalid) > 0 then
    return jsonb_build_object('ok', false, 'invalid', v_invalid);
  end if;

  update public.tickets
  set reserved_at = now(), reservation_token = p_token, updated_at = now()
  where code = any (p_codes);

  select jsonb_build_object(
    'ok', true,
    'tickets', coalesce(jsonb_agg(to_jsonb(t) order by t.code), '[]'::jsonb)
  )
  into v_result
  from public.tickets t
  where t.reservation_token = p_token;

  return v_result;
end;
$$;

-- Atomic order creation: lock tickets, write order + items, mark tickets used.
create or replace function public.place_order(
  p_guest_name text,
  p_seat text,
  p_token text,
  p_items jsonb,
  p_guest_token text,
  p_order_id uuid,
  p_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved_count integer;
  v_item_count integer;
  v_distinct_count integer;
  v_updated integer;
  v_ticket public.tickets%rowtype;
begin
  if trim(coalesce(p_guest_name, '')) = '' or trim(coalesce(p_seat, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_ITEMS',
      'message', 'Vui lòng nhập tên và chỗ ngồi.');
  end if;

  -- Lock up-front so two simultaneous requests with one token cannot create two orders.
  select count(*) into v_reserved_count
  from (
    select 1 from public.tickets
    where reservation_token = p_token
      and reserved_at >= now() - make_interval(mins => p_ttl_minutes)
      and ordered_at is null
    for update
  ) locked;

  if v_reserved_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'RESERVATION_EXPIRED',
      'message', 'Phiên đặt nước đã hết hạn. Vui lòng tải lại trang và nhập lại mã vé.'
    );
  end if;

  select count(*), count(distinct upper(trim(e->>'code')))
  into v_item_count, v_distinct_count
  from jsonb_array_elements(p_items) e;

  if v_item_count <> v_reserved_count or v_item_count <> v_distinct_count then
    return jsonb_build_object(
      'ok', false,
      'error', 'INVALID_ITEMS',
      'message', 'Vui lòng chọn đúng một món nước cho mỗi mã vé.'
    );
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    left join public.menu_items m
      on m.id = case
        when e->>'menuItemId' ~ '^[0-9a-fA-F-]{36}$'
        then (e->>'menuItemId')::uuid
        else null
      end
      and m.is_available = true
    where m.id is null
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'ITEM_UNAVAILABLE',
      'message', 'Có món vừa được cập nhật hoặc tạm hết. Vui lòng chọn món khác.'
    );
  end if;

  for v_ticket in
    select * from public.tickets
    where reservation_token = p_token
      and reserved_at >= now() - make_interval(mins => p_ttl_minutes)
      and ordered_at is null
    for update
  loop
    if not exists (
      select 1 from jsonb_array_elements(p_items) e
      where upper(trim(e->>'code')) = v_ticket.code
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', 'INVALID_ITEMS',
        'message', 'Vui lòng chọn đúng một món nước cho mỗi mã vé.'
      );
    end if;
  end loop;

  insert into public.orders (id, guest_name, seat, status, guest_token, created_at)
  values (p_order_id, trim(p_guest_name), trim(p_seat), 'new', p_guest_token, now());

  insert into public.order_items
    (order_id, ticket_id, ticket_code, menu_item_id, item_name, item_image_url, quantity, created_at)
  select p_order_id, t.id, t.code, m.id, m.name, m.image_url, 1, now()
  from jsonb_array_elements(p_items) e
  join public.tickets t
    on t.code = upper(trim(e->>'code'))
   and t.reservation_token = p_token
  join public.menu_items m
    on m.id = case
      when e->>'menuItemId' ~ '^[0-9a-fA-F-]{36}$'
      then (e->>'menuItemId')::uuid
      else null
    end
  where m.is_available = true;

  update public.tickets
  set ordered_at = now(),
      order_id = p_order_id,
      reserved_at = null,
      reservation_token = null,
      updated_at = now()
  where reservation_token = p_token and ordered_at is null;

  get diagnostics v_updated = row_count;
  if v_updated <> v_reserved_count then
    raise exception 'TICKET_CHANGED';
  end if;

  return jsonb_build_object('ok', true, 'orderId', p_order_id);
end;
$$;

-- Undo one ticket's order (admin correction). Deletes an orphaned order too.
create or replace function public.reset_ticket_order(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_remaining integer;
  v_deleted boolean := false;
begin
  select order_id into v_order_id from public.tickets where id = p_ticket_id for update;
  if not found then
    return jsonb_build_object('orderId', null, 'orderDeleted', false);
  end if;

  delete from public.order_items where ticket_id = p_ticket_id;

  update public.tickets
  set ordered_at = null, order_id = null, reserved_at = null,
      reservation_token = null, updated_at = now()
  where id = p_ticket_id;

  if v_order_id is not null then
    select count(*) into v_remaining from public.order_items where order_id = v_order_id;
    if v_remaining = 0 then
      delete from public.orders where id = v_order_id;
      v_deleted := true;
    end if;
  end if;

  return jsonb_build_object('orderId', v_order_id, 'orderDeleted', v_deleted);
end;
$$;

-- Public bucket for menu images. Change SUPABASE_STORAGE_BUCKET if renamed.
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;
