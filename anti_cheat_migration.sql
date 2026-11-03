-- ============================================
-- ANTI-CHEATING MIGRATION (Firebase Auth Compatible)
-- ============================================

-- 1. Create a table to log all violations for audit trails
CREATE TABLE IF NOT EXISTS test_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID REFERENCES attempts(id) ON DELETE CASCADE,
  student_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL,
  browser TEXT,
  device TEXT,
  snapshot TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add violation_count to the existing attempts table
ALTER TABLE attempts 
ADD COLUMN IF NOT EXISTS violation_count INT DEFAULT 0;

-- 3. Set up Row Level Security (RLS) for the new table
ALTER TABLE test_violations ENABLE ROW LEVEL SECURITY;

-- Allow students to insert their own violations (if ever accessed via direct client)
DROP POLICY IF EXISTS "Students can insert own violations" ON test_violations;
CREATE POLICY "Students can insert own violations" 
ON test_violations 
FOR INSERT 
WITH CHECK ((auth.jwt()->>'sub') = student_id);

-- Allow students to view their own violations
DROP POLICY IF EXISTS "Students can view own violations" ON test_violations;
CREATE POLICY "Students can view own violations" 
ON test_violations 
FOR SELECT 
USING ((auth.jwt()->>'sub') = student_id);

-- Service role bypasses RLS automatically in Supabase
