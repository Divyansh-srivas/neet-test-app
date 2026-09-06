import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ================================================
// INSTRUCTIONS:
// 1. Run the Google Apps Script (drive-list-files.gs) to get your files JSON
// 2. Paste that JSON array into drive-data.json (same folder as this script)
// 3. Set the SUBJECT below
// 4. Run: node backend/scripts/sync-drive.js
// ================================================

const SUBJECT = 'physics'; // Change to 'chemistry' or 'biology' for other subjects

async function syncFromJSON() {
    const dataPath = path.join(__dirname, 'drive-data.json');

    if (!fs.existsSync(dataPath)) {
        console.log('');
        console.log('❌ drive-data.json not found!');
        console.log('');
        console.log('👉 Follow these steps:');
        console.log('   1. Go to https://script.google.com');
        console.log('   2. Create a new project');
        console.log('   3. Paste the code from drive-list-files.gs');
        console.log('   4. Change the FOLDER_ID to your folder');
        console.log('   5. Click Run → Check the Execution Log');
        console.log('   6. Copy the JSON array from the log');
        console.log('   7. Create a file: backend/scripts/drive-data.json');
        console.log('   8. Paste the JSON into that file');
        console.log('   9. Run this script again!');
        console.log('');
        process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf-8');
    let files;

    try {
        files = JSON.parse(rawData);
    } catch (e) {
        console.error('❌ Invalid JSON in drive-data.json. Make sure it is a valid JSON array.');
        process.exit(1);
    }

    if (!Array.isArray(files) || files.length === 0) {
        console.log('⚠️ No files found in drive-data.json');
        process.exit(1);
    }

    console.log(`⏳ Found ${files.length} files. Inserting into "${SUBJECT}" library...`);

    // Prepare records
    const records = files.map(file => {
        // Clean up name: remove .pdf extension, _merged, marged, (1), nw_ prefixes, underscores
        let cleanName = file.name
            .replace(/\.pdf$/i, '')
            .replace(/_merged/gi, '')
            .replace(/marged/gi, '')
            .replace(/\s*\(\d+\)/g, '')  // remove (1), (2) etc.
            .replace(/nw_/gi, '')
            .replace(/nw /gi, '')
            .replace(/Mb/gi, '')
            .replace(/_/g, ' ')
            .trim();

        // Title case
        cleanName = cleanName
            .split(' ')
            .filter(w => w.length > 0)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

        return {
            subject: SUBJECT.toLowerCase(),
            chapter_name: cleanName,
            pdf_link: file.link
        };
    });

    // Show preview
    console.log('');
    console.log('📋 Preview:');
    records.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.chapter_name}`);
    });
    console.log('');

    // Insert into Supabase
    const { data, error } = await supabase
        .from('study_materials')
        .insert(records);

    if (error) {
        console.error('❌ Supabase Insert Error:', error.message);
        
        // If duplicate error, try upsert approach
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
            console.log('🔄 Trying upsert (update existing records)...');
            for (const record of records) {
                const { error: upsertError } = await supabase
                    .from('study_materials')
                    .upsert(record, { onConflict: 'subject,chapter_name' });
                if (upsertError) {
                    console.error(`   ❌ Failed: ${record.chapter_name} — ${upsertError.message}`);
                }
            }
            console.log('✅ Upsert complete!');
        }
    } else {
        console.log(`🎉 Successfully inserted ${records.length} chapters into the "${SUBJECT}" library!`);
        console.log('');
        console.log('👉 Now refresh your Neogravix app and click on the subject to see the chapters!');
    }
}

syncFromJSON();
