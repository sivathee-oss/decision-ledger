-- Atomic per-user AI request budget. This is a spend guard, not a billing entitlement.
-- Apply AFTER 001_billing.sql. No direct user writes; only the Edge Function's
-- service-role client may consume a request. Counts reset at UTC midnight.
create table if not exists public.ai_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null default (now() at time zone 'utc')::date,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, usage_day)
);
alter table public.ai_usage_daily enable row level security;
revoke all on public.ai_usage_daily from public, anon, authenticated;

create or replace function public.consume_ai_quota(
  p_user_id uuid,
  p_limit integer default 25
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid quota request';
  end if;
  insert into public.ai_usage_daily(user_id, usage_day, request_count)
  values(p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_day) do update
    set request_count = public.ai_usage_daily.request_count + 1
    where public.ai_usage_daily.request_count < p_limit
  returning request_count into v_count;
  return v_count is not null;
end;
$$;
revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
