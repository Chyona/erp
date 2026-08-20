import { DB } from './db.js';
import { Accounts } from './accounts.js';
import { Voucher } from './voucher.js';
import {
  formatTaxExemptionPeriod,
  reportPeriodEndDate,
  voucherInReportPeriod
} from '../utils/reportPeriod.js';

const ADVANCE_EXPENSE_CODES = new Set(['5602', '5603']);

function roundMoney(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}

function extractPerson(...texts) {
  for (const text of texts) {
    if (!text) continue;
    const paren = text.match(/（([^）]+?)垫付）/);
    if (paren) return paren[1].trim();
    const pending = text.match(/(.+?)垫付待报销/);
    if (pending) return pending[1].trim();
    if (/法人垫付/.test(text)) return '法人';
  }
  return '';
}

function extractCategory(text) {
  if (!text) return '其他';
  if (/【采购】/.test(text)) return '采购';
  if (/【餐饮】/.test(text)) return '餐饮';
  return '其他';
}

function isAdvanceEntry(voucher, entry) {
  if (entry.accountCode !== '2241') return false;
  if (roundMoney(entry.credit) <= 0) return false;
  if (/归还/.test(entry.summary || '')) return false;

  const expense = (voucher.entries || []).find(
    (e) => ADVANCE_EXPENSE_CODES.has(e.accountCode) && roundMoney(e.debit) > 0
  );
  const summaryText = [expense?.summary, entry.summary].filter(Boolean).join(' ');
  return /垫付/.test(summaryText);
}

function isReimbursementEntry(entry, person) {
  if (entry.accountCode !== '2241') return false;
  if (roundMoney(entry.debit) <= 0) return false;
  if (!/归还/.test(entry.summary || '')) return false;
  return !person || (entry.summary || '').includes(person);
}

function findReimbursementVoucher(vouchers, period, person) {
  return vouchers.find(
    (v) =>
      v.status !== Voucher.STATUS.DRAFT &&
      voucherInReportPeriod(v.date, period) &&
      (v.entries || []).some((e) => isReimbursementEntry(e, person))
  );
}

function buildPersonGroups(advances, vouchers, period) {
  const map = new Map();

  for (const item of advances) {
    const { person } = item;
    if (!person) continue;

    if (!map.has(person)) {
      map.set(person, {
        person,
        categories: { 采购: 0, 餐饮: 0, 其他: 0 },
        total: 0,
        advances: [],
        reimbursementVoucher: findReimbursementVoucher(vouchers, period, person)
      });
    }

    const group = map.get(person);
    group.categories[item.category] = roundMoney(group.categories[item.category] + item.amount);
    group.total = roundMoney(group.total + item.amount);
    group.advances.push(item);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

/** 月底报销汇总：按垫付人统计当月 2241 贷方垫付 */
export async function getPeriodSummary(period) {
  if (period.type !== 'month') {
    throw new Error('月底报销仅支持按月汇总');
  }

  const vouchers = await Voucher.getAll();
  const advances = [];

  for (const voucher of vouchers) {
    if (voucher.status === Voucher.STATUS.DRAFT) continue;
    if (!voucherInReportPeriod(voucher.date, period)) continue;

    for (const entry of voucher.entries || []) {
      if (!isAdvanceEntry(voucher, entry)) continue;

      const expense = voucher.entries.find(
        (e) => ADVANCE_EXPENSE_CODES.has(e.accountCode) && roundMoney(e.debit) > 0
      );
      const amount = roundMoney(entry.credit);
      const person = extractPerson(expense?.summary, entry.summary);
      const category = extractCategory(expense?.summary || entry.summary);

      if (!person || amount <= 0) continue;

      advances.push({
        id: `${voucher.id}-${entry.accountId}-${entry.summary}`,
        voucherId: voucher.id,
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        person,
        category,
        amount,
        summary: expense?.summary || entry.summary,
        remark: voucher.remark || ''
      });
    }
  }

  const personGroups = buildPersonGroups(advances, vouchers, period);
  const pendingGroups = personGroups.filter((g) => !g.reimbursementVoucher);
  const pendingTotal = roundMoney(
    pendingGroups.reduce((sum, g) => sum + g.total, 0)
  );

  return {
    period,
    advances,
    personGroups,
    pendingGroups,
    pendingTotal,
    pendingPeople: pendingGroups.length
  };
}

/** 为指定垫付人生成还垫付凭证 */
export async function createReimbursementVoucher(period, person, { approve = true } = {}) {
  const summary = await getPeriodSummary(period);
  const group = summary.personGroups.find((g) => g.person === person);

  if (!group) {
    throw new Error(`未找到 ${person} 在本月的垫付记录`);
  }
  if (group.reimbursementVoucher) {
    throw new Error(
      `${person} 本月已有还垫付凭证 ${group.reimbursementVoucher.voucherNo}`
    );
  }
  if (group.total <= 0) {
    throw new Error(`${person} 无可归还金额`);
  }

  const accounts = await Accounts.getAll();
  const acc2241 = accounts.find((a) => a.code === '2241');
  const acc1002 = accounts.find((a) => a.code === '1002');
  if (!acc2241 || !acc1002) {
    throw new Error('缺少 2241 其他应付款 或 1002 银行存款 科目');
  }

  const signatory = (await DB.getSetting('defaultSignatory')) || '';
  const periodLabel = formatTaxExemptionPeriod(period);
  const entries = [];

  for (const [category, amount] of Object.entries(group.categories)) {
    if (amount <= 0) continue;
    entries.push({
      summary: `归还${periodLabel}${category}垫付-${person}`,
      accountId: acc2241.id,
      accountCode: acc2241.code,
      accountName: acc2241.name,
      debit: amount,
      credit: 0
    });
  }

  entries.push({
    summary: `公账转${person}（${periodLabel}报销汇总）`,
    accountId: acc1002.id,
    accountCode: acc1002.code,
    accountName: acc1002.name,
    debit: 0,
    credit: group.total
  });

  const voucherData = {
    voucherType: '记',
    date: reportPeriodEndDate(period),
    attachmentCount: 0,
    businessType: '日常费用',
    invoiceType: 'none',
    taxAmount: 0,
    invoiceNumbers: '',
    remark: `${periodLabel}${person}垫付报销汇总，含 ${group.advances.length} 笔`,
    entries,
    attachmentIds: [],
    preparedBy: signatory,
    reviewedBy: signatory,
    postedBy: signatory,
    cashierBy: signatory
  };

  const saved = await Voucher.save(voucherData, approve);

  await DB.addAuditLog(
    approve ? '新建并审核' : '新建草稿',
    '月底报销',
    `${saved.voucherNo} ${person} ¥${group.total.toFixed(2)}`
  );

  return {
    voucher: saved,
    person,
    total: group.total,
    count: group.advances.length
  };
}

export const Reimbursement = {
  getPeriodSummary,
  createReimbursementVoucher
};
