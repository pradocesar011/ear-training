import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase env vars not set. Database features will not work.')
}

export const supabase = createClient(
  supabaseUrl  ?? 'http://localhost:54321',
  supabaseKey  ?? 'placeholder'
)
