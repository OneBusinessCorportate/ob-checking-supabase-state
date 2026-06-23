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
  armsoft_company_id: number | null
  tax_account_id: number | null
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

export type ArmSoftInvoice = {
  id: number
  company_id: number
  doc_date: string | null
  doc_num: string | null
  doc_type_name: string | null
  curr_code: string | null
  summ: number | null
  part_name: string | null
  part_tax_code: string | null
  tax_invoice_serial_and_number: string | null
  doc_state_name: string | null
  creator: string | null
}

export type ArmSoftDocument = {
  id: number
  company_id: number
  doc_date: string | null
  doc_num: string | null
  doc_type_name: string | null
  curr_code: string | null
  summ: number | null
  part_name: string | null
  part_tax_code: string | null
  employee_name: string | null
  doc_state_name: string | null
  creator: string | null
  comment: string | null
}

export type TaxForm = {
  id: number
  company_id: number
  username: string | null
  form_name: string | null
  created_date: string | null
  modified_date: string | null
  report_period: string | null
  scraped_at: string | null
}

export type TaxServiceInvoice = {
  id: number
  company_id: number
  username: string | null
  tin: string | null
  serial_no: string | null
  type: string | null
  approval_state: string | null
  status: string | null
  issued_at: string | null
  supplier_name: string | null
  buyer_name: string | null
  total: string | null
  total_vat_amount: string | null
}

export type DocumentRecord = {
  id: number
  company_id: number | null
  company_name: string
  accountant_name: string
  document_date: string
  document_type: 'invoice' | 'report' | 'application' | 'balance_change'
  system_source: 'base' | 'armsoft' | 'taxservice'
  document_number: string | null
  description: string | null
  amount: number | null
  period: string | null
  notes: string | null
  created_at: string
}
