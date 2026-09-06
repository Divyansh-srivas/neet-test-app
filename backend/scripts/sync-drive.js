import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase URL or Key in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Setup your Drive API Key and Folder details here
const DRIVE_API_KEY = 'YOUR_GOOGLE_DRIVE_API_KEY'; // Replace with your actual key
const FOLDER_ID = '1fRGCbBJS12anzdKuwjRU4eUxsg0vlYU9'; // Folder ID from your screenshot
const SUBJECT = 'physics'; // 'physics', 'chemistry', or 'biology'

async function syncDriveFolder() {
    console.log(`⏳ Fetching files from Google Drive folder: ${FOLDER_ID}...`);
    
    try {
        // We use the Google Drive v3 REST API
        const url = `https://www.googleapis.com/drive/v3/files?q='${FOLDER_ID}'+in+parents&fields=files(id,name,webViewLink)&key=${DRIVE_API_KEY}`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('❌ Google Drive API Error:', data.error.message);
            return;
        }

        const files = data.files;
        if (!files || files.length === 0) {
            console.log('⚠️ No files found in this folder.');
            return;
        }

        console.log(`✅ Found ${files.length} files. Syncing to database...`);

        // Prepare data for Supabase
        const records = files.map(file => {
            // Clean up name (e.g., remove .pdf, _merged)
            let cleanName = file.name.replace(/\.pdf$/i, '').replace(/_merged/gi, '').replace(/marged/gi, '').trim();
            // Capitalize each word nicely
            cleanName = cleanName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            return {
                subject: SUBJECT.toLowerCase(),
                chapter_name: cleanName,
                pdf_link: file.webViewLink
            };
        });

        // Insert into Supabase
        const { error } = await supabase
            .from('study_materials')
            .upsert(records, { onConflict: 'pdf_link' }); // Assuming pdf_link is unique, or just insert

        if (error) {
            console.error('❌ Supabase Insert Error:', error);
        } else {
            console.log(`🎉 Successfully synced ${records.length} chapters to the ${SUBJECT} library!`);
        }

    } catch (error) {
        console.error('❌ Script failed:', error);
    }
}

// Run the script
if (DRIVE_API_KEY === 'YOUR_GOOGLE_DRIVE_API_KEY') {
    console.log('⚠️ Please replace YOUR_GOOGLE_DRIVE_API_KEY with a valid Google Cloud API key inside this script.');
} else {
    syncDriveFolder();
}
