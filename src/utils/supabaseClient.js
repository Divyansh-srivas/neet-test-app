import { createClient } from '@supabase/supabase-js'
import { getAuth } from 'firebase/auth'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: async (url, options = {}) => {
      const auth = getAuth()
      const user = auth.currentUser
      if (user) {
        const token = await user.getIdToken()
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`
        }
      }
      return fetch(url, options)
    }
  }
})
