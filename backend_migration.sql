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
