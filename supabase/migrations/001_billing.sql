-- Decision Ledger billing only. Does not migrate browser-local decision records.
create table if not exists public.billing_workspaces (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text not null default 'none',
  plan text not null default 'Basic' check (plan in ('Basic','Pro','Elite')),
  price_id text,
  period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_subscription_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists billing_workspaces_owner on public.billing_workspaces(owner_id);
create table if not exists public.billing_invoices (
  id text primary key,
  workspace_id uuid not null references public.billing_workspaces(id) on delete cascade,
  status text,
  amount_due bigint,
  currency text,
  hosted_invoice_url text,
  updated_at timestamptz not null default now()
);
create index if not exists billing_invoices_workspace on public.billing_invoices(workspace_id);
create table if not exists public.billing_events (
  id text primary key,
  event_type text not null,
  stripe_created_at timestamptz not null,
  processed_at timestamptz not null default now()
);
alter table public.billing_workspaces enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_workspaces, public.billing_invoices, public.billing_events from anon, authenticated;
grant select on public.billing_workspaces, public.billing_invoices to authenticated;
create policy "owner can view own billing workspace" on public.billing_workspaces for select to authenticated using (owner_id=auth.uid());
create policy "owner can view own invoices" on public.billing_invoices for select to authenticated using (exists (select 1 from public.billing_workspaces w where w.id=workspace_id and w.owner_id=auth.uid()));
-- Webhook updates are atomic and deduplicated by event ID. Only service_role can call this RPC.
create or replace function public.billing_apply_event(
  p_event_id text,
  p_event_type text,
  p_event_created timestamptz,
  p_workspace_id uuid,
  p_customer_id text,
  p_subscription_id text default null,
  p_subscription_status text default null,
  p_plan text default null,
  p_price_id text default null,
  p_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_invoice_id text default null,
  p_invoice_status text default null,
  p_invoice_amount bigint default null,
  p_invoice_currency text default null,
  p_invoice_url text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_row public.billing_workspaces%rowtype;
begin
  if p_event_id is null or p_workspace_id is null or p_customer_id is null then
    raise exception 'Missing verified event identity';
  end if;
  select * into v_row from public.billing_workspaces where id=p_workspace_id for update;
  if not found then raise exception 'Unknown workspace'; end if;
  if v_row.stripe_customer_id is not null and v_row.stripe_customer_id<>p_customer_id then
    raise exception 'Customer/workspace mismatch';
  end if;
  insert into public.billing_events(id,event_type,stripe_created_at)
    values(p_event_id,p_event_type,p_event_created)
    on conflict (id) do nothing;
  if not found then return false; end if;
  update public.billing_workspaces
    set stripe_customer_id=coalesce(stripe_customer_id,p_customer_id),updated_at=now()
    where id=p_workspace_id;
  if p_subscription_status is not null and (v_row.last_subscription_event_at is null or p_event_created>=v_row.last_subscription_event_at) then
    if p_plan not in ('Pro','Elite') and p_subscription_status in ('active','trialing') then
      raise exception 'Unknown paid plan';
    end if;
    update public.billing_workspaces
    set stripe_subscription_id=coalesce(p_subscription_id,stripe_subscription_id),
        subscription_status=p_subscription_status,
        plan=coalesce(p_plan,plan),price_id=coalesce(p_price_id,price_id),
        period_end=p_period_end,cancel_at_period_end=p_cancel_at_period_end,
        last_subscription_event_at=p_event_created,updated_at=now()
    where id=p_workspace_id;
  end if;
  if p_invoice_id is not null then
    insert into public.billing_invoices(id,workspace_id,status,amount_due,currency,hosted_invoice_url)
    values(p_invoice_id,p_workspace_id,p_invoice_status,p_invoice_amount,p_invoice_currency,p_invoice_url)
    on conflict (id) do update set
      status=coalesce(excluded.status,public.billing_invoices.status),
      amount_due=coalesce(excluded.amount_due,public.billing_invoices.amount_due),
      currency=coalesce(excluded.currency,public.billing_invoices.currency),
      hosted_invoice_url=coalesce(excluded.hosted_invoice_url,public.billing_invoices.hosted_invoice_url),
      updated_at=now();
  end if;
  return true;
end $$;
revoke all on function public.billing_apply_event(text,text,timestamptz,uuid,text,text,text,text,text,timestamptz,boolean,text,text,bigint,text,text) from public, anon, authenticated;
grant execute on function public.billing_apply_event(text,text,timestamptz,uuid,text,text,text,text,text,timestamptz,boolean,text,text,bigint,text,text) to service_role;
