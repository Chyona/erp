import { DB } from './db.js';

const SETTING_KEY = 'voucherTemplates';

export async function getAll() {
  return (await DB.getSetting(SETTING_KEY)) || [];
}

export async function save(template) {
  const name = template.name?.trim();
  if (!name) throw new Error('请输入模板名称');

  const list = await getAll();
  const duplicate = list.find(
    (item) => item.name === name && item.id !== template.id
  );
  if (duplicate) throw new Error('已存在同名模板，请换一个名称');

  const item = {
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
      accountCode: entry.accountCode || '',
      debit: entry.debit || '',
      credit: entry.credit || ''
    }))
  };

  const index = list.findIndex((t) => t.id === item.id);
  if (index >= 0) list[index] = item;
  else list.unshift(item);

  await DB.setSetting(SETTING_KEY, list);
  await DB.addAuditLog('save_voucher_template', item.name, { id: item.id });
  return item;
}

export async function remove(id) {
  const list = (await getAll()).filter((item) => item.id !== id);
  await DB.setSetting(SETTING_KEY, list);
}

export const VoucherTemplates = {
  getAll,
  save,
  remove
};
