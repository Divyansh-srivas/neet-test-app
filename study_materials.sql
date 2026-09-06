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
