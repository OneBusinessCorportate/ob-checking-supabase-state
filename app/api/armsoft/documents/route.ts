import { NextRequest, NextResponse } from 'next/server'
import { getArtyomClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams
    const armsoft_company_id = p.get('armsoft_company_id')
    const from = p.get('from')
    const to   = p.get('to')

    if (!armsoft_company_id) {
      return NextResponse.json({ error: 'armsoft_company_id required' }, { status: 400 })
    }

    const supabase = getArtyomClient()
    let q = supabase
      .from('v_armsoft_documents')
      .select('id, company_id, doc_date, doc_num, doc_type_name, curr_code, summ, part_name, part_tax_code, employee_name, doc_state_name, creator, comment')
      .eq('company_id', parseInt(armsoft_company_id))
      .order('doc_date', { ascending: false })
      .limit(500)

    if (from) q = q.gte('doc_date', from)
    if (to)   q = q.lte('doc_date', to + 'T23:59:59')

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
