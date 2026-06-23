import { createClient } from '@supabase/supabase-js'

// OB Artyom — accounting activities, companies, comments
// Uses service role key server-side (bypasses RLS); falls back to anon key.
export function getArtyomClient() {
  const url = process.env.NEXT_PUBLIC_ARTYOM_SUPABASE_URL
  const key = process.env.ARTYOM_SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.NEXT_PUBLIC_ARTYOM_SUPABASE_ANON_KEY

  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_ARTYOM_SUPABASE_URL / NEXT_PUBLIC_ARTYOM_SUPABASE_ANON_KEY env vars')

  return createClient(url, key, { auth: { persistSession: false } })
}

// OB FAQ — employees / accountants
// Uses service role key server-side; falls back to anon key.
export function getFaqClient() {
  const url = process.env.NEXT_PUBLIC_FAQ_SUPABASE_URL
  const key = process.env.FAQ_SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.NEXT_PUBLIC_FAQ_SUPABASE_ANON_KEY

  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_FAQ_SUPABASE_URL / NEXT_PUBLIC_FAQ_SUPABASE_ANON_KEY env vars')

  return createClient(url, key, { auth: { persistSession: false } })
}
