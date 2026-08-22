export type AccountDirection = 'debit' | 'credit';

export type AccountCategory = '资产' | '负债' | '所有者权益' | '成本' | '损益';

export interface Account {
  id: string;
  code: string;
  name: string;
  category: AccountCategory | string;
  direction: AccountDirection;
  createdAt?: string;
  updatedAt?: string;
}

export type VoucherStatus = 'draft' | 'approved' | 'locked';

export type InvoiceType = '' | 'ordinary' | 'special';

export interface VoucherEntry {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  summary: string;
  debit: number | string;
  credit: number | string;
}

export interface Voucher {
  id: string;
  voucherType: string;
  voucherNumber: string;
  voucherNo: string;
  date: string;
  entries: VoucherEntry[];
  businessType?: string;
  invoiceType?: InvoiceType;
  taxAmount?: number | string;
  invoiceNumbers?: string;
  remark?: string;
  status: VoucherStatus;
  totalDebit: number;
  totalCredit: number;
  checksum?: string;
  attachmentIds?: string[];
  attachmentCount?: number;
  preparedBy?: string;
  reviewedBy?: string;
  postedBy?: string;
  cashierBy?: string;
  /** 创建人账号 ID（鉴权归属） */
  createdByAccountId?: number;
  reversedFromId?: string;
  reversedFromNo?: string;
  isTaxExemptionCarryForward?: boolean;
  taxExemptionDone?: boolean;
  taxExemptionVoucherId?: string;
  taxExemptionPeriod?: string;
  taxExemptionPeriodType?: string;
  isProfitLossClosing?: boolean;
  profitLossClosingPeriod?: string;
  profitLossClosingPeriodType?: string;
  createdAt?: string;
  updatedAt?: string;
  approvedAt?: string;
  lockedAt?: string;
  /** 因季度结项标记而结项的期间键，如 2026-Q2 */
  quarterDeclaredKey?: string;
  importedAt?: string;
  importSource?: string;
}

export type VoucherInput = Partial<Voucher> & {
  voucherType: string;
  date: string;
  entries: VoucherEntry[];
};

/** 普票减免结转明细：每条 2221 贷方分录一行 */
export interface TaxExemptionTaxLine {
  id: string;
  voucherId: string;
  voucherNo: string;
  date: string;
  taxAmount: number;
  entrySummary: string;
  remark: string;
  entryIndex: number;
}

export interface VoucherFilters {
  startDate?: string;
  endDate?: string;
  status?: VoucherStatus | string;
  keyword?: string;
  voucherType?: string;
  voucherNumber?: string;
  summary?: string;
  accountCode?: string;
  amountMin?: number | string;
  amountMax?: number | string;
  businessType?: string;
  signatory?: string;
  remark?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  /** 对象存储公开 URL（无签名） */
  url: string;
  uploadedAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  details: string;
  userAgent: string;
  /** 操作人账号 ID（历史日志可能为 0） */
  operatorAccountId?: number;
  /** 操作人用户名 */
  operatorUsername?: string;
  /** 操作人昵称 */
  operatorNickname?: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export interface ExportData {
  version: number;
  exportedAt: string;
  vouchers: Voucher[];
  accounts: Account[];
  auditLogs: AuditLog[];
  settings: Setting[];
  attachments: Attachment[];
}

export type StoreName =
  | 'vouchers'
  | 'accounts'
  | 'auditLogs'
  | 'settings'
  | 'attachments';

export interface LedgerRow {
  date: string;
  voucherNo: string;
  summary: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerResult {
  account: Account | null | undefined;
  rows: LedgerRow[];
  endingBalance: number;
}

export interface BatchOperationFailure {
  id: string;
  voucherNo?: string;
  message: string;
}

export interface ApproveManyResult {
  approved: number;
  skipped: number;
  failed: BatchOperationFailure[];
}

export interface UnapproveManyResult {
  unapproved: number;
  skipped: number;
  failed: BatchOperationFailure[];
}

export interface VoucherStats {
  total: number;
  month: number;
  totalDebit: number;
  totalAttachments: number;
}

export interface TotalsResult {
  debit: number;
  credit: number;
  balanced: boolean;
}

export interface AppContextValue {
  companyName: string;
  setCompanyName: (name: string) => void;
  accounts: Account[];
  setAccounts: (accounts: Account[]) => void;
  refreshKey: number;
  refresh: () => void;
}

export interface CompanyInfo {
  name: string | null;
  taxId: string | null;
}

export interface BalanceSheetSideRow {
  key?: string;
  type?: string;
  label?: string;
  row?: number | null;
  opening?: number | null;
  ending?: number | null;
}

export interface BalanceSheetMergedRow {
  key: string;
  assetLabel?: string;
  assetType?: string | null;
  assetRow?: string | number;
  assetEnding?: number | null;
  assetOpening?: number | null;
  liabilityLabel?: string;
  liabilityType?: string | null;
  liabilityRow?: string | number;
  liabilityEnding?: number | null;
  liabilityOpening?: number | null;
}
