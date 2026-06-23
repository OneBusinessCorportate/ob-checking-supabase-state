export type Employee = {
  id: string
  full_name: string
  role: 'accountant' | 'head_accountant' | string
  is_active: boolean
  display_aliases: string[] | null
}

export type AccountingCompany = {
  id: number
  company_name: string
  contract_number: string | null
  accountant_name: string | null
  is_active: boolean
}

export type ArtemCompany = {
  id: number
  company_name: string
  contract_number: string | null
  tin: string | null
  is_active: boolean
}

export type Activity = {
  id: number
  company_id: number | null
  company_name: string
  accountant_name: string
  activity_date: string
  system_source: 'base' | 'armsoft' | 'taxservice'
  invoices_issued: number
  reports_submitted: number
  applications_filed: number
  balance_changes: number
}

export type DailyComment = {
  id: number
  accountant_name: string
  company_name: string | null
  comment_date: string
  comment: string
  unaccounted_work: string | null
  created_at: string
}

export type SystemTotals = {
  invoices: number
  reports: number
  applications: number
  balance: number
}

export type CompanyRow = {
  company_name: string
  accountant_name: string
  base: SystemTotals
  armsoft: SystemTotals
  taxservice: SystemTotals
  total: SystemTotals
}
