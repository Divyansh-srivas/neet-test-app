-- Neogravix Test Series. Run once in the Supabase SQL editor.
-- Drafts live ONLY in these two tables. Students never read them directly (RLS on, no policies);
-- the backend returns only what a student is allowed to see.

create table if not exists test_series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  syllabus text not null default '',
  duration_minutes int not null default 180 check (duration_minutes between 1 and 600),
  syllabus_published boolean not null default false,
  status text not null default 'draft' check (status in ('draft','live')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists test_series_questions (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references test_series(id) on delete cascade,
  position int not null default 0,
  subject text not null default 'General',
  question text not null,
  option_a text not null default '',
  option_b text not null default '',
  option_c text not null default '',
  option_d text not null default '',
  correct text not null default 'A' check (correct in ('A','B','C','D')),
  explanation text not null default '',
  image_url text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists test_series_questions_series_idx on test_series_questions(series_id, position);

alter table test_series enable row level security;
alter table test_series_questions enable row level security;

-- Each student gets ONE personal copy of a live series test in the normal `tests` table
-- (so attempts, analysis, proctoring and violations all work exactly like any other test).
alter table tests add column if not exists series_id uuid;
create unique index if not exists tests_teacher_series_uidx on tests(teacher_id, series_id) where series_id is not null;
