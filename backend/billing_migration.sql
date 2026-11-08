-- Neogravix paid extractions. Run once in Supabase SQL editor.
-- Backend uses the service-role key, so RLS is enabled with NO policies (clients cannot touch these tables).

create table if not exists plan_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_id text not null,
  credits_total int not null check (credits_total >= 0),
  credits_used int not null default 0 check (credits_used >= 0),
  valid_days int not null,
  amount_paise int not null,
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created','paid','failed')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz
);
create unique index if not exists plan_purchases_payment_uidx on plan_purchases(razorpay_payment_id) where razorpay_payment_id is not null;
create index if not exists plan_purchases_user_idx on plan_purchases(user_id, status, expires_at);

create table if not exists extraction_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  job_id uuid not null unique,
  purchase_id uuid references plan_purchases(id),
  credits int not null default 1,
  status text not null default 'consumed' check (status in ('consumed','refunded')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
alter table extraction_ledger add column if not exists credits int not null default 1;

alter table plan_purchases enable row level security;
alter table extraction_ledger enable row level security;

-- Atomically take p_credits (earliest-expiring pack first). Returns pack id, or NULL when insufficient credits.
create or replace function consume_extraction_credit(p_user text, p_job uuid, p_credits int default 1)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_available int;
  v_pack record;
  v_needed int := coalesce(p_credits, 1);
  v_take int;
  v_first_pack uuid := null;
begin
  if v_needed <= 0 then v_needed := 1; end if;
  perform pg_advisory_xact_lock(hashtext(p_user));

  -- Already consumed for this job? (idempotent)
  select purchase_id into v_first_pack from extraction_ledger where job_id = p_job limit 1;
  if found then return v_first_pack; end if;

  -- Verify total unexpired credits available across all paid packs
  select coalesce(sum(credits_total - credits_used), 0) into v_available
    from plan_purchases
   where user_id = p_user and status = 'paid' and expires_at > now() and credits_used < credits_total;

  if v_available < v_needed then
    return null; -- Insufficient credits
  end if;

  -- Debit credits from earliest-expiring packs
  for v_pack in
    select id, (credits_total - credits_used) as remaining
      from plan_purchases
     where user_id = p_user and status = 'paid' and expires_at > now() and credits_used < credits_total
     order by expires_at asc
     for update
  loop
    v_take := least(v_needed, v_pack.remaining);
    update plan_purchases set credits_used = credits_used + v_take where id = v_pack.id;
    if v_first_pack is null then v_first_pack := v_pack.id; end if;
    v_needed := v_needed - v_take;
    exit when v_needed <= 0;
  end loop;

  insert into extraction_ledger(user_id, job_id, purchase_id, credits)
  values (p_user, p_job, v_first_pack, coalesce(p_credits, 1));

  return v_first_pack;
end $$;

-- Overload for backwards compatibility with 2 arguments
create or replace function consume_extraction_credit(p_user text, p_job uuid)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  return consume_extraction_credit(p_user, p_job, 1);
end $$;

-- Give the credit back (idempotent: only works once per job).
create or replace function refund_extraction_credit(p_job uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_rec record;
begin
  for v_rec in
    update extraction_ledger
       set status = 'refunded', refunded_at = now()
     where job_id = p_job and status = 'consumed'
     returning purchase_id, coalesce(credits, 1) as credits
  loop
    update plan_purchases
       set credits_used = greatest(credits_used - v_rec.credits, 0)
     where id = v_rec.purchase_id;
  end loop;
  return found;
end $$;

revoke all on function consume_extraction_credit(text, uuid, int) from public, anon, authenticated;
revoke all on function consume_extraction_credit(text, uuid) from public, anon, authenticated;
revoke all on function refund_extraction_credit(uuid) from public, anon, authenticated;
grant execute on function consume_extraction_credit(text, uuid, int) to service_role;
grant execute on function consume_extraction_credit(text, uuid) to service_role;
grant execute on function refund_extraction_credit(uuid) to service_role;

-- Any job that ends failed/cancelled automatically returns its credit (covers every worker failure path).
create or replace function trg_refund_on_job_fail() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('failed','cancelled') and old.status is distinct from new.status then
    perform refund_extraction_credit(new.id);
  end if;
  return new;
end $$;
drop trigger if exists jobs_refund_on_fail on jobs;
create trigger jobs_refund_on_fail after update of status on jobs for each row execute function trg_refund_on_job_fail();

-- Manually grant credits to someone (e.g. teacher/test account):
-- insert into plan_purchases(user_id, plan_id, credits_total, valid_days, amount_paise, status, paid_at, expires_at)
-- values ('<firebase uid>', 'grant', 10, 365, 0, 'paid', now(), now() + interval '365 days');
