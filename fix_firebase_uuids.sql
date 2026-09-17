-- 1. Drop existing FK constraints
ALTER TABLE uploads DROP CONSTRAINT IF EXISTS uploads_user_id_fkey;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;
ALTER TABLE test_notes DROP CONSTRAINT IF EXISTS test_notes_user_id_fkey;
ALTER TABLE test_violations DROP CONSTRAINT IF EXISTS test_violations_student_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;

-- 2. Alter column types to text
ALTER TABLE uploads ALTER COLUMN user_id TYPE text;
ALTER TABLE jobs ALTER COLUMN user_id TYPE text;
ALTER TABLE test_notes ALTER COLUMN user_id TYPE text;
ALTER TABLE test_violations ALTER COLUMN student_id TYPE text;
ALTER TABLE notifications ALTER COLUMN user_id TYPE text;

-- 3. Re-add FK constraints
ALTER TABLE uploads ADD CONSTRAINT uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE jobs ADD CONSTRAINT jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE test_notes ADD CONSTRAINT test_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE test_violations ADD CONSTRAINT test_violations_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

