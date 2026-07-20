-- ============================================
-- NEET TEST PREP PLATFORM - DATABASE SCHEMA
-- ============================================

-- 1. PROFILES TABLE (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('teacher', 'student')) not null default 'student',
  target_exam text default 'NEET',
  accessibility_settings jsonb default '{}'::jsonb,
  user_settings jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- 2. TESTS TABLE (created by teachers)
create table tests (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references profiles(id) on delete cascade,
  name text not null,
  description text,
  is_paid boolean default false,
  price numeric default 0,
  questions jsonb not null, -- array of question objects
  total_questions int default 0,
  is_published boolean default false,
  created_at timestamp with time zone default now()
);

-- 3. ATTEMPTS TABLE (student test attempts)
create table attempts (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references profiles(id) on delete cascade,
  test_id uuid references tests(id) on delete cascade,
  answers jsonb default '{}', -- {question_id: selected_option}
  marked_for_review jsonb default '[]', -- array of question_ids
  started_at timestamp with time zone default now(),
  completed_at timestamp with time zone,
  time_taken int, -- seconds
  final_score numeric,
  max_score numeric,
  is_completed boolean default false
);

-- 4. BOOKMARKS TABLE (saved wrong questions per student)
create table bookmarks (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references profiles(id) on delete cascade,
  question_id text not null,
  question_data jsonb not null, -- full question object saved
  test_id uuid references tests(id) on delete set null,
  created_at timestamp with time zone default now(),
  unique(student_id, question_id)
);

-- 5. PURCHASES TABLE (for paid test series access)
create table purchases (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references profiles(id) on delete cascade,
  test_id uuid references tests(id) on delete cascade,
  amount numeric not null,
  razorpay_payment_id text,
  razorpay_order_id text,
  status text check (status in ('pending', 'success', 'failed')) default 'pending',
  created_at timestamp with time zone default now(),
  unique(student_id, test_id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Important for safety
-- ============================================

alter table profiles enable row level security;
alter table tests enable row level security;
alter table attempts enable row level security;
alter table bookmarks enable row level security;
alter table purchases enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Tests: teachers manage own tests, students can view published ones
create policy "Teachers manage own tests" on tests for all using (auth.uid() = teacher_id);
create policy "Students view published tests" on tests for select using (is_published = true);

-- Attempts: students manage their own attempts
create policy "Students manage own attempts" on attempts for all using (auth.uid() = student_id);
create policy "Teachers view attempts on their tests" on attempts for select using (
  exists (select 1 from tests where tests.id = attempts.test_id and tests.teacher_id = auth.uid())
);

-- Bookmarks: students manage their own bookmarks
create policy "Students manage own bookmarks" on bookmarks for all using (auth.uid() = student_id);

-- Purchases: students manage own purchases
create policy "Students manage own purchases" on purchases for all using (auth.uid() = student_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', coalesce(new.raw_user_meta_data->>'role', 'student'));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 6. USER SESSIONS TABLE (tracks active devices)
-- ============================================
create table user_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  device_name text,
  browser text,
  os text,
  ip_address text,
  login_time timestamp with time zone default now(),
  last_active timestamp with time zone default now()
);

alter table user_sessions enable row level security;
create policy "Users manage own sessions" on user_sessions for all using (auth.uid() = user_id);
