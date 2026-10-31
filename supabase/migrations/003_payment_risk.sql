-- Add subscription charge risk holds; Stripe verified webhook writes only.
alter table public.billing_workspaces add column if not exists payment_risk_hold boolean not null default false;
create table if not exists public.billing_risk_events (
 id text primary key, workspace_id uuid not null references public.billing_workspaces(id) on delete cascade,
 customer_id text not null, charge_id text not null, event_type text not null, event_at timestamptz not null,
 recorded_at timestamptz not null default now()
);
create index if not exists billing_risk_workspace on public.billing_risk_events(workspace_id);
alter table public.billing_risk_events enable row level security;
revoke all on public.billing_risk_events from public,anon,authenticated;
create or replace function public.billing_apply_risk(
 p_event_id text,p_event_type text,p_event_created timestamptz,p_workspace_id uuid,p_customer_id text,p_charge_id text
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_customer text;
begin
 if p_event_id is null or p_charge_id is null or p_event_type not in ('charge.dispute.created','charge.refunded','radar.early_fraud_warning.created') then raise exception 'Invalid risk event';end if;
 select stripe_customer_id into v_customer from public.billing_workspaces where id=p_workspace_id for update;
 if not found or v_customer is null or v_customer<>p_customer_id then raise exception 'Customer binding mismatch';end if;
 insert into public.billing_events(id,event_type,stripe_created_at) values(p_event_id,p_event_type,p_event_created) on conflict(id) do nothing;
 if not found then return false;end if;
 insert into public.billing_risk_events(id,workspace_id,customer_id,charge_id,event_type,event_at) values(p_event_id,p_workspace_id,p_customer_id,p_charge_id,p_event_type,p_event_created);
 update public.billing_workspaces set payment_risk_hold=true,updated_at=now() where id=p_workspace_id;
 return true;
end $$;
revoke all on function public.billing_apply_risk(text,text,timestamptz,uuid,text,text) from public,anon,authenticated;
grant execute on function public.billing_apply_risk(text,text,timestamptz,uuid,text,text) to service_role;
