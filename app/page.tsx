'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import type {
  Activity, AccountingCompany, ArtemCompany, DailyComment,
  Employee, CompanyRow, SystemTotals, DocumentRecord,
  ArmSoftInvoice, ArmSoftDocument, TaxForm, TaxServiceInvoice,
} from '@/lib/types'

// ─── Local types ──────────────────────────────────────────────────────────────

type DocType = 'invoice' | 'report' | 'application' | 'balance_change'

type CellClickParams = {
  company_name: string
  accountant_name: string
  system_source: string
  document_type: DocType
  date_from: string
  date_to: string
  armsoft_company_id: number | null
  tax_account_id: number | null
}

type MetricContext = {
  company_name: string
  accountant_name: string
  system_source: string
  date_from: string
  date_to: string
  armsoft_company_id: number | null
  tax_account_id: number | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABEL: Record<DocType, string> = {
  invoice: 'Инвойсы',
  report: 'Отчётность',
  application: 'Заявления',
  balance_change: 'Изменения остатков',
}

const DOC_TYPE_ICON: Record<DocType, string> = {
  invoice: '🧾',
  report: '📋',
  application: '📝',
  balance_change: '⚖️',
}

const DOC_FIELD: Record<DocType, 'invoices_issued' | 'reports_submitted' | 'applications_filed' | 'balance_changes'> = {
  invoice: 'invoices_issued',
  report: 'reports_submitted',
  application: 'applications_filed',
  balance_change: 'balance_changes',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() { return new Date().toISOString().split('T')[0] }
function nDaysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
}
function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
function fmtMoney(v: number | string | null) {
  if (v == null) return '—'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n)) return String(v)
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
function emptyTotals(): SystemTotals { return { invoices: 0, reports: 0, applications: 0, balance: 0 } }

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function Spinner() {
  return <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
}

