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
  status text not null default 'consumed' check (status in ('consumed','refunded')),
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);

alter table plan_purchases enable row level security;
alter table extraction_ledger enable row level security;

-- Atomically take one credit (earliest-expiring pack first). Returns pack id, or NULL when no credit.
create or replace function consume_extraction_credit(p_user text, p_job uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_pack uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_user));
  select purchase_id into v_pack from extraction_ledger where job_id = p_job;
  if found then return v_pack; end if;
  select id into v_pack from plan_purchases
   where user_id = p_user and status = 'paid' and expires_at > now() and credits_used < credits_total
   order by expires_at asc limit 1 for update;
  if v_pack is null then return null; end if;
  update plan_purchases set credits_used = credits_used + 1 where id = v_pack;
  insert into extraction_ledger(user_id, job_id, purchase_id) values (p_user, p_job, v_pack);
  return v_pack;
end $$;

-- Give the credit back (idempotent: only works once per job).
create or replace function refund_extraction_credit(p_job uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_pack uuid;
begin
  update extraction_ledger set status = 'refunded', refunded_at = now()
   where job_id = p_job and status = 'consumed' returning purchase_id into v_pack;
  if v_pack is null then return false; end if;
  update plan_purchases set credits_used = greatest(credits_used - 1, 0) where id = v_pack;
  return true;
end $$;

revoke all on function consume_extraction_credit(text, uuid) from public, anon, authenticated;
revoke all on function refund_extraction_credit(uuid) from public, anon, authenticated;
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
