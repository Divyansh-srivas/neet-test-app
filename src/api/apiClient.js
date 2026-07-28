import { getAuth } from 'firebase/auth';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://neet-test-backend.onrender.com';

/**
 * A wrapper around fetch that automatically gets the Firebase ID token
 * and attaches it to the Authorization header.
 * 
 * @param {string} endpoint - The backend API endpoint (e.g., '/api/upload')
 * @param {RequestInit} options - fetch options
 */
export const fetchAPI = async (endpoint, options = {}) => {
  const auth = getAuth();
  
  // Await the auth state to be initialized if it's currently loading
  await new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });

  const user = auth.currentUser;
  let token = null;

  if (user) {
    try {
      token = await user.getIdToken();
    } catch (error) {
      console.error("Failed to get Firebase token:", error);
    }
  }

  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const url = `${BACKEND_URL}${endpoint}`;

  if (import.meta.env.DEV) {
    console.log(`[fetchAPI] Requesting: ${url}`);
    console.log(`[fetchAPI] Authenticated: ${!!token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  if (response.status === 401) {
    if (import.meta.env.DEV) {
      console.error(`[fetchAPI] 401 Not Authenticated on ${endpoint}`);
    }
    // Could dispatch a custom event here to trigger a logout in the UI if needed
  }

  return response;
};
