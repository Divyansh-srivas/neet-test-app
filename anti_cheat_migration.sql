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
