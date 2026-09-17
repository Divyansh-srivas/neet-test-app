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
-- ============================================
-- NEET TEST PREP PLATFORM - BACKEND MIGRATION
-- ============================================

-- 1. UPLOADS TABLE
create table if not exists uploads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  file_path text not null,
  original_name text not null,
  uploaded_at timestamp with time zone default now()
);

alter table uploads enable row level security;
create policy "Users manage own uploads" on uploads for all using (auth.uid() = user_id);

-- 2. JOBS TABLE
create table if not exists jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  upload_id uuid references uploads(id) on delete set null,
  status text check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')) default 'queued',
  progress int default 0,
  pages_completed int default 0,
  total_pages int default 0,
  extracted_questions int default 0,
  extracted_images int default 0,
  error_message text,
  test_id uuid references tests(id) on delete set null,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

alter table jobs enable row level security;
create policy "Users manage own jobs" on jobs for all using (auth.uid() = user_id);

-- 3. QUESTIONS TABLE (Normalized per user request)
create table if not exists questions (
  id text primary key, -- Use text to allow custom generated IDs like 'q_12345'
  job_id uuid references jobs(id) on delete cascade,
  test_id uuid references tests(id) on delete cascade,
  q_num int,
  subject text,
  chapter text,
  difficulty text,
  question_text text not null,
  options jsonb not null, -- { A: '', B: '', C: '', D: '' }
  correct_option text,
  explanation text,
  created_at timestamp with time zone default now()
);

alter table questions enable row level security;
-- Policy can be complex depending on if it's tied to a test. We'll allow read for all if test is published, or owner.
create policy "Users manage own questions" on questions for all using (
  exists (select 1 from jobs where jobs.id = questions.job_id and jobs.user_id = auth.uid())
  or
  exists (select 1 from tests where tests.id = questions.test_id and tests.teacher_id = auth.uid())
);

-- 4. QUESTION IMAGES TABLE
create table if not exists question_images (
  id uuid default gen_random_uuid() primary key,
  question_id text references questions(id) on delete cascade,
  image_url text not null,
  page_number int,
  created_at timestamp with time zone default now()
);

alter table question_images enable row level security;
-- Since they map to questions, we can keep it simple: allow public read, but owner write.
create policy "Public read question images" on question_images for select using (true);
create policy "Users manage own question images" on question_images for all using (
  exists (
    select 1 from questions 
    join jobs on jobs.id = questions.job_id 
    where questions.id = question_images.question_id and jobs.user_id = auth.uid()
  )
);
  
-- Storage Bucket for Uploads  
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false) on conflict do nothing; 
  
-- 5. TEST NOTES TABLE  
create table if not exists test_notes (  
  user_id uuid references profiles(id) on delete cascade,  
  test_id text not null,  
  content text not null default '',  
  updated_at timestamp with time zone default now(),  
  primary key (user_id, test_id)  
);  
alter table test_notes enable row level security;  
create policy "Users manage own test notes" on test_notes for all using (auth.uid() = user_id); 
-- Create study_materials table
CREATE TABLE IF NOT EXISTS study_materials (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subject TEXT NOT NULL, -- e.g., 'physics', 'chemistry', 'biology'
    chapter_name TEXT NOT NULL,
    pdf_link TEXT NOT NULL, -- Google Drive link
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE study_materials ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all authenticated users to read
CREATE POLICY "Allow authenticated users to read study materials" ON study_materials
    FOR SELECT
    TO authenticated
    USING (true);

-- Create policy to allow only specific roles/admins to insert/update (For now, allow authenticated to insert via the script if needed, or we can just leave it to service role)
-- The sync script will likely use a service role key, which bypasses RLS. So no insert policy is strictly needed for public access.
-- ============================================
-- ANTI-CHEATING MIGRATION
-- ============================================

-- 1. Create a table to log all violations for audit trails
CREATE TABLE IF NOT EXISTS test_violations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id text,
  student_id text,
  violation_type text NOT NULL,
  browser text,
  device text,
  created_at timestamp with time zone DEFAULT now()
);

-- 2. Add violation_count to the existing attempts table
ALTER TABLE attempts 
ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0;

-- 3. Set up Row Level Security (RLS) for the new table
ALTER TABLE test_violations ENABLE ROW LEVEL SECURITY;

-- Allow students to insert their own violations (assuming Firebase text IDs)
CREATE POLICY "Students can insert own violations" 
ON test_violations 
FOR INSERT 
WITH CHECK ((auth.jwt()->>'sub') = student_id);

-- Allow students to view their own violations
CREATE POLICY "Students can view own violations" 
ON test_violations 
FOR SELECT 
USING ((auth.jwt()->>'sub') = student_id);
CREATE TABLE IF NOT EXISTS notifications ( id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, title text NOT NULL, message text NOT NULL, type text DEFAULT 'info', is_read boolean DEFAULT false, link text, created_at timestamp with time zone DEFAULT now() );

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
