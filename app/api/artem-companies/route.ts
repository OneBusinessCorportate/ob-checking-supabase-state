import { NextResponse } from 'next/server'
import { getArtyomClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = getArtyomClient()
    const { data, error } = await supabase
      .from('artem_companies')
      .select('id, company_name, contract_number, tin, is_active')
      .order('company_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
