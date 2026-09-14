import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { supabaseAdmin } from '../config/supabase.js';

// Initialize Firebase Admin — project ID read from env so it works across environments
if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'neogravix-22a21'
  });
}

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    // Attach user information. Use uid as id to match previous Supabase shape.
    req.user = { id: decodedToken.uid, ...decodedToken };
    req.token = token;

    // Auto-create/upsert the profile in Supabase to satisfy foreign key constraints
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
        id: req.user.id
    }, { onConflict: 'id' });
    
    if (profileErr) {
        console.error("Auto-upsert profile failed:", profileErr.message);
        // Try 'users' table just in case the foreign key points to a table named 'users' instead of 'profiles'
        const { error: userErr } = await supabaseAdmin.from('users').upsert({
            id: req.user.id
        }, { onConflict: 'id' });
        if (userErr) console.error("Auto-upsert users failed:", userErr.message);
    }

    next();
  } catch (error) {
    console.error("Firebase token verification error:", error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
