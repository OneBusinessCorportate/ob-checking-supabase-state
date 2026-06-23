'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://rbtvbsbcycdlwmrzjwun.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJidHZic2JjeWNkbHdtcnpqd3VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTg2MDYsImV4cCI6MjA5NTk3NDYwNn0.Aw6cLYNiQRNVahANyUkXehFwQI9oyUW9Hj2xjELWwk0'
)

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountingCompany = {
  id: number
  company_name: string
  contract_number: string | null
  accountant_email: string | null
  is_active: boolean
}

type ArtemCompany = {
  id: number
  company_name: string
  contract_number: string | null
  tin: string | null
  is_active: boolean
}

type Activity = {
  id: number
  company_id: number | null
  company_name: string
  accountant_email: string
  activity_date: string
  system_source: 'base' | 'armsoft' | 'taxservice'
  invoices_issued: number
  reports_submitted: number
  applications_filed: number
  balance_changes: number
}

type DailyComment = {
  id: number
  accountant_email: string
  company_id: number | null
  company_name: string | null
  comment_date: string
  comment: string
  unaccounted_work: string | null
}

type SystemTotals = { invoices: number; reports: number; applications: number; balance: number }

type CompanyRow = {
  company_name: string
  accountant_email: string
  base: SystemTotals
  armsoft: SystemTotals
  taxservice: SystemTotals
  total: SystemTotals
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACCOUNTANT_NAMES: Record<string, string> = {
  'anna.grigoryan@onebusiness.am': 'Анна Григорян',
  'mariam.petrosyan@onebusiness.am': 'Мариам Петросян',
  'lilit.sargsyan@onebusiness.am': 'Лилит Саргсян',
}

function getAccountantName(email: string): string {
  if (ACCOUNTANT_NAMES[email]) return ACCOUNTANT_NAMES[email]
  const local = email.split('@')[0]
  return local.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function today(): string {
  return toISODate(new Date())
}

function nDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toISODate(d)
}

function emptyTotals(): SystemTotals {
  return { invoices: 0, reports: 0, applications: 0, balance: 0 }
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value.toLocaleString('ru-RU')}</p>
      </div>
    </div>
  )
}

// ─── System badge ────────────────────────────────────────────────────────────

const SYS_LABELS: Record<string, string> = { base: 'База', armsoft: 'АрмСофт', taxservice: 'ТаксСервис' }
const SYS_COLORS: Record<string, string> = {
  base: 'bg-blue-100 text-blue-700',
  armsoft: 'bg-violet-100 text-violet-700',
  taxservice: 'bg-emerald-100 text-emerald-700',
}

