// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing Supabase env vars. Copy .env.example → .env.local')
}

export const supabase = createClient(url, key, {
  realtime: { params: { eventsPerSecond: 10 } },
})
