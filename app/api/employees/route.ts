import { NextResponse } from 'next/server'
import { getFaqClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getFaqClient()
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, role, is_active, display_aliases')
      .in('role', ['accountant', 'head_accountant'])
      .eq('is_active', true)
      .order('full_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deduplicate by full_name (OB FAQ has duplicates)
    const seen = new Set<string>()
    const unique = (data ?? []).filter(e => {
      if (seen.has(e.full_name)) return false
      seen.add(e.full_name)
      return true
    })

    return NextResponse.json(unique)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
