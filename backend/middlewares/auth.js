import admin from 'firebase-admin';

// Initialize Firebase Admin — project ID read from env so it works across environments
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'neogravix-v2'
  });
}

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // Attach user information. Use uid as id to match previous Supabase shape.
    req.user = { id: decodedToken.uid, ...decodedToken };
    req.token = token;
    next();
  } catch (error) {
    console.error("Firebase token verification error:", error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
