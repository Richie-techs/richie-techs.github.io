-- Run this in Supabase Dashboard > SQL Editor.
-- Each shipment belongs to one authenticated customer.
-- The browser uses only the publishable key; RLS enforces row access.

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracking_number text not null unique,
  origin_city text,
  origin_country text,
  destination_city text,
  destination_country text,
  status text not null default 'Shipment registered',
  estimated_delivery date,
  shipping_service text,
  package_type text,
  updated_at timestamptz not null default now(),
  timeline_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.shipments enable row level security;

drop policy if exists "Customers can read their own shipments" on public.shipments;
create policy "Customers can read their own shipments"
on public.shipments
for select
to authenticated
using (auth.uid() = user_id);

-- No customer INSERT/UPDATE/DELETE policy is created intentionally.
-- Add/manage shipment records using a trusted admin process, not browser code.
