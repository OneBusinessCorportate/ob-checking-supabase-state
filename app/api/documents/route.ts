import { NextRequest, NextResponse } from 'next/server'
import { getArtyomClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams
    const company_name   = p.get('company_name')
    const accountant_name = p.get('accountant_name')
    const document_type  = p.get('document_type')
    const system_source  = p.get('system_source')
    const from           = p.get('from')
    const to             = p.get('to')

    const supabase = getArtyomClient()
    let q = supabase
      .from('document_records')
      .select('*')
      .order('document_date', { ascending: false })
      .order('id', { ascending: false })

    if (company_name)                           q = q.eq('company_name', company_name)
    if (accountant_name && accountant_name !== 'all') q = q.eq('accountant_name', accountant_name)
    if (document_type)                          q = q.eq('document_type', document_type)
    if (system_source && system_source !== 'all') q = q.eq('system_source', system_source)
    if (from) q = q.gte('document_date', from)
    if (to)   q = q.lte('document_date', to)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const supabase = getArtyomClient()
    const { data, error } = await supabase
      .from('document_records')
      .insert([body])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
