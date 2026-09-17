-- 1. DROP ALL RLS POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Teachers manage own tests" ON tests;
DROP POLICY IF EXISTS "Students manage own attempts" ON attempts;
DROP POLICY IF EXISTS "Teachers view attempts on their tests" ON attempts;
DROP POLICY IF EXISTS "Students manage own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Students manage own purchases" ON purchases;
DROP POLICY IF EXISTS "Users manage own sessions" ON user_sessions;
DROP POLICY IF EXISTS "Users manage own uploads" ON uploads;
DROP POLICY IF EXISTS "Users manage own jobs" ON jobs;
DROP POLICY IF EXISTS "Users manage own questions" ON questions;
DROP POLICY IF EXISTS "Users manage own question images" ON question_images;
DROP POLICY IF EXISTS "Users manage own test notes" ON test_notes;
DROP POLICY IF EXISTS "Students can insert own violations" ON test_violations;
DROP POLICY IF EXISTS "Students can view own violations" ON test_violations;
DROP POLICY IF EXISTS "Users can manage their own notifications" ON notifications;

-- 2. Drop the trigger that auto-creates profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Drop existing foreign key constraints linked to user ID columns (ALL OF THEM)
ALTER TABLE tests DROP CONSTRAINT IF EXISTS tests_teacher_id_fkey;
ALTER TABLE attempts DROP CONSTRAINT IF EXISTS attempts_student_id_fkey;
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_student_id_fkey;
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_student_id_fkey;
ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey;
ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_user_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;
ALTER TABLE test_notes DROP CONSTRAINT IF EXISTS test_notes_user_id_fkey;
ALTER TABLE test_violations DROP CONSTRAINT IF EXISTS test_violations_student_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 4. Alter the data types of all user IDs from UUID to TEXT
ALTER TABLE profiles ALTER COLUMN id TYPE text;
ALTER TABLE tests ALTER COLUMN teacher_id TYPE text;
ALTER TABLE attempts ALTER COLUMN student_id TYPE text;
ALTER TABLE bookmarks ALTER COLUMN student_id TYPE text;
ALTER TABLE purchases ALTER COLUMN student_id TYPE text;
ALTER TABLE user_sessions ALTER COLUMN user_id TYPE text;
ALTER TABLE uploads ALTER COLUMN user_id TYPE text;
ALTER TABLE jobs ALTER COLUMN user_id TYPE text;
ALTER TABLE test_notes ALTER COLUMN user_id TYPE text;
ALTER TABLE test_violations ALTER COLUMN student_id TYPE text;
ALTER TABLE notifications ALTER COLUMN user_id TYPE text;

-- 5. Re-add foreign key constraints (now linking text columns)
ALTER TABLE tests ADD CONSTRAINT tests_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE attempts ADD CONSTRAINT attempts_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE purchases ADD CONSTRAINT purchases_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE uploads ADD CONSTRAINT uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE test_notes ADD CONSTRAINT test_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE test_violations ADD CONSTRAINT test_violations_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 6. RE-CREATE RLS POLICIES
create policy "Users can view own profile" on profiles for select using ((auth.jwt()->>'sub') = id);
create policy "Users can update own profile" on profiles for update using ((auth.jwt()->>'sub') = id);
create policy "Users can insert own profile" on profiles for insert with check ((auth.jwt()->>'sub') = id);
create policy "Teachers manage own tests" on tests for all using ((auth.jwt()->>'sub') = teacher_id);
create policy "Students manage own attempts" on attempts for all using ((auth.jwt()->>'sub') = student_id);
create policy "Teachers view attempts on their tests" on attempts for select using (
  exists (select 1 from tests where tests.id = attempts.test_id and tests.teacher_id = (auth.jwt()->>'sub'))
);
create policy "Students manage own bookmarks" on bookmarks for all using ((auth.jwt()->>'sub') = student_id);
create policy "Students manage own purchases" on purchases for all using ((auth.jwt()->>'sub') = student_id);
create policy "Users manage own sessions" on user_sessions for all using ((auth.jwt()->>'sub') = user_id);
create policy "Users manage own uploads" on uploads for all using ((auth.jwt()->>'sub') = user_id);
create policy "Users manage own jobs" on jobs for all using ((auth.jwt()->>'sub') = user_id);
create policy "Users manage own questions" on questions for all using (
  exists (select 1 from jobs where jobs.id = questions.job_id and jobs.user_id = (auth.jwt()->>'sub'))
  or
  exists (select 1 from tests where tests.id = questions.test_id and tests.teacher_id = (auth.jwt()->>'sub'))
);
create policy "Users manage own question images" on question_images for all using (
  exists (
    select 1 from questions 
    join jobs on jobs.id = questions.job_id 
    where questions.id = question_images.question_id and jobs.user_id = (auth.jwt()->>'sub')
  )
);
create policy "Users manage own test notes" on test_notes for all using ((auth.jwt()->>'sub') = user_id);
create policy "Students can insert own violations" on test_violations for insert with check ((auth.jwt()->>'sub') = student_id);
create policy "Students can view own violations" on test_violations for select using ((auth.jwt()->>'sub') = student_id);
create policy "Users can manage their own notifications" on notifications for all using ((auth.jwt()->>'sub') = user_id);
