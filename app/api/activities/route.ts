import { NextRequest, NextResponse } from 'next/server'
import { getArtyomClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams
    const dateFrom  = p.get('from')       ?? new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    const dateTo    = p.get('to')         ?? new Date().toISOString().split('T')[0]
    const accountant = p.get('accountant') ?? 'all'
    const company    = p.get('company')    ?? 'all'
    const source     = p.get('source')     ?? 'all'

    const supabase = getArtyomClient()
    let q = supabase
      .from('accounting_activities')
      .select('*')
      .gte('activity_date', dateFrom)
      .lte('activity_date', dateTo)
      .order('activity_date', { ascending: false })

    if (accountant !== 'all') q = q.eq('accountant_name', accountant)
    if (company    !== 'all') q = q.eq('company_name', company)
    if (source     !== 'all') q = q.eq('system_source', source)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
