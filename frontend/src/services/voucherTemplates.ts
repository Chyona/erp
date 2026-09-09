import { ErpApi } from './erpApi';
import {
  dedupeInvoiceNumbers,
  extractInvoiceNumbersFromText,
  parseInvoiceNumbersList
} from '../utils/invoiceNumberExtract';

const SETTING_KEY = 'voucherTemplates';

export interface VoucherTemplate {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
  businessType?: string;
  invoiceType?: string;
  taxAmount?: number | string;
  remark?: string;
  entries?: Array<{
    summary?: string;
    accountId?: string;
    accountCode?: string;
    accountName?: string;
    debit?: string | number;
    credit?: string | number;
  }>;
}

/** 从文本中去掉疑似发票号码，避免写入模板。 */
function stripInvoiceNumbersFromText(text: string): string {
  let result = String(text || '');
  if (!result) return '';

  const numbers = dedupeInvoiceNumbers([
    ...extractInvoiceNumbersFromText(result),
    ...parseInvoiceNumbersList(result)
  ]);
  for (const num of numbers) {
    result = result.split(num).join('xxx');
  }
  return result.replace(/发票号码?\s*[:：]?\s*/g, '发票号').replace(/\s{2,}/g, ' ').trim();
}

function pickTemplateEntry(entry?: {
  summary?: string;
  accountId?: string;
  accountCode?: string;
  accountName?: string;
  debit?: string | number;
  credit?: string | number;
}) {
  return {
    summary: stripInvoiceNumbersFromText(entry?.summary || ''),
    accountId: entry?.accountId || '',
    accountCode: entry?.accountCode || '',
    accountName: entry?.accountName || '',
    debit: entry?.debit || '',
    credit: entry?.credit || ''
  };
}

/** 模板只保留填单结构：永不包含发票号、附件。 */
export function sanitizeVoucherTemplate(
  raw: Partial<VoucherTemplate> & Record<string, unknown>
): VoucherTemplate {
  // 显式白名单构造，确保不会把 invoiceNumbers / attachmentIds 等脏字段带入
  const clean: VoucherTemplate = {
    id: String(raw.id || ErpApi.generateId()),
    name: String(raw.name || '').trim(),
    businessType: (raw.businessType as string) || '日常费用',
    invoiceType: raw.invoiceType ? String(raw.invoiceType) : undefined,
    taxAmount: raw.taxAmount as number | string | undefined,
    remark: stripInvoiceNumbersFromText(String(raw.remark || '')),
    entries: (Array.isArray(raw.entries) ? raw.entries : []).map((entry) => pickTemplateEntry(entry))
  };
  if (raw.createdAt) clean.createdAt = String(raw.createdAt);
  if (raw.updatedAt) clean.updatedAt = String(raw.updatedAt);
  return clean;
}

function hasForbiddenTemplateFields(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  return (
    'invoiceNumbers' in item ||
    'attachmentIds' in item ||
    'attachments' in item ||
    'attachmentCount' in item
  );
}

export async function getAll(): Promise<VoucherTemplate[]> {
  const list = await ErpApi.getSetting(SETTING_KEY);
  if (!Array.isArray(list)) return [];
  return list.map((item) =>
    sanitizeVoucherTemplate(item as Partial<VoucherTemplate> & Record<string, unknown>)
  );
}

/** 若存储中仍有发票号/附件等脏字段，清洗后写回。 */
export async function scrubStoredTemplatesIfNeeded() {
  const raw = await ErpApi.getSetting(SETTING_KEY);
  if (!Array.isArray(raw) || raw.length === 0) return;
  if (!raw.some(hasForbiddenTemplateFields)) return;
  const sanitized = raw.map((item) =>
    sanitizeVoucherTemplate(item as Partial<VoucherTemplate> & Record<string, unknown>)
  );
  await ErpApi.setSetting(SETTING_KEY, sanitized);
}

export async function save(template: Partial<VoucherTemplate> & { name?: string }) {
  const name = template.name?.trim();
  if (!name) throw new Error('请输入模板名称');

  const list = await getAll();
  const duplicate = list.find(
    (item) => item.name === name && item.id !== template.id
  );
  if (duplicate) throw new Error('已存在同名模板，请换一个名称');

  const item = sanitizeVoucherTemplate({
    id: template.id,
    name,
    createdAt: template.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    businessType: template.businessType,
    invoiceType: template.invoiceType,
    taxAmount: template.taxAmount,
    remark: template.remark || '',
    entries: template.entries || []
  });

  // 二次保险：序列化后再解析，杜绝隐藏可枚举脏字段
  const persisted = JSON.parse(JSON.stringify(item)) as VoucherTemplate;
  delete (persisted as Record<string, unknown>).invoiceNumbers;
  delete (persisted as Record<string, unknown>).attachmentIds;
  delete (persisted as Record<string, unknown>).attachments;
  delete (persisted as Record<string, unknown>).attachmentCount;

  const idx = list.findIndex((t) => t.id === persisted.id);
  if (idx >= 0) {
    list[idx] = persisted;
  } else {
    list.unshift(persisted);
  }

  const payload = list.map((row) => {
    const clean = sanitizeVoucherTemplate(row as Partial<VoucherTemplate> & Record<string, unknown>);
    delete (clean as Record<string, unknown>).invoiceNumbers;
    delete (clean as Record<string, unknown>).attachmentIds;
    delete (clean as Record<string, unknown>).attachments;
    delete (clean as Record<string, unknown>).attachmentCount;
    return clean;
  });

  await ErpApi.setSetting(SETTING_KEY, payload);
  await ErpApi.addAuditLog('保存', '凭证模板', persisted.name);
  return persisted;
}

export async function remove(id: string) {
  const list = await getAll();
  const target = list.find((t) => t.id === id);
  const filtered = list
    .filter((t) => t.id !== id)
    .map((row) => sanitizeVoucherTemplate(row as Partial<VoucherTemplate> & Record<string, unknown>));
  await ErpApi.setSetting(SETTING_KEY, filtered);
  if (target) {
    await ErpApi.addAuditLog('删除', '凭证模板', target.name);
  }
}

export const VoucherTemplates = {
  getAll,
  save,
  remove,
  scrubStoredTemplatesIfNeeded,
  sanitize: sanitizeVoucherTemplate
};
