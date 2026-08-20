import { DB } from './db';

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
  invoiceNumbers?: string;
  entries?: Array<{
    summary?: string;
    accountId?: string;
    accountCode?: string;
    accountName?: string;
    debit?: string | number;
    credit?: string | number;
  }>;
}

export async function getAll(): Promise<VoucherTemplate[]> {
  const list = await DB.getSetting(SETTING_KEY);
  return Array.isArray(list) ? (list as VoucherTemplate[]) : [];
}

export async function save(template: VoucherTemplate) {
  const name = template.name?.trim();
  if (!name) throw new Error('请输入模板名称');

  const list = await getAll();
  const duplicate = list.find(
    (item) => item.name === name && item.id !== template.id
  );
  if (duplicate) throw new Error('已存在同名模板，请换一个名称');

  const item: VoucherTemplate = {
    id: template.id || DB.generateId(),
    name,
    createdAt: template.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    businessType: template.businessType || '日常费用',
    invoiceType: template.invoiceType,
    taxAmount: template.taxAmount,
    remark: template.remark || '',
    invoiceNumbers: template.invoiceNumbers || '',
    entries: (template.entries || []).map((entry) => ({
      summary: entry.summary || '',
      accountId: entry.accountId || '',
      accountCode: entry.accountCode || '',
      accountName: entry.accountName || '',
      debit: entry.debit || '',
      credit: entry.credit || ''
    }))
  };

  const idx = list.findIndex((t) => t.id === item.id);
  if (idx >= 0) {
    list[idx] = item;
  } else {
    list.unshift(item);
  }

  await DB.setSetting(SETTING_KEY, list);
  await DB.addAuditLog('保存', '凭证模板', item.name);
  return item;
}

export async function remove(id: string) {
  const list = await getAll();
  const target = list.find((t) => t.id === id);
  const filtered = list.filter((t) => t.id !== id);
  await DB.setSetting(SETTING_KEY, filtered);
  if (target) {
    await DB.addAuditLog('删除', '凭证模板', target.name);
  }
}

export const VoucherTemplates = {
  getAll,
  save,
  remove
};
