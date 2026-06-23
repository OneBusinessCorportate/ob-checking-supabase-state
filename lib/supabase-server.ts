import { createClient } from '@supabase/supabase-js'

// OB Artyom — accounting activities, companies, comments
export function getArtyomClient() {
  const url = process.env.ARTYOM_SUPABASE_URL
  const key = process.env.ARTYOM_SUPABASE_SERVICE_ROLE_KEY || process.env.ARTYOM_SUPABASE_ANON_KEY

  if (!url || !key) throw new Error('Missing ARTYOM_SUPABASE_URL / ARTYOM_SUPABASE_ANON_KEY env vars')

  return createClient(url, key, { auth: { persistSession: false } })
}

// OB FAQ — employees / accountants
export function getFaqClient() {
  const url = process.env.FAQ_SUPABASE_URL
  const key = process.env.FAQ_SUPABASE_SERVICE_ROLE_KEY || process.env.FAQ_SUPABASE_ANON_KEY

  if (!url || !key) throw new Error('Missing FAQ_SUPABASE_URL / FAQ_SUPABASE_ANON_KEY env vars')

  return createClient(url, key, { auth: { persistSession: false } })
}