function Pill({ sys }: { sys: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${SYS_COLORS[sys] ?? 'bg-slate-100 text-slate-600'}`}>
      {SYS_LABELS[sys] ?? sys}
    </span>
  )
}

// ─── Cell showing 4-metric mini-grid ────────────────────────────────────────

function MetricCell({ t, emptyDash = true }: { t: SystemTotals; emptyDash?: boolean }) {
  const isEmpty = t.invoices === 0 && t.reports === 0 && t.applications === 0 && t.balance === 0
  if (isEmpty && emptyDash) {
    return <span className="text-slate-300 text-sm">—</span>
  }
  return (
    <div className="grid grid-cols-4 gap-x-2 text-xs text-right min-w-[140px]">
      <span className="text-slate-400 font-medium">Инв</span>
      <span className="text-slate-400 font-medium">Отч</span>
      <span className="text-slate-400 font-medium">Зая</span>
      <span className="text-slate-400 font-medium">Ост</span>
      <span className="font-semibold text-slate-800">{t.invoices}</span>
      <span className="font-semibold text-slate-800">{t.reports}</span>
      <span className="font-semibold text-slate-800">{t.applications}</span>
      <span className="font-semibold text-slate-800">{t.balance}</span>
    </div>
  )
}

// ─── Add Comment Modal ───────────────────────────────────────────────────────

type CommentForm = { accountant_email: string; company_name: string; comment: string; unaccounted_work: string }

function AddCommentModal({
  companies,
  accountants,
  onSave,
  onClose,
}: {
  companies: AccountingCompany[]
  accountants: string[]
  onSave: (form: CommentForm) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<CommentForm>({
    accountant_email: accountants[0] ?? '',
    company_name: '',
    comment: '',
    unaccounted_work: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!form.accountant_email || !form.comment.trim()) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-base">Добавить комментарий</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Бухгалтер</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.accountant_email}
              onChange={e => setForm(f => ({ ...f, accountant_email: e.target.value }))}
            >
              {accountants.map(e => (
                <option key={e} value={e}>{getAccountantName(e)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Компания (необязательно)</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.company_name}
              onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
            >
              <option value="">— Не выбрано —</option>
              {companies.map(c => (
                <option key={c.id} value={c.company_name}>{c.company_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Комментарий к рабочему дню</label>
            <textarea
              rows={3}
              placeholder="Что было сделано сегодня…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={form.comment}
              onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Что не учтено в таблице</label>
            <textarea
              rows={2}
              placeholder="Работа, которая не отражена в цифрах…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={form.unaccounted_work}
              onChange={e => setForm(f => ({ ...f, unaccounted_work: e.target.value }))}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100">
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.comment.trim()}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

type Tab = 'companies' | 'missing' | 'comments'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [ourCompanies, setOurCompanies] = useState<AccountingCompany[]>([])
  const [artemCompanies, setArtemCompanies] = useState<ArtemCompany[]>([])
  const [comments, setComments] = useState<DailyComment[]>([])

  const [selectedAccountant, setSelectedAccountant] = useState('all')
  const [dateFrom, setDateFrom] = useState(nDaysAgo(6))
  const [dateTo, setDateTo] = useState(today())
  const [activeTab, setActiveTab] = useState<Tab>('companies')
  const [showModal, setShowModal] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('accounting_activities')
        .select('*')
        .gte('activity_date', dateFrom)
        .lte('activity_date', dateTo)
        .order('activity_date', { ascending: false })

      if (selectedAccountant !== 'all') {
        q = q.eq('accountant_email', selectedAccountant)
      }

      let cq = supabase
        .from('accountant_daily_comments')
        .select('*')
        .gte('comment_date', dateFrom)
        .lte('comment_date', dateTo)
        .order('comment_date', { ascending: false })

      if (selectedAccountant !== 'all') {
        cq = cq.eq('accountant_email', selectedAccountant)
      }

      const [aRes, ocRes, arRes, cmRes] = await Promise.all([
        q,
        supabase.from('ob_accounting_companies').select('*').order('company_name'),
        supabase.from('artem_companies').select('*').order('company_name'),
        cq,
      ])

      setActivities(aRes.data ?? [])
      setOurCompanies(ocRes.data ?? [])
      setArtemCompanies(arRes.data ?? [])
      setComments(cmRes.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, selectedAccountant])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived: company stats ────────────────────────────────────────────────

  const companyRows = useMemo<CompanyRow[]>(() => {
    const map = new Map<string, CompanyRow>()

    activities.forEach(a => {
      let row = map.get(a.company_name)
      if (!row) {
        row = {
          company_name: a.company_name,
          accountant_email: a.accountant_email,
          base: emptyTotals(),
          armsoft: emptyTotals(),
          taxservice: emptyTotals(),
          total: emptyTotals(),
        }
        map.set(a.company_name, row)
      }
      const sys = row[a.system_source as 'base' | 'armsoft' | 'taxservice']
      sys.invoices += a.invoices_issued
      sys.reports += a.reports_submitted
      sys.applications += a.applications_filed
      sys.balance += a.balance_changes
      row.total.invoices += a.invoices_issued
      row.total.reports += a.reports_submitted
      row.total.applications += a.applications_filed
      row.total.balance += a.balance_changes
    })

    return Array.from(map.values()).sort((a, b) => a.company_name.localeCompare(b.company_name, 'ru'))
  }, [activities])

  // ── Derived: global totals ────────────────────────────────────────────────

  const globalTotals = useMemo(() => {
    return companyRows.reduce(
      (acc, r) => ({
        invoices: acc.invoices + r.total.invoices,
        reports: acc.reports + r.total.reports,
        applications: acc.applications + r.total.applications,
        balance: acc.balance + r.total.balance,
      }),
      emptyTotals()
    )
  }, [companyRows])

  // ── Derived: missing companies ────────────────────────────────────────────

  const missingCompanies = useMemo(() => {
    const ourNames = new Set(ourCompanies.map(c => c.company_name.trim().toLowerCase()))
    return artemCompanies.filter(c => !ourNames.has(c.company_name.trim().toLowerCase()))
  }, [ourCompanies, artemCompanies])

  // ── Derived: accountant list ──────────────────────────────────────────────

  const accountants = useMemo(() => {
    const emails = [...new Set(ourCompanies.map(c => c.accountant_email).filter(Boolean) as string[])]
    return emails.sort()
  }, [ourCompanies])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const setPreset = (preset: 'today' | 'week' | 'month') => {
    const t = today()
    if (preset === 'today') { setDateFrom(t); setDateTo(t) }
    else if (preset === 'week') { setDateFrom(nDaysAgo(6)); setDateTo(t) }
    else { setDateFrom(nDaysAgo(29)); setDateTo(t) }
  }

  const toggleRow = (name: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const handleAddComment = async (form: CommentForm) => {
    await supabase.from('accountant_daily_comments').insert({
      accountant_email: form.accountant_email,
      company_name: form.company_name || null,
      comment_date: today(),
      comment: form.comment,
      unaccounted_work: form.unaccounted_work || null,
    })
    setShowModal(false)
    fetchData()
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              OB
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Отчётность бухгалтерии</h1>
              <p className="text-xs text-slate-500">OneBusiness · мониторинг действий по компаниям</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Accountant filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 whitespace-nowrap">Бухгалтер:</label>
              <select
                value={selectedAccountant}
                onChange={e => setSelectedAccountant(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="all">Все бухгалтеры</option>
                {accountants.map(e => (
                  <option key={e} value={e}>{getAccountantName(e)}</option>
                ))}
              </select>
            </div>

            {/* Date presets */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium bg-white">
              {[
                { label: 'Сегодня', key: 'today' },
                { label: '7 дней', key: 'week' },
                { label: '30 дней', key: 'month' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key as 'today' | 'week' | 'month')}
                  className="px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-r last:border-r-0 border-slate-200"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span>—</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {loading && (
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* ── Stats Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard title="Компаний в работе" value={ourCompanies.length} icon="🏢" color="bg-indigo-50 text-indigo-600" />
          <StatCard title="Выписано инвойсов" value={globalTotals.invoices} icon="🧾" color="bg-emerald-50 text-emerald-600" />
          <StatCard title="Сдано отчётности" value={globalTotals.reports} icon="📋" color="bg-violet-50 text-violet-600" />
          <StatCard title="Подано заявлений" value={globalTotals.applications} icon="📝" color="bg-amber-50 text-amber-600" />
          <StatCard title="Изменений остатков" value={globalTotals.balance} icon="⚖️" color="bg-rose-50 text-rose-600" />
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div className="border-b border-slate-200 flex gap-0">
          {[
            { key: 'companies', label: `По компаниям (${companyRows.length})` },
            { key: 'missing',   label: `⚠️ У Артема, нет у нас (${missingCompanies.length})` },
            { key: 'comments',  label: `💬 Комментарии (${comments.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as Tab)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.key
                  ? 'border-indigo-600 text-indigo-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Companies ─────────────────────────────────────────── */}
        {activeTab === 'companies' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">
                Активность по компаниям — {formatDate(dateFrom)} … {formatDate(dateTo)}
              </h2>
              <div className="flex gap-2 text-xs">
                <Pill sys="base" />
                <Pill sys="armsoft" />
                <Pill sys="taxservice" />
              </div>
            </div>

            {companyRows.length === 0 && !loading ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-3xl mb-2">📭</p>
                <p className="text-sm">Нет данных за выбранный период</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-medium">
                      <th className="text-left px-5 py-3 whitespace-nowrap">Компания</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Бухгалтер</th>
                      <th className="text-center px-4 py-3 whitespace-nowrap bg-blue-50/50 border-x border-blue-100">
                        База (База данных)
                      </th>
                      <th className="text-center px-4 py-3 whitespace-nowrap bg-violet-50/50 border-x border-violet-100">
                        АрмСофт
                      </th>
                      <th className="text-center px-4 py-3 whitespace-nowrap bg-emerald-50/50 border-x border-emerald-100">
                        ТаксСервис
                      </th>
                      <th className="text-center px-4 py-3 whitespace-nowrap font-bold text-slate-700">
                        Итого
                      </th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400">
                      <th colSpan={2} />
                      {['bg-blue-50/30 border-x border-blue-100', 'bg-violet-50/30 border-x border-violet-100', 'bg-emerald-50/30 border-x border-emerald-100', ''].map((cls, i) => (
                        <th key={i} className={`${cls} py-1`}>
                          <div className="grid grid-cols-4 gap-x-2 text-center px-4 min-w-[140px]">
                            <span>Инв</span><span>Отч</span><span>Зая</span><span>Ост</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companyRows.map((row, idx) => (
                      <tr
                        key={row.company_name}
                        className={`hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">
                          {row.company_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {getAccountantName(row.accountant_email).charAt(0)}
                            </span>
                            <span className="text-slate-600 text-xs">{getAccountantName(row.accountant_email)}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 bg-blue-50/30 border-x border-blue-100">
                          <MetricCell t={row.base} />
                        </td>
                        <td className="px-4 py-3 bg-violet-50/30 border-x border-violet-100">
                          <MetricCell t={row.armsoft} />
                        </td>
                        <td className="px-4 py-3 bg-emerald-50/30 border-x border-emerald-100">
                          <MetricCell t={row.taxservice} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-x-2 text-xs text-right min-w-[140px]">
                            <span className="text-slate-400 font-medium">Инв</span>
                            <span className="text-slate-400 font-medium">Отч</span>
                            <span className="text-slate-400 font-medium">Зая</span>
                            <span className="text-slate-400 font-medium">Ост</span>
                            <span className="font-bold text-slate-900">{row.total.invoices}</span>
                            <span className="font-bold text-slate-900">{row.total.reports}</span>
                            <span className="font-bold text-slate-900">{row.total.applications}</span>
                            <span className="font-bold text-slate-900">{row.total.balance}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals footer */}
                  {companyRows.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-800 text-sm">
                        <td className="px-5 py-3" colSpan={2}>Итого по всем компаниям</td>
                        <td className="px-4 py-3 bg-blue-50 border-x border-blue-200" colSpan={3} />
                        <td className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-x-2 text-xs text-right min-w-[140px]">
                            <span className="text-slate-500">Инв</span>
                            <span className="text-slate-500">Отч</span>
                            <span className="text-slate-500">Зая</span>
                            <span className="text-slate-500">Ост</span>
                            <span className="text-indigo-700 font-extrabold">{globalTotals.invoices}</span>
                            <span className="text-violet-700 font-extrabold">{globalTotals.reports}</span>
                            <span className="text-amber-700 font-extrabold">{globalTotals.applications}</span>
                            <span className="text-rose-700 font-extrabold">{globalTotals.balance}</span>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Missing Companies ─────────────────────────────────── */}
        {activeTab === 'missing' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">
                  Компании у Артема, которых нет в бухгалтерии
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Всего у Артема: {artemCompanies.length} · В нашей базе: {ourCompanies.length} · Пропущено: {missingCompanies.length}
                </p>
              </div>
              <span className="text-2xl font-bold text-rose-600">{missingCompanies.length}</span>
            </div>

            {missingCompanies.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-3xl mb-2">✅</p>
                <p className="text-sm">Все компании Артема есть в бухгалтерии</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-medium">
                      <th className="text-left px-5 py-3">#</th>
                      <th className="text-left px-4 py-3">Компания</th>
                      <th className="text-left px-4 py-3">Номер договора</th>
                      <th className="text-left px-4 py-3">ИНН / НЗОУ</th>
                      <th className="text-left px-4 py-3">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {missingCompanies.map((c, i) => (
                      <tr key={c.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="px-5 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{c.company_name}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.contract_number ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs">{c.tin ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                            ⚠️ Не добавлена
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary comparison */}
            <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 grid grid-cols-3 gap-4 text-center text-sm">
              <div>
                <p className="text-2xl font-bold text-slate-800">{artemCompanies.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Всего у Артема</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{ourCompanies.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">В нашей бухгалтерии</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-600">{missingCompanies.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Нужно добавить</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Daily Comments ────────────────────────────────────── */}
        {activeTab === 'comments' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Ежедневные комментарии бухгалтеров</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Что не учтено в цифрах — записывает каждый бухгалтер за каждый день
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <span>+</span> Добавить комментарий
              </button>
            </div>

            {comments.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-sm">Нет комментариев за выбранный период</p>
                <button
                  onClick={() => setShowModal(true)}
                  className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Добавить первый
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {comments.map(c => (
                  <div key={c.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {formatDate(c.comment_date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                          {getAccountantName(c.accountant_email).charAt(0)}
                        </span>
                        <span className="text-sm font-medium text-slate-700">{getAccountantName(c.accountant_email)}</span>
                      </span>
                      {c.company_name && (
                        <span className="text-xs text-slate-500 bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          {c.company_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{c.comment}</p>
                    {c.unaccounted_work && (
                      <div className="mt-2 px-3 py-2 bg-amber-50 border-l-2 border-amber-300 rounded-r-lg">
                        <p className="text-xs font-semibold text-amber-700 mb-0.5">Не учтено в таблице:</p>
                        <p className="text-xs text-amber-800">{c.unaccounted_work}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-slate-400 py-4">
          OneBusiness Accounting Dashboard · OB Artyom DB · Данные обновляются при смене фильтров
        </footer>
      </main>

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      {showModal && (
        <AddCommentModal
          companies={ourCompanies}
          accountants={accountants}
          onSave={handleAddComment}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
