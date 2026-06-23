import { NextRequest, NextResponse } from 'next/server'
import { getArtyomClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams
    const dateFrom   = p.get('from')       ?? new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    const dateTo     = p.get('to')         ?? new Date().toISOString().split('T')[0]
    const accountant = p.get('accountant') ?? 'all'

    const supabase = getArtyomClient()
    let q = supabase
      .from('accountant_daily_comments')
      .select('*')
      .gte('comment_date', dateFrom)
      .lte('comment_date', dateTo)
      .order('comment_date', { ascending: false })

    if (accountant !== 'all') q = q.eq('accountant_name', accountant)

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
    const { accountant_name, company_name, comment, unaccounted_work } = body

    if (!accountant_name || !comment?.trim()) {
      return NextResponse.json({ error: 'accountant_name and comment are required' }, { status: 400 })
    }

    const today = new Date().toISOString().split('T')[0]
    const supabase = getArtyomClient()
    const { data, error } = await supabase
      .from('accountant_daily_comments')
      .insert({
        accountant_name,
        company_name: company_name || null,
        comment_date: today,
        comment: comment.trim(),
        unaccounted_work: unaccounted_work?.trim() || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
