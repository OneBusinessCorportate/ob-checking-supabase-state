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
      .from('v_tax_saved_forms')
      .select('id, company_id, username, form_name, created_date, modified_date, report_period, scraped_at')
      .eq('company_id', parseInt(tax_account_id))
      .order('created_date', { ascending: false })
      .limit(300)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filter by date range (created_date is stored as "DD/MM/YY HH:MM" text)
    let rows = data ?? []
    if (from || to) {
      rows = rows.filter(row => {
        if (!row.created_date) return true
        const parts = row.created_date.split(' ')[0].split('/')
        if (parts.length < 3) return true
        const [dd, mm, yy] = parts
        const isoDate = `20${yy}-${mm}-${dd}`
        if (from && isoDate < from) return false
        if (to   && isoDate > to)   return false
        return true
      })
    }

    return NextResponse.json(rows)
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
