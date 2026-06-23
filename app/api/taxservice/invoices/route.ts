import { NextRequest, NextResponse } from 'next/server'
import { getArtyomClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams
    const tax_account_id = p.get('tax_account_id')
    const from = p.get('from')
    const to   = p.get('to')

    if (!tax_account_id) {
      return NextResponse.json({ error: 'tax_account_id required' }, { status: 400 })
    }

    const supabase = getArtyomClient()
    let q = supabase
      .from('v_tax_invoices_issued')
      .select('id, company_id, username, tin, serial_no, type, approval_state, status, issued_at, supplier_name, buyer_name, total, total_vat_amount')
      .eq('company_id', parseInt(tax_account_id))
      .order('issued_at', { ascending: false })
      .limit(500)

    if (from) q = q.gte('issued_at', from)
    if (to)   q = q.lte('issued_at', to + 'T23:59:59')

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