function KpiCard({ label, value, sub, icon, accent }: {
  label: string; value: number | string; sub?: string; icon: string; accent: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex gap-4 items-center">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${accent}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const SRC_LABEL: Record<string, string> = { base: 'База', armsoft: 'АрмСофт', taxservice: 'ТаксСервис' }
const SRC_PILL: Record<string, string> = {
  base: 'bg-blue-100 text-blue-700',
  armsoft: 'bg-violet-100 text-violet-700',
  taxservice: 'bg-emerald-100 text-emerald-700',
}

function SourcePill({ src }: { src: string }) {
  if (src === 'all') {
    return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">Все системы</span>
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${SRC_PILL[src] ?? 'bg-slate-100 text-slate-500'}`}>
      {SRC_LABEL[src] ?? src}
    </span>
  )
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return (
    <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
      {initials}
    </span>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const s = status.toUpperCase()
  const cls = s === 'APPROVED' ? 'bg-emerald-100 text-emerald-700'
    : s === 'REJECTED' ? 'bg-rose-100 text-rose-700'
    : s === 'PENDING' ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600'
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{status}</span>
}

function MetricGrid({ t, dim, context, onCellClick }: {
  t: SystemTotals
  dim?: boolean
  context?: MetricContext
  onCellClick?: (p: CellClickParams) => void
}) {
  const empty = t.invoices === 0 && t.reports === 0 && t.applications === 0 && t.balance === 0
  if (empty) return <span className="text-slate-300 text-sm select-none">—</span>

  const cell = (count: number, doc_type: DocType) => {
    if (context && onCellClick && count > 0) {
      return (
        <button
          onClick={() => onCellClick({ ...context, document_type: doc_type })}
          className="font-semibold text-indigo-700 hover:text-indigo-900 hover:underline cursor-pointer tabular-nums leading-none"
        >
          {count}
        </button>
      )
    }
    return <span className={`font-semibold tabular-nums ${count === 0 ? 'text-slate-300' : 'text-slate-800'}`}>{count}</span>
  }

  return (
    <div className={`grid grid-cols-4 gap-x-3 text-xs text-right min-w-[130px] ${dim ? 'opacity-50' : ''}`}>
      <span className="text-slate-400 font-medium">Инв</span>
      <span className="text-slate-400 font-medium">Отч</span>
      <span className="text-slate-400 font-medium">Зая</span>
      <span className="text-slate-400 font-medium">Ост</span>
      {cell(t.invoices, 'invoice')}
      {cell(t.reports, 'report')}
      {cell(t.applications, 'application')}
      {cell(t.balance, 'balance_change')}
    </div>
  )
}

// ─── Document Detail Modal ─────────────────────────────────────────────────────

type ModalTab = 'activity' | 'armsoft_invoices' | 'armsoft_docs' | 'tax_forms' | 'tax_invoices' | 'manual_docs'

function DocumentDetailModal({ params, onClose }: { params: CellClickParams; onClose: () => void }) {
  const [acts,         setActs]        = useState<Activity[]>([])
  const [armsoftInvs,  setArmsoftInvs] = useState<ArmSoftInvoice[]>([])
  const [armsoftDocs,  setArmsoftDocs] = useState<ArmSoftDocument[]>([])
  const [taxForms,     setTaxForms]    = useState<TaxForm[]>([])
  const [taxInvs,      setTaxInvs]     = useState<TaxServiceInvoice[]>([])
  const [manualDocs,   setManualDocs]  = useState<DocumentRecord[]>([])
  const [loading,      setLoading]     = useState(true)
  const [fetchError,   setFetchError]  = useState('')

  const [activeTab, setActiveTab] = useState<ModalTab>('activity')

  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    document_number: '', document_date: today(), description: '', amount: '', period: '', notes: '',
  })
  const [saving,     setSaving]    = useState(false)
  const [saveError,  setSaveError] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true); setFetchError('')
    try {
      const base = { from: params.date_from, to: params.date_to }

      // Always fetch activity breakdown
      const ap = new URLSearchParams({
        ...base,
        company: params.company_name,
        accountant: params.accountant_name !== '—' ? params.accountant_name : 'all',
      })
      if (params.system_source !== 'all') ap.set('source', params.system_source)

      // Manual docs
      const dp = new URLSearchParams({
        company_name: params.company_name,
        document_type: params.document_type,
        ...base,
      })
      if (params.system_source !== 'all') dp.set('system_source', params.system_source)
      if (params.accountant_name !== '—') dp.set('accountant_name', params.accountant_name)

      const fetches: Promise<Response>[] = [
        fetch(`/api/activities?${ap}`),
        fetch(`/api/documents?${dp}`),
      ]

      // Real armsoft data
      if (params.armsoft_company_id) {
        const aip = new URLSearchParams({ armsoft_company_id: String(params.armsoft_company_id), ...base })
        fetches.push(fetch(`/api/armsoft/invoices?${aip}`))
        const adp = new URLSearchParams({ armsoft_company_id: String(params.armsoft_company_id), ...base })
        fetches.push(fetch(`/api/armsoft/documents?${adp}`))
      }

      // Real taxservice data
      if (params.tax_account_id) {
        const tfp = new URLSearchParams({ tax_account_id: String(params.tax_account_id), ...base })
        fetches.push(fetch(`/api/taxservice/forms?${tfp}`))
        const tip = new URLSearchParams({ tax_account_id: String(params.tax_account_id), ...base })
        fetches.push(fetch(`/api/taxservice/invoices?${tip}`))
      }

      const responses = await Promise.all(fetches)
      const jsons = await Promise.all(responses.map(r => r.json()))

      let idx = 0
      const actData  = jsons[idx++]
      const docData  = jsons[idx++]

      const field = DOC_FIELD[params.document_type]
      const relevant = (Array.isArray(actData) ? actData as Activity[] : [])
        .filter(a => (a[field] as number) > 0)
        .sort((a, b) => b.activity_date.localeCompare(a.activity_date))
      setActs(relevant)
      setManualDocs(Array.isArray(docData) ? docData : [])

      if (params.armsoft_company_id) {
        setArmsoftInvs(Array.isArray(jsons[idx]) ? jsons[idx] : []); idx++
        setArmsoftDocs(Array.isArray(jsons[idx]) ? jsons[idx] : []); idx++
      }
      if (params.tax_account_id) {
        setTaxForms(Array.isArray(jsons[idx]) ? jsons[idx] : []); idx++
        setTaxInvs(Array.isArray(jsons[idx]) ? jsons[idx] : [])
      }

      // Auto-select best tab
      if (params.armsoft_company_id && params.system_source === 'armsoft') {
        setActiveTab(params.document_type === 'invoice' ? 'armsoft_invoices' : 'armsoft_docs')
      } else if (params.tax_account_id && params.system_source === 'taxservice') {
        setActiveTab(params.document_type === 'invoice' ? 'tax_invoices' : 'tax_forms')
      } else {
        setActiveTab('activity')
      }
    } catch (e) {
      setFetchError(String(e))
    } finally {
      setLoading(false)
    }
  }, [params])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSave = async () => {
    setSaving(true); setSaveError('')
    try {
      const body = {
        company_name: params.company_name,
        accountant_name: params.accountant_name !== '—' ? params.accountant_name : null,
        document_type: params.document_type,
        system_source: params.system_source !== 'all' ? params.system_source : 'base',
        document_number: addForm.document_number || null,
        document_date: addForm.document_date,
        description: addForm.description || null,
        amount: addForm.amount ? parseFloat(addForm.amount) : null,
        period: addForm.period || null,
        notes: addForm.notes || null,
      }
      const res = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Ошибка') }
      setShowAddForm(false)
      setAddForm({ document_number: '', document_date: today(), description: '', amount: '', period: '', notes: '' })
      fetchAll()
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const sysLabel = params.system_source !== 'all' ? (SRC_LABEL[params.system_source] ?? params.system_source) : 'Все системы'
  const field = DOC_FIELD[params.document_type]
  const totalActivityCount = acts.reduce((s, a) => s + (a[field] as number), 0)

  const tabs: { key: ModalTab; label: string; count: number; show: boolean }[] = [
    { key: 'activity',       label: 'Активность по дням',   count: acts.length,       show: true },
    { key: 'armsoft_invoices', label: 'АрмСофт: Инвойсы',   count: armsoftInvs.length, show: !!params.armsoft_company_id },
    { key: 'armsoft_docs',   label: 'АрмСофт: Документы',   count: armsoftDocs.length, show: !!params.armsoft_company_id },
    { key: 'tax_forms',      label: 'ТаксСервис: Формы',    count: taxForms.length,   show: !!params.tax_account_id },
    { key: 'tax_invoices',   label: 'ТаксСервис: Инвойсы',  count: taxInvs.length,    show: !!params.tax_account_id },
    { key: 'manual_docs',    label: 'Прикреплённые',         count: manualDocs.length, show: true },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xl">{DOC_TYPE_ICON[params.document_type]}</span>
                <h2 className="font-bold text-slate-900 text-lg leading-tight">{DOC_TYPE_LABEL[params.document_type]}</h2>
                <span className="text-slate-300 font-light text-lg">·</span>
                <span className="font-semibold text-slate-700 text-lg leading-tight truncate max-w-[280px]">{params.company_name}</span>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <SourcePill src={params.system_source} />
                <span className="text-xs text-slate-400">{fmtDate(params.date_from)} — {fmtDate(params.date_to)}</span>
                {params.accountant_name && params.accountant_name !== '—' && (
                  <div className="flex items-center gap-1.5">
                    <Avatar name={params.accountant_name} />
                    <span className="text-xs text-slate-600">{params.accountant_name}</span>
                  </div>
                )}
                {params.armsoft_company_id && (
                  <span className="text-[10px] text-violet-500 bg-violet-50 px-2 py-0.5 rounded-full">
                    ArmSoft ID: {params.armsoft_company_id}
                  </span>
                )}
                {params.tax_account_id && (
                  <span className="text-[10px] text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Tax ID: {params.tax_account_id}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none flex-shrink-0 mt-0.5">×</button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : fetchError ? (
          <div className="px-6 py-8 text-center text-rose-500 text-sm">{fetchError}</div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-slate-100 flex-shrink-0 bg-slate-50/50">
              {tabs.filter(t => t.show).map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 border-b-2 transition-colors ${
                    activeTab === t.key
                      ? 'border-indigo-600 text-indigo-700 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums ${
                      activeTab === t.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
                    }`}>{t.count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto min-h-0">

              {/* Activity tab */}
              {activeTab === 'activity' && (
                <div>
                  {acts.length === 0 ? (
                    <div className="px-5 py-10 text-center text-slate-400 text-xs">Нет активностей за выбранный период</div>
                  ) : (
                    <>
                      <div className="px-5 py-2.5 bg-slate-50 flex items-center justify-between border-b border-slate-100">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Активность по дням</span>
                        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">итого: {totalActivityCount}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-5 py-2">Дата</th>
                            <th className="text-left px-4 py-2">Бухгалтер</th>
                            <th className="text-left px-4 py-2">Система</th>
                            <th className="text-right px-5 py-2">Кол-во</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {acts.map(a => (
                            <tr key={a.id} className="hover:bg-indigo-50/20">
                              <td className="px-5 py-2.5 text-xs font-semibold text-slate-700 whitespace-nowrap">{fmtDate(a.activity_date)}</td>
                              <td className="px-4 py-2.5"><div className="flex items-center gap-1.5"><Avatar name={a.accountant_name} /><span className="text-xs text-slate-600">{a.accountant_name}</span></div></td>
                              <td className="px-4 py-2.5"><SourcePill src={a.system_source} /></td>
                              <td className="px-5 py-2.5 text-right"><span className="text-sm font-bold text-indigo-700 tabular-nums">{a[field] as number}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ArmSoft Invoices tab */}
              {activeTab === 'armsoft_invoices' && (
                <div>
                  {armsoftInvs.length === 0 ? (
                    <div className="px-5 py-10 text-center text-slate-400 text-xs">Нет инвойсов в АрмСофт за выбранный период</div>
                  ) : (
                    <>
                      <div className="px-5 py-2.5 bg-violet-50/60 flex items-center justify-between border-b border-violet-100">
                        <span className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">Выставленные инвойсы (АрмСофт)</span>
                        <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">{armsoftInvs.length} шт.</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                              <th className="text-left px-4 py-2 whitespace-nowrap">Дата</th>
                              <th className="text-left px-4 py-2 whitespace-nowrap">№ Докум.</th>
                              <th className="text-left px-4 py-2">Тип</th>
                              <th className="text-left px-4 py-2">Контрагент</th>
                              <th className="text-left px-4 py-2 whitespace-nowrap">ИНН контраг.</th>
                              <th className="text-right px-4 py-2 whitespace-nowrap">Сумма</th>
                              <th className="text-left px-4 py-2">Валюта</th>
                              <th className="text-left px-4 py-2">Статус</th>
                              <th className="text-left px-4 py-2">Е-Накл</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {armsoftInvs.map((inv, i) => (
                              <tr key={inv.id} className={`hover:bg-violet-50/20 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                                <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{inv.doc_date ? fmtDate(inv.doc_date.split('T')[0]) : '—'}</td>
                                <td className="px-4 py-2 font-mono text-xs text-indigo-600 whitespace-nowrap">{inv.doc_num ?? '—'}</td>
                                <td className="px-4 py-2 text-xs text-slate-600 max-w-[120px]"><span className="block truncate" title={inv.doc_type_name ?? undefined}>{inv.doc_type_name ?? '—'}</span></td>
                                <td className="px-4 py-2 text-xs text-slate-700 max-w-[160px]"><span className="block truncate" title={inv.part_name ?? undefined}>{inv.part_name ?? '—'}</span></td>
                                <td className="px-4 py-2 font-mono text-xs text-slate-500 whitespace-nowrap">{inv.part_tax_code ?? '—'}</td>
                                <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">{fmtMoney(inv.summ)}</td>
                                <td className="px-4 py-2 text-xs text-slate-500">{inv.curr_code ?? '—'}</td>
                                <td className="px-4 py-2 whitespace-nowrap"><StatusBadge status={inv.doc_state_name} /></td>
                                <td className="px-4 py-2 font-mono text-[10px] text-slate-400 whitespace-nowrap max-w-[120px]"><span className="block truncate">{inv.tax_invoice_serial_and_number ?? '—'}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ArmSoft Documents tab */}
              {activeTab === 'armsoft_docs' && (
                <div>
                  {armsoftDocs.length === 0 ? (
                    <div className="px-5 py-10 text-center text-slate-400 text-xs">Нет документов в АрмСофт за выбранный период</div>
                  ) : (
                    <>
                      <div className="px-5 py-2.5 bg-violet-50/60 flex items-center justify-between border-b border-violet-100">
                        <span className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">Журнал документов (АрмСофт)</span>
                        <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full">{armsoftDocs.length} шт.</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                              <th className="text-left px-4 py-2 whitespace-nowrap">Дата</th>
                              <th className="text-left px-4 py-2 whitespace-nowrap">№</th>
                              <th className="text-left px-4 py-2">Тип документа</th>
                              <th className="text-left px-4 py-2">Контрагент</th>
                              <th className="text-right px-4 py-2">Сумма</th>
                              <th className="text-left px-4 py-2">Сотрудник</th>
                              <th className="text-left px-4 py-2">Статус</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {armsoftDocs.map((doc, i) => (
                              <tr key={doc.id} className={`hover:bg-violet-50/20 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                                <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{doc.doc_date ? fmtDate(doc.doc_date.split('T')[0]) : '—'}</td>
                                <td className="px-4 py-2 font-mono text-xs text-indigo-600 whitespace-nowrap">{doc.doc_num ?? '—'}</td>
                                <td className="px-4 py-2 text-xs text-slate-600 max-w-[140px]"><span className="block truncate" title={doc.doc_type_name ?? undefined}>{doc.doc_type_name ?? '—'}</span></td>
                                <td className="px-4 py-2 text-xs text-slate-700 max-w-[150px]"><span className="block truncate" title={doc.part_name ?? undefined}>{doc.part_name ?? '—'}</span></td>
                                <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-slate-800">{fmtMoney(doc.summ)}</td>
                                <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap max-w-[120px]"><span className="block truncate">{doc.employee_name ?? '—'}</span></td>
                                <td className="px-4 py-2 whitespace-nowrap"><StatusBadge status={doc.doc_state_name} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tax Forms tab */}
              {activeTab === 'tax_forms' && (
                <div>
                  {taxForms.length === 0 ? (
                    <div className="px-5 py-10 text-center text-slate-400 text-xs">Нет налоговых форм за выбранный период</div>
                  ) : (
                    <>
                      <div className="px-5 py-2.5 bg-emerald-50/60 flex items-center justify-between border-b border-emerald-100">
                        <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Налоговые формы (ТаксСервис)</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{taxForms.length} шт.</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                              <th className="text-left px-4 py-2 whitespace-nowrap">Создано</th>
                              <th className="text-left px-4 py-2 whitespace-nowrap">Изменено</th>
                              <th className="text-left px-4 py-2">Название формы</th>
                              <th className="text-left px-4 py-2 whitespace-nowrap">Период отчёта</th>
                              <th className="text-left px-4 py-2">Логин</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {taxForms.map((form, i) => (
                              <tr key={form.id} className={`hover:bg-emerald-50/20 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                                <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{form.created_date ?? '—'}</td>
                                <td className="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">{form.modified_date || '—'}</td>
                                <td className="px-4 py-2 text-xs text-slate-700 max-w-[300px]"><span className="block truncate" title={form.form_name ?? undefined}>{form.form_name ?? '—'}</span></td>
                                <td className="px-4 py-2 text-xs font-medium text-emerald-700 whitespace-nowrap">{form.report_period ?? '—'}</td>
                                <td className="px-4 py-2 font-mono text-[10px] text-slate-400">{form.username ?? '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tax Invoices tab */}
              {activeTab === 'tax_invoices' && (
                <div>
                  {taxInvs.length === 0 ? (
                    <div className="px-5 py-10 text-center text-slate-400 text-xs">Нет налоговых инвойсов за выбранный период</div>
                  ) : (
                    <>
                      <div className="px-5 py-2.5 bg-emerald-50/60 flex items-center justify-between border-b border-emerald-100">
                        <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Выставленные инвойсы (ТаксСервис)</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{taxInvs.length} шт.</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-100 bg-slate-50">
                              <th className="text-left px-4 py-2 whitespace-nowrap">Дата выставления</th>
                              <th className="text-left px-4 py-2 whitespace-nowrap">Серийный №</th>
                              <th className="text-left px-4 py-2">Поставщик</th>
                              <th className="text-left px-4 py-2">Покупатель</th>
                              <th className="text-right px-4 py-2">Сумма</th>
                              <th className="text-right px-4 py-2">НДС</th>
                              <th className="text-left px-4 py-2">Тип</th>
                              <th className="text-left px-4 py-2">Статус</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {taxInvs.map((inv, i) => (
                              <tr key={inv.id} className={`hover:bg-emerald-50/20 ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                                <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{fmtDateTime(inv.issued_at)}</td>
                                <td className="px-4 py-2 font-mono text-[10px] text-indigo-600 whitespace-nowrap">{inv.serial_no ?? '—'}</td>
                                <td className="px-4 py-2 text-xs text-slate-700 max-w-[160px]"><span className="block truncate" title={inv.supplier_name ?? undefined}>{inv.supplier_name ?? '—'}</span></td>
                                <td className="px-4 py-2 text-xs text-slate-700 max-w-[160px]"><span className="block truncate" title={inv.buyer_name ?? undefined}>{inv.buyer_name ?? '—'}</span></td>
                                <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">{fmtMoney(inv.total)}</td>
                                <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 whitespace-nowrap">{fmtMoney(inv.total_vat_amount)}</td>
                                <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{inv.type ?? '—'}</td>
                                <td className="px-4 py-2 whitespace-nowrap"><StatusBadge status={inv.approval_state} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Manual docs tab */}
              {activeTab === 'manual_docs' && (
                <div>
                  <div className="px-5 py-2.5 bg-slate-50 flex items-center justify-between border-b border-slate-100">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Прикреплённые документы</span>
                    {manualDocs.length > 0 && <span className="text-xs text-slate-400">{manualDocs.length} шт.</span>}
                  </div>
                  {manualDocs.length === 0 && !showAddForm ? (
                    <div className="px-5 py-8 text-center text-slate-400 text-xs">Документы не прикреплены — нажмите «Добавить документ»</div>
                  ) : manualDocs.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-100">
                            <th className="text-left px-4 py-2">#</th>
                            <th className="text-left px-4 py-2 whitespace-nowrap">Дата</th>
                            <th className="text-left px-4 py-2 whitespace-nowrap">№ документа</th>
                            <th className="text-left px-4 py-2">Описание</th>
                            <th className="text-right px-4 py-2 whitespace-nowrap">Сумма</th>
                            <th className="text-left px-4 py-2">Период</th>
                            <th className="text-left px-4 py-2">Заметки</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {manualDocs.map((doc, i) => (
                            <tr key={doc.id} className={`hover:bg-indigo-50/20 ${i % 2 ? 'bg-slate-50/20' : ''}`}>
                              <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{i + 1}</td>
                              <td className="px-4 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">{fmtDate(doc.document_date)}</td>
                              <td className="px-4 py-2.5 font-mono text-xs text-indigo-600 whitespace-nowrap">{doc.document_number ?? '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-slate-700 max-w-[180px]"><span className="block truncate" title={doc.description ?? undefined}>{doc.description ?? '—'}</span></td>
                              <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{doc.amount != null ? doc.amount.toLocaleString('ru-RU') : '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">{doc.period ?? '—'}</td>
                              <td className="px-4 py-2.5 text-xs text-slate-500 max-w-[150px]"><span className="block truncate" title={doc.notes ?? undefined}>{doc.notes ?? '—'}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {showAddForm && (
                    <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/50">
                      <h3 className="text-sm font-semibold text-slate-700 mb-4">Новый документ</h3>
                      {saveError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{saveError}</p>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Дата *</span>
                          <input type="date" value={addForm.document_date}
                            onChange={e => setAddForm(f => ({ ...f, document_date: e.target.value }))}
                            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">№ документа</span>
                          <input type="text" placeholder="ИНВ-001" value={addForm.document_number}
                            onChange={e => setAddForm(f => ({ ...f, document_number: e.target.value }))}
                            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Описание</span>
                          <input type="text" placeholder="Краткое описание документа" value={addForm.description}
                            onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Сумма</span>
                          <input type="number" placeholder="0" value={addForm.amount}
                            onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))}
                            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Период</span>
                          <input type="text" placeholder="июнь 2026" value={addForm.period}
                            onChange={e => setAddForm(f => ({ ...f, period: e.target.value }))}
                            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Заметки</span>
                          <textarea rows={2} placeholder="Дополнительная информация" value={addForm.notes}
                            onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
                            className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                        </label>
                      </div>
                      <div className="flex flex-wrap justify-between items-center mt-4 gap-2">
                        <p className="text-xs text-slate-400">{params.company_name} · {DOC_TYPE_LABEL[params.document_type]} · {sysLabel}</p>
                        <div className="flex gap-2">
                          <button onClick={() => { setShowAddForm(false); setSaveError('') }}
                            className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-200 transition-colors">Отмена</button>
                          <button onClick={handleSave} disabled={saving}
                            className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                            {saving ? 'Сохранение…' : 'Сохранить'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex-shrink-0 flex justify-between items-center bg-slate-50/30">
              <span className="text-xs text-slate-400">
                {`АрмСофт: ${armsoftInvs.length} инвойс. / ${armsoftDocs.length} докум. · ТаксСервис: ${taxForms.length} форм / ${taxInvs.length} инвойс. · Вручную: ${manualDocs.length}`}
              </span>
              {activeTab === 'manual_docs' && !showAddForm && (
                <button onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                  + Добавить документ
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Add Comment Modal ─────────────────────────────────────────────────────────

type CommentForm = { accountant_name: string; company_name: string; comment: string; unaccounted_work: string }

function AddCommentModal({ employees, companies, onSave, onClose }: {
  employees: Employee[]
  companies: AccountingCompany[]
  onSave: (f: CommentForm) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<CommentForm>({ accountant_name: employees[0]?.full_name ?? '', company_name: '', comment: '', unaccounted_work: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    if (!form.accountant_name || !form.comment.trim()) { setErr('Выберите бухгалтера и введите комментарий'); return }
    setSaving(true); setErr('')
    try { await onSave(form) } catch (e) { setErr(String(e)); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Добавить комментарий к рабочему дню</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Бухгалтер *</span>
            <select value={form.accountant_name} onChange={e => setForm(f => ({ ...f, accountant_name: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              {employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Компания</span>
            <select value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
              <option value="">— Не выбрано —</option>
              {companies.map(c => <option key={c.id} value={c.company_name}>{c.company_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Что сделано *</span>
            <textarea rows={3} placeholder="Опишите, что было сделано за день…"
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Что не учтено в таблице</span>
            <textarea rows={2} placeholder="Работа, которая не отражена в цифрах…"
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={form.unaccounted_work} onChange={e => setForm(f => ({ ...f, unaccounted_work: e.target.value }))} />
          </label>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100">Отмена</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

type Tab = 'companies' | 'missing' | 'comments'

export default function Dashboard() {
  const [employees,      setEmployees]  = useState<Employee[]>([])
  const [companies,      setCompanies]  = useState<AccountingCompany[]>([])
  const [artemCompanies, setArtemComp]  = useState<ArtemCompany[]>([])

  const [activities, setActivities] = useState<Activity[]>([])
  const [comments,   setComments]   = useState<DailyComment[]>([])

  const [dateFrom,    setDateFrom]      = useState(nDaysAgo(29))
  const [dateTo,      setDateTo]        = useState(today())
  const [accountant,  setAccountant]    = useState('all')
  const [company,     setCompanyFilter] = useState('all')
  const [source,      setSource]        = useState('all')
  const [activeTab,   setActiveTab]     = useState<Tab>('companies')
  const [showModal,   setShowModal]     = useState(false)
  const [detailModal, setDetailModal]   = useState<CellClickParams | null>(null)

  const [loadingStatic,  setLoadingStatic]  = useState(true)
  const [loadingDynamic, setLoadingDynamic] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/artem-companies').then(r => r.json()),
    ]).then(([emp, comp, artem]) => {
      setEmployees(Array.isArray(emp) ? emp : [])
      setCompanies(Array.isArray(comp) ? comp : [])
      setArtemComp(Array.isArray(artem) ? artem : [])
    }).finally(() => setLoadingStatic(false))
  }, [])

  const loadDynamic = useCallback(() => {
    setLoadingDynamic(true)
    const ap = new URLSearchParams({ from: dateFrom, to: dateTo, accountant, company, source })
    const cp = new URLSearchParams({ from: dateFrom, to: dateTo, accountant })
    Promise.all([
      fetch(`/api/activities?${ap}`).then(r => r.json()),
      fetch(`/api/comments?${cp}`).then(r => r.json()),
    ]).then(([act, com]) => {
      setActivities(Array.isArray(act) ? act : [])
      setComments(Array.isArray(com) ? com : [])
    }).finally(() => setLoadingDynamic(false))
  }, [dateFrom, dateTo, accountant, company, source])

  useEffect(() => { loadDynamic() }, [loadDynamic])

  // ── company lookup map for armsoft/tax ids ─────────────────────────────────
  const companyIdMap = useMemo(() => {
    const m = new Map<string, AccountingCompany>()
    for (const c of companies) m.set(c.company_name, c)
    return m
  }, [companies])

  // ── Aggregate company rows ─────────────────────────────────────────────────
  const companyRows = useMemo<CompanyRow[]>(() => {
    const map = new Map<string, CompanyRow>()

    for (const c of companies) {
      if (accountant !== 'all' && c.accountant_name !== accountant) continue
      if (company !== 'all' && c.company_name !== company) continue
      map.set(c.company_name, {
        company_name: c.company_name,
        accountant_name: c.accountant_name ?? '—',
        base: emptyTotals(),
        armsoft: emptyTotals(),
        taxservice: emptyTotals(),
        total: emptyTotals(),
      })
    }

    for (const a of activities) {
      let row = map.get(a.company_name)
      if (!row) {
        row = {
          company_name: a.company_name,
          accountant_name: a.accountant_name,
          base: emptyTotals(),
          armsoft: emptyTotals(),
          taxservice: emptyTotals(),
          total: emptyTotals(),
        }
        map.set(a.company_name, row)
      }
      if (row.accountant_name === '—' && a.accountant_name) row.accountant_name = a.accountant_name
      const sys = row[a.system_source as 'base' | 'armsoft' | 'taxservice']
      sys.invoices     += a.invoices_issued
      sys.reports      += a.reports_submitted
      sys.applications += a.applications_filed
      sys.balance      += a.balance_changes
      row.total.invoices     += a.invoices_issued
      row.total.reports      += a.reports_submitted
      row.total.applications += a.applications_filed
      row.total.balance      += a.balance_changes
    }

    return Array.from(map.values()).sort((a, b) => {
      const aHas = a.total.invoices + a.total.reports + a.total.applications + a.total.balance
      const bHas = b.total.invoices + b.total.reports + b.total.applications + b.total.balance
      if (aHas !== bHas) return bHas - aHas
      return a.company_name.localeCompare(b.company_name, 'ru')
    })
  }, [activities, companies, accountant, company])

  const kpi = useMemo(() => companyRows.reduce(
    (acc, r) => ({ invoices: acc.invoices + r.total.invoices, reports: acc.reports + r.total.reports, applications: acc.applications + r.total.applications, balance: acc.balance + r.total.balance }),
    emptyTotals()
  ), [companyRows])

  const missingCompanies = useMemo(() => {
    const ourNames = new Set(companies.map(c => c.company_name.trim().toLowerCase()))
    return artemCompanies.filter(c => !ourNames.has(c.company_name.trim().toLowerCase()))
  }, [companies, artemCompanies])

  // ── Unique accountant list from real data ──────────────────────────────────
  const accountantList = useMemo(() => {
    const s = new Set<string>()
    for (const c of companies) if (c.accountant_name) s.add(c.accountant_name)
    return Array.from(s).sort()
  }, [companies])

  const handleAddComment = async (form: CommentForm) => {
    const res = await fetch('/api/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    setShowModal(false)
    loadDynamic()
  }

  const setPreset = (p: string) => {
    const t = today()
    if (p === 'today')  { setDateFrom(t);         setDateTo(t) }
    else if (p === 'week')  { setDateFrom(nDaysAgo(6));  setDateTo(t) }
    else                    { setDateFrom(nDaysAgo(29)); setDateTo(t) }
  }

  const loading = loadingStatic || loadingDynamic

  return (
    <div className="min-h-screen bg-slate-50">

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow">
                OB
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-tight">Отчётность бухгалтерии</h1>
                <p className="text-[11px] text-slate-400">OneBusiness · {fmtDate(dateFrom)} — {fmtDate(dateTo)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select value={accountant} onChange={e => setAccountant(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="all">Все бухгалтеры</option>
                {accountantList.map(a => <option key={a} value={a}>{a}</option>)}
              </select>

              <select value={company} onChange={e => setCompanyFilter(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="all">Все компании</option>
                {companies.map(c => <option key={c.id} value={c.company_name}>{c.company_name}</option>)}
              </select>

              <select value={source} onChange={e => setSource(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                <option value="all">Все системы</option>
                <option value="base">База</option>
                <option value="armsoft">АрмСофт</option>
                <option value="taxservice">ТаксСервис</option>
              </select>

              <div className="flex rounded-xl border border-slate-200 overflow-hidden text-[11px] font-semibold bg-white">
                {[['today','Сегодня'],['week','7 дней'],['month','30 дней']].map(([k,l]) => (
                  <button key={k} onClick={() => setPreset(k)}
                    className="px-3 py-2 hover:bg-indigo-50 hover:text-indigo-700 border-r last:border-r-0 border-slate-200 transition-colors">
                    {l}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <span className="text-slate-400 text-xs">—</span>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>

              {loading && <Spinner />}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <KpiCard label="Выписано инвойсов"  value={kpi.invoices.toLocaleString('ru-RU')}     icon="🧾" accent="bg-emerald-50 text-emerald-600"
            sub={source !== 'all' ? SRC_LABEL[source] : 'все системы'} />
          <KpiCard label="Сдано отчётности"   value={kpi.reports.toLocaleString('ru-RU')}      icon="📋" accent="bg-violet-50 text-violet-600"
            sub={source !== 'all' ? SRC_LABEL[source] : 'все системы'} />
          <KpiCard label="Подано заявлений"   value={kpi.applications.toLocaleString('ru-RU')} icon="📝" accent="bg-amber-50 text-amber-600"
            sub={source !== 'all' ? SRC_LABEL[source] : 'все системы'} />
          <KpiCard label="Изменений остатков" value={kpi.balance.toLocaleString('ru-RU')}      icon="⚖️" accent="bg-rose-50 text-rose-600"
            sub={source !== 'all' ? SRC_LABEL[source] : 'все системы'} />
          <KpiCard label="Нет в бухгалтерии"  value={missingCompanies.length} icon="⚠️" accent="bg-orange-50 text-orange-500"
            sub={`у Артема ${artemCompanies.length} · у нас ${companies.length}`} />
        </div>

        <div className="border-b border-slate-200 flex gap-0">
          {([
            ['companies', `По компаниям (${companyRows.length})`],
            ['missing',   `⚠️ Не добавлены (${missingCompanies.length})`],
            ['comments',  `💬 Комментарии (${comments.length})`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-700 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1 — Companies */}
        {activeTab === 'companies' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-slate-800 text-sm">
                Активность по компаниям
                {accountant !== 'all' && <span className="ml-2 text-indigo-600">· {accountant}</span>}
                {source    !== 'all' && <span className="ml-2"><SourcePill src={source} /></span>}
              </h2>
              <div className="flex gap-1.5 items-center">
                <SourcePill src="base" /><SourcePill src="armsoft" /><SourcePill src="taxservice" />
                <span className="text-xs text-slate-400 ml-2">Нажмите на число → увидите документы</span>
              </div>
            </div>

            {companyRows.length === 0 && !loading ? (
              <div className="text-center py-20 text-slate-400">
                <p className="text-4xl mb-3">📭</p>
                <p className="text-sm font-medium">Нет данных за выбранный период</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-200">
                      <th className="text-left px-5 py-3 whitespace-nowrap">Компания</th>
                      <th className="text-left px-4 py-3 whitespace-nowrap">Бухгалтер</th>
                      {source === 'all' || source === 'base' ? (
                        <th className="text-center px-4 py-3 whitespace-nowrap bg-blue-50/60 border-x border-blue-100">База</th>
                      ) : null}
                      {source === 'all' || source === 'armsoft' ? (
                        <th className="text-center px-4 py-3 whitespace-nowrap bg-violet-50/60 border-x border-violet-100">АрмСофт</th>
                      ) : null}
                      {source === 'all' || source === 'taxservice' ? (
                        <th className="text-center px-4 py-3 whitespace-nowrap bg-emerald-50/60 border-x border-emerald-100">ТаксСервис</th>
                      ) : null}
                      <th className="text-center px-4 py-3 whitespace-nowrap font-bold text-slate-700">Итого</th>
                    </tr>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400">
                      <th colSpan={2} />
                      {source === 'all' || source === 'base' ? (
                        <th className="py-1 bg-blue-50/40 border-x border-blue-100">
                          <div className="grid grid-cols-4 gap-x-3 text-center px-4 min-w-[130px]"><span>Инв</span><span>Отч</span><span>Зая</span><span>Ост</span></div>
                        </th>
                      ) : null}
                      {source === 'all' || source === 'armsoft' ? (
                        <th className="py-1 bg-violet-50/40 border-x border-violet-100">
                          <div className="grid grid-cols-4 gap-x-3 text-center px-4 min-w-[130px]"><span>Инв</span><span>Отч</span><span>Зая</span><span>Ост</span></div>
                        </th>
                      ) : null}
                      {source === 'all' || source === 'taxservice' ? (
                        <th className="py-1 bg-emerald-50/40 border-x border-emerald-100">
                          <div className="grid grid-cols-4 gap-x-3 text-center px-4 min-w-[130px]"><span>Инв</span><span>Отч</span><span>Зая</span><span>Ост</span></div>
                        </th>
                      ) : null}
                      <th className="py-1">
                        <div className="grid grid-cols-4 gap-x-3 text-center px-4 min-w-[130px]"><span>Инв</span><span>Отч</span><span>Зая</span><span>Ост</span></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {companyRows.map((row, i) => {
                      const comp = companyIdMap.get(row.company_name)
                      const ctx = (sys: string): MetricContext => ({
                        company_name: row.company_name,
                        accountant_name: row.accountant_name,
                        system_source: sys,
                        date_from: dateFrom,
                        date_to: dateTo,
                        armsoft_company_id: comp?.armsoft_company_id ?? null,
                        tax_account_id: comp?.tax_account_id ?? null,
                      })
                      return (
                        <tr key={row.company_name} className={`hover:bg-indigo-50/30 transition-colors ${i % 2 ? 'bg-slate-50/30' : ''}`}>
                          <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap max-w-[220px]">
                            <span className="block truncate" title={row.company_name}>{row.company_name}</span>
                            {comp?.armsoft_company_id && (
                              <span className="text-[9px] text-violet-400 font-mono">AS:{comp.armsoft_company_id}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Avatar name={row.accountant_name} />
                              <span className="text-xs text-slate-600">{row.accountant_name}</span>
                            </div>
                          </td>
                          {source === 'all' || source === 'base' ? (
                            <td className="px-4 py-3 bg-blue-50/30 border-x border-blue-100">
                              <MetricGrid t={row.base} context={ctx('base')} onCellClick={setDetailModal} />
                            </td>
                          ) : null}
                          {source === 'all' || source === 'armsoft' ? (
                            <td className="px-4 py-3 bg-violet-50/30 border-x border-violet-100">
                              <MetricGrid t={row.armsoft} context={ctx('armsoft')} onCellClick={setDetailModal} />
                            </td>
                          ) : null}
                          {source === 'all' || source === 'taxservice' ? (
                            <td className="px-4 py-3 bg-emerald-50/30 border-x border-emerald-100">
                              <MetricGrid t={row.taxservice} context={ctx('taxservice')} onCellClick={setDetailModal} />
                            </td>
                          ) : null}
                          <td className="px-4 py-3">
                            <div className="grid grid-cols-4 gap-x-3 text-xs text-right min-w-[130px]">
                              <span className="font-bold text-slate-900 tabular-nums">{row.total.invoices}</span>
                              <span className="font-bold text-slate-900 tabular-nums">{row.total.reports}</span>
                              <span className="font-bold text-slate-900 tabular-nums">{row.total.applications}</span>
                              <span className="font-bold text-slate-900 tabular-nums">{row.total.balance}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  {companyRows.length > 1 && (
                    <tfoot>
                      <tr className="bg-indigo-50 border-t-2 border-indigo-200 text-xs font-bold text-slate-700">
                        <td className="px-5 py-3" colSpan={2}>Итого</td>
                        {source === 'all' || source === 'base'        ? <td className="px-4 py-3 bg-blue-50/50 border-x border-blue-100" /> : null}
                        {source === 'all' || source === 'armsoft'     ? <td className="px-4 py-3 bg-violet-50/50 border-x border-violet-100" /> : null}
                        {source === 'all' || source === 'taxservice'  ? <td className="px-4 py-3 bg-emerald-50/50 border-x border-emerald-100" /> : null}
                        <td className="px-4 py-3">
                          <div className="grid grid-cols-4 gap-x-3 text-right min-w-[130px]">
                            <span className="text-indigo-700 tabular-nums">{kpi.invoices.toLocaleString('ru-RU')}</span>
                            <span className="text-violet-700 tabular-nums">{kpi.reports.toLocaleString('ru-RU')}</span>
                            <span className="text-amber-700 tabular-nums">{kpi.applications.toLocaleString('ru-RU')}</span>
                            <span className="text-rose-700 tabular-nums">{kpi.balance.toLocaleString('ru-RU')}</span>
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

        {/* TAB 2 — Missing companies */}
        {activeTab === 'missing' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Компании Артёма, которых нет в бухгалтерии</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Всего у Артёма: <strong>{artemCompanies.length}</strong> · В бухгалтерии: <strong>{companies.length}</strong> · Не добавлено: <strong className="text-rose-600">{missingCompanies.length}</strong>
                </p>
              </div>
              <span className="text-3xl font-bold text-rose-500">{missingCompanies.length}</span>
            </div>
            {missingCompanies.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-sm font-medium">Все компании Артёма добавлены в бухгалтерию</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-[11px] text-slate-500 font-semibold uppercase tracking-wide border-b border-slate-200">
                        <th className="text-left px-5 py-3">#</th>
                        <th className="text-left px-4 py-3">Компания</th>
                        <th className="text-left px-4 py-3">Договор</th>
                        <th className="text-left px-4 py-3">ИНН / НЗОУ</th>
                        <th className="text-left px-4 py-3">Статус</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {missingCompanies.map((c, i) => (
                        <tr key={c.id} className="hover:bg-rose-50/40 transition-colors">
                          <td className="px-5 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{c.company_name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.contract_number ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.tin ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">⚠️ Не добавлена</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid grid-cols-3 gap-0 border-t border-slate-100 text-center">
                  <div className="py-4 px-4 border-r border-slate-100">
                    <p className="text-2xl font-bold text-slate-800">{artemCompanies.length}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Всего у Артёма</p>
                  </div>
                  <div className="py-4 px-4 border-r border-slate-100">
                    <p className="text-2xl font-bold text-emerald-600">{companies.length}</p>
                    <p className="text-xs text-slate-400 mt-0.5">В нашей бухгалтерии</p>
                  </div>
                  <div className="py-4 px-4">
                    <p className="text-2xl font-bold text-rose-600">{missingCompanies.length}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Нужно добавить</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3 — Comments */}
        {activeTab === 'comments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-slate-800 text-sm">Ежедневные комментарии бухгалтеров</h2>
                <p className="text-xs text-slate-400 mt-0.5">Что сделано за день и что не учтено в таблице</p>
              </div>
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
                + Добавить комментарий
              </button>
            </div>
            {comments.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <p className="text-4xl mb-3">💬</p>
                <p className="text-sm font-medium">Нет комментариев за выбранный период</p>
                <button onClick={() => setShowModal(true)}
                  className="mt-4 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">
                  Добавить первый
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {comments.map(c => (
                  <div key={c.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{fmtDate(c.comment_date)}</span>
                      <div className="flex items-center gap-1.5">
                        <Avatar name={c.accountant_name} />
                        <span className="text-sm font-semibold text-slate-700">{c.accountant_name}</span>
                      </div>
                      {c.company_name && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium">{c.company_name}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{c.comment}</p>
                    {c.unaccounted_work && (
                      <div className="mt-2 flex gap-2 bg-amber-50 border-l-[3px] border-amber-400 rounded-r-xl px-3 py-2">
                        <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠</span>
                        <div>
                          <p className="text-xs font-semibold text-amber-700 mb-0.5">Не учтено в таблице:</p>
                          <p className="text-xs text-amber-800">{c.unaccounted_work}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <footer className="text-center text-xs text-slate-400 pb-4">
          OB Accounting Dashboard · {companies.length} компаний · АрмСофт + ТаксСервис · Данные из armsoft_db
        </footer>
      </main>

      {showModal && (
        <AddCommentModal
          employees={employees}
          companies={companies}
          onSave={handleAddComment}
          onClose={() => setShowModal(false)}
        />
      )}

      {detailModal && (
        <DocumentDetailModal
          params={detailModal}
          onClose={() => setDetailModal(null)}
        />
      )}
    </div>
  )
}
