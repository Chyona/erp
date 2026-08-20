import { DB } from './db';
import { Accounts } from './accounts';
import { buildAttachmentFileName } from '../utils/attachmentName';
import type {
  Attachment,
  LedgerResult,
  TotalsResult,
  Voucher as VoucherRecord,
  VoucherEntry,
  VoucherFilters,
  VoucherInput,
  VoucherStatus
} from '../types';

const STATUS = { DRAFT: 'draft', APPROVED: 'approved', LOCKED: 'locked' } as const;
const STATUS_LABEL: Record<VoucherStatus, string> = { draft: '草稿', approved: '已审核', locked: '已锁定' };
const ATTACHMENT_READONLY_TIP = '已结账或已审核的凭证不支持上传、删除、修改附件';

function canModifyAttachments(status: VoucherStatus) {
  return status === STATUS.DRAFT;
}

function canEditVoucher(status: VoucherStatus) {
  return status === STATUS.DRAFT;
}

function isRedLetterVoucher(voucher: Pick<VoucherRecord, 'reversedFromId' | 'reversedFromNo' | 'remark' | 'entries'> | null | undefined) {
  if (!voucher) return false;
  if (voucher.reversedFromId || voucher.reversedFromNo) return true;
  if ((voucher.remark || '').startsWith('冲销')) return true;
  const summary = voucher.entries?.[0]?.summary || '';
  return summary.startsWith('冲销');
}

/** 凭证列表排序：日期倒序 → 字号倒序 */
function compareVouchersDesc(a, b) {
  const dateCmp = b.date.localeCompare(a.date);
  if (dateCmp !== 0) return dateCmp;

  const numA = parseVoucherNum(a.voucherNumber);
  const numB = parseVoucherNum(b.voucherNumber);
  if (numB !== numA) return numB - numA;

  return (b.voucherNo || '').localeCompare(a.voucherNo || '');
}

function parseVoucherNum(value) {
  return parseInt(value, 10) || 0;
}

function formatVoucherNum(num, pad = 3) {
  return String(num).padStart(pad, '0');
}

function getYearMonth(date) {
  return String(date || '').slice(0, 7);
}

function getNumberPad(vouchers) {
  const maxLen = vouchers.reduce(
    (max, v) => Math.max(max, String(v.voucherNumber || '').length),
    3
  );
  return Math.max(3, maxLen);
}

async function getPeriodVouchers(voucherType, yearMonth) {
  const all = await DB.getAll('vouchers');
  return all
    .filter((v) => v.voucherType === voucherType && v.date.startsWith(yearMonth))
    .sort((a, b) => parseVoucherNum(a.voucherNumber) - parseVoucherNum(b.voucherNumber));
}

async function findNumberConflict(voucherType, yearMonth, voucherNumber, excludeId = '') {
  const vouchers = await getPeriodVouchers(voucherType, yearMonth);
  return vouchers.find(
    (v) => v.id !== excludeId && parseVoucherNum(v.voucherNumber) === parseVoucherNum(voucherNumber)
  );
}

async function persistVoucherNumbers(vouchers, pad) {
  for (const voucher of vouchers) {
    voucher.voucherNumber = formatVoucherNum(parseVoucherNum(voucher.voucherNumber), pad);
    voucher.voucherNo = `${voucher.voucherType}-${voucher.voucherNumber}`;
    voucher.updatedAt = new Date().toISOString();
    voucher.checksum = generateChecksum(voucher);
    await DB.put('vouchers', voucher);
  }
}

function assertVouchersUnlocked(vouchers) {
  const locked = vouchers.filter((v) => v.status === STATUS.LOCKED);
  if (locked.length) {
    throw new Error(`凭证 ${locked.map((v) => v.voucherNo).join('、')} 已锁定，无法调整`);
  }
}

async function getNextNumber(type, date) {
  const vouchers = await DB.getAll('vouchers');
  const yearMonth = date.slice(0, 7);
  const sameMonth = vouchers.filter(
    (v) => v.voucherType === type && v.date.startsWith(yearMonth)
  );
  const maxNum = sameMonth.reduce((max, v) => {
    const num = parseInt(v.voucherNumber, 10) || 0;
    return num > max ? num : max;
  }, 0);
  return String(maxNum + 1).padStart(3, '0');
}

function calcTotals(entries: VoucherEntry[]): TotalsResult {
  let debit = 0;
  let credit = 0;
  for (const e of entries) {
    debit += parseFloat(String(e.debit)) || 0;
    credit += parseFloat(String(e.credit)) || 0;
  }
  return {
    debit: Math.round(debit * 100) / 100,
    credit: Math.round(credit * 100) / 100,
    balanced: Math.abs(debit - credit) < 0.005
  };
}

function generateChecksum(voucher: VoucherInput | VoucherRecord) {
  const str = JSON.stringify({
    id: voucher.id,
    date: voucher.date,
    entries: voucher.entries,
    totalDebit: voucher.totalDebit,
    totalCredit: voucher.totalCredit
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 'CHK-' + Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

async function save(voucherData: VoucherInput, approve = false): Promise<VoucherRecord> {
  const totals = calcTotals(voucherData.entries);
  if (!totals.balanced) {
    throw new Error(
      `借贷不平衡，借方 ${totals.debit.toFixed(2)}，贷方 ${totals.credit.toFixed(2)}`
    );
  }
  if (voucherData.entries.length < 2) {
    throw new Error('至少需要两条分录');
  }
  for (const e of voucherData.entries) {
    if (!e.accountId) throw new Error('请选择会计科目');
    if (!e.summary) throw new Error('请填写摘要');
  }

  const isNew = !voucherData.id;
  if (isNew) {
    voucherData.id = DB.generateId();
    voucherData.createdAt = new Date().toISOString();
    if (!voucherData.voucherNumber) {
      voucherData.voucherNumber = await getNextNumber(voucherData.voucherType, voucherData.date);
    } else {
      const conflict = await findNumberConflict(
        voucherData.voucherType,
        getYearMonth(voucherData.date),
        voucherData.voucherNumber
      );
      if (conflict) {
        throw new Error(`凭证字号 ${voucherData.voucherType}-${voucherData.voucherNumber} 已存在`);
      }
    }
  } else {
    const existing = await DB.get('vouchers', voucherData.id);
    if (existing && existing.status === STATUS.LOCKED) {
      throw new Error('凭证已锁定，不可修改');
    }
    if (existing && existing.status === STATUS.APPROVED) {
      throw new Error('凭证已审核，不可修改');
    }
  }

  voucherData.voucherNo = `${voucherData.voucherType}-${voucherData.voucherNumber}`;
  voucherData.totalDebit = totals.debit;
  voucherData.totalCredit = totals.credit;
  voucherData.status = (approve ? STATUS.APPROVED : STATUS.DRAFT) as VoucherStatus;
  voucherData.updatedAt = new Date().toISOString();
  if (approve) voucherData.approvedAt = new Date().toISOString();
  voucherData.checksum = generateChecksum(voucherData);

  await DB.put('vouchers', voucherData as VoucherRecord);

  await DB.addAuditLog(
    isNew ? (approve ? '新建并审核' : '新建草稿') : approve ? '修改并审核' : '修改草稿',
    '凭证',
    `${voucherData.voucherNo} 金额 ${totals.debit.toFixed(2)}`
  );

  return voucherData as VoucherRecord;
}

async function lock(id) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) throw new Error('凭证不存在');
  if (voucher.status === STATUS.DRAFT) throw new Error('草稿凭证需先审核才能锁定');
  voucher.status = STATUS.LOCKED;
  voucher.lockedAt = new Date().toISOString();
  await DB.put('vouchers', voucher);
  await DB.addAuditLog('锁定', '凭证', voucher.voucherNo);
  return voucher;
}

/** 批量审核草稿凭证 */
async function approveMany(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const result = { approved: 0, skipped: 0, failed: [] };

  for (const id of uniqueIds) {
    const voucher = await DB.get('vouchers', id);
    if (!voucher) {
      result.skipped++;
      continue;
    }
    if (voucher.status !== STATUS.DRAFT) {
      result.skipped++;
      continue;
    }
    try {
      await save(voucher, true);
      result.approved++;
    } catch (err) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: err.message || '审核失败'
      });
    }
  }

  if (result.approved > 0) {
    await DB.addAuditLog('批量审核', '凭证', `成功审核 ${result.approved} 张凭证`);
  }
  return result;
}

/** 批量反审核：已审核 → 草稿（已锁定不可反审核） */
async function unapproveMany(ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const result = { unapproved: 0, skipped: 0, failed: [] };

  for (const id of uniqueIds) {
    const voucher = await DB.get('vouchers', id);
    if (!voucher) {
      result.skipped++;
      continue;
    }
    if (voucher.status === STATUS.LOCKED) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: '已锁定，不可反审核'
      });
      continue;
    }
    if (voucher.status !== STATUS.APPROVED) {
      result.skipped++;
      continue;
    }
    try {
      voucher.status = STATUS.DRAFT;
      voucher.approvedAt = undefined;
      voucher.updatedAt = new Date().toISOString();
      await DB.put('vouchers', voucher);
      result.unapproved++;
    } catch (err) {
      result.failed.push({
        id,
        voucherNo: voucher.voucherNo,
        message: err.message || '反审核失败'
      });
    }
  }

  if (result.unapproved > 0) {
    await DB.addAuditLog('批量反审核', '凭证', `成功反审核 ${result.unapproved} 张凭证`);
  }
  return result;
}

/** 单张反审核：已审核 → 草稿 */
async function unapprove(id) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) throw new Error('凭证不存在');
  if (voucher.status === STATUS.LOCKED) {
    throw new Error('已锁定的凭证不可反审核');
  }
  if (voucher.status !== STATUS.APPROVED) {
    throw new Error('仅已审核凭证可反审核');
  }

  voucher.status = STATUS.DRAFT;
  voucher.approvedAt = undefined;
  voucher.updatedAt = new Date().toISOString();
  await DB.put('vouchers', voucher);
  await DB.addAuditLog('反审核', '凭证', voucher.voucherNo);
  return voucher;
}

async function clearTaxExemptionLinksForCarryForward(carryForwardId) {
  const vouchers = await DB.getAll('vouchers');
  for (const voucher of vouchers) {
    if (voucher.taxExemptionVoucherId !== carryForwardId) continue;
    voucher.taxExemptionDone = false;
    voucher.taxExemptionVoucherId = '';
    await DB.put('vouchers', voucher);
  }
}

async function removeVoucherData(voucher) {
  if (voucher.isTaxExemptionCarryForward) {
    await clearTaxExemptionLinksForCarryForward(voucher.id);
  }
  if (voucher.attachmentIds) {
    for (const attId of voucher.attachmentIds) {
      await DB.remove('attachments', attId);
    }
  }
  await DB.remove('vouchers', voucher.id);
}

async function remove(id) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) return;
  if (voucher.status === STATUS.LOCKED) {
    throw new Error('已锁定的凭证不可删除');
  }
  await removeVoucherData(voucher);
  await DB.addAuditLog('删除', '凭证', voucher.voucherNo);
}

async function forceRemove(id) {
  const voucher = await DB.get('vouchers', id);
  if (!voucher) return;
  await removeVoucherData(voucher);
  await DB.addAuditLog('强制删除', '凭证', voucher.voucherNo);
}

async function removeByVoucherNo(voucherNo) {
  const vouchers = await DB.getAll('vouchers');
  const voucher = vouchers.find((v) => v.voucherNo === voucherNo);
  if (!voucher) {
    throw new Error(`未找到凭证 ${voucherNo}`);
  }
  await forceRemove(voucher.id);
}

/** 批量删除所有未锁定凭证（草稿、已审核） */
async function removeAllUnlocked() {
  const vouchers = await DB.getAll('vouchers');
  const targets = vouchers.filter((v) => v.status !== STATUS.LOCKED);
  const lockedCount = vouchers.length - targets.length;

  if (!targets.length) {
    return { deleted: 0, locked: lockedCount };
  }

  for (const voucher of targets) {
    await removeVoucherData(voucher);
  }

  await DB.addAuditLog('批量删除', '凭证', `删除 ${targets.length} 张未锁定凭证`);
  return { deleted: targets.length, locked: lockedCount };
}

async function getAll(filters: VoucherFilters = {}) {
  let vouchers = await DB.getAll('vouchers');
  vouchers.sort(compareVouchersDesc);

  if (filters.startDate) vouchers = vouchers.filter((v) => v.date >= filters.startDate);
  if (filters.endDate) vouchers = vouchers.filter((v) => v.date <= filters.endDate);
  if (filters.status) vouchers = vouchers.filter((v) => v.status === filters.status);
  if (filters.keyword) {
    const kw = filters.keyword.toLowerCase();
    vouchers = vouchers.filter(
      (v) =>
        v.voucherNo.toLowerCase().includes(kw) ||
        (v.remark && v.remark.toLowerCase().includes(kw)) ||
        v.entries.some(
          (e) =>
            e.summary.toLowerCase().includes(kw) ||
            (e.accountName && e.accountName.toLowerCase().includes(kw))
        )
    );
  }
  return vouchers;
}

async function getById(id) {
  return DB.get('vouchers', id);
}

/** 按列表顺序（日期新→旧）取相邻凭证；direction: older | newer */
async function getAdjacentVoucher(currentId, direction) {
  const vouchers = await DB.getAll('vouchers');
  vouchers.sort(compareVouchersDesc);
  const index = vouchers.findIndex((v) => v.id === currentId);
  if (index < 0) return null;
  const offset = direction === 'older' ? 1 : -1;
  return vouchers[index + offset] || null;
}

/** 按凭证字号查找（支持 记-032、032、32）；可选限定年月 */
async function findByVoucherNo(
  raw: string,
  { voucherType = '记', yearMonth }: { voucherType?: string; yearMonth?: string } = {}
) {
  const text = String(raw || '').trim();
  if (!text) return null;

  let vouchers = await DB.getAll('vouchers');
  if (yearMonth) {
    vouchers = vouchers.filter((v) => v.date.startsWith(yearMonth));
  }

  const fullMatch = vouchers.find((v) => v.voucherNo === text);
  if (fullMatch) return fullMatch;

  const withType = text.includes('-') ? text : `${voucherType}-${text}`;
  const typedMatch = vouchers.find((v) => v.voucherNo === withType);
  if (typedMatch) return typedMatch;

  const num = parseVoucherNum(text.replace(/^[^\d-]+-?/, ''));
  if (!num) return null;

  return (
    vouchers.find(
      (v) =>
        v.voucherType === voucherType &&
        parseVoucherNum(v.voucherNumber) === num
    ) || null
  );
}

async function saveAttachment(file: File, customName?: string): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const attachment: Attachment = {
        id: DB.generateId(),
        name: customName || file.name,
        type: file.type,
        size: file.size,
        data: reader.result as string,
        uploadedAt: new Date().toISOString()
      };
      await DB.put('attachments', attachment);
      resolve(attachment);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function updateAttachment(attachment) {
  await DB.put('attachments', attachment);
  return attachment;
}

async function getAttachment(id) {
  return DB.get('attachments', id);
}

async function addAttachmentToVoucher(voucherId, file) {
  const voucher = await DB.get('vouchers', voucherId);
  if (!voucher) throw new Error('凭证不存在');
  if (!canModifyAttachments(voucher.status)) {
    throw new Error(ATTACHMENT_READONLY_TIP);
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(`${file.name} 超过 5MB 限制`);
  }

  const totals = calcTotals(voucher.entries || []);
  const index = (voucher.attachmentIds || []).length;
  const fileName = buildAttachmentFileName({
    voucherNo: voucher.voucherNo,
    entries: voucher.entries,
    totals,
    originalName: file.name,
    index
  });

  const att = await saveAttachment(file, fileName);
  voucher.attachmentIds = [...(voucher.attachmentIds || []), att.id];
  voucher.attachmentCount = voucher.attachmentIds.length;
  voucher.updatedAt = new Date().toISOString();
  await DB.put('vouchers', voucher);
  await DB.addAuditLog('上传附件', '凭证', `${voucher.voucherNo} ${fileName}`);
  return voucher;
}

/** 冲销：生成借贷相反的新草稿凭证 */
async function reverse(id) {
  const source = await DB.get('vouchers', id);
  if (!source) throw new Error('凭证不存在');
  if (source.status === STATUS.LOCKED) {
    throw new Error('已锁定的凭证不可冲销');
  }

  const entries = (source.entries || []).map((entry) => ({
    accountId: entry.accountId,
    accountCode: entry.accountCode,
    accountName: entry.accountName,
    summary: entry.summary?.startsWith('冲销')
      ? entry.summary
      : `冲销${source.voucherNo} ${entry.summary || ''}`.trim(),
    debit: entry.credit || '',
    credit: entry.debit || ''
  }));

  const remarkTail = source.remark ? `；${source.remark}` : '';
  const voucherData = {
    voucherType: source.voucherType || '记',
    date: source.date,
    entries,
    businessType: source.businessType || '其他',
    invoiceType: source.invoiceType,
    taxAmount: source.taxAmount || 0,
    invoiceNumbers: source.invoiceNumbers || '',
    remark: `冲销 ${source.voucherNo}${remarkTail}`,
    reversedFromId: source.id,
    reversedFromNo: source.voucherNo,
    attachmentIds: [],
    attachmentCount: 0,
    preparedBy: source.preparedBy || '',
    reviewedBy: source.reviewedBy || '',
    postedBy: source.postedBy || '',
    cashierBy: source.cashierBy || ''
  };

  const saved = await save(voucherData, false);
  await DB.addAuditLog('冲销', '凭证', `${source.voucherNo} → ${saved.voucherNo}`);
  return saved;
}

/** 调整顺序：将凭证移动到指定字号之前，同期凭证重新编号 */
async function reorder(voucherId, beforeNumber) {
  const source = await DB.get('vouchers', voucherId);
  if (!source) throw new Error('凭证不存在');
  if (source.status === STATUS.LOCKED) {
    throw new Error('已锁定的凭证不可调整顺序');
  }

  const targetNum = parseVoucherNum(beforeNumber);
  if (!targetNum) throw new Error('请输入有效的目标凭证号');

  const yearMonth = getYearMonth(source.date);
  const periodVouchers = await getPeriodVouchers(source.voucherType, yearMonth);
  if (!periodVouchers.length) throw new Error('未找到同期凭证');

  const sourceNum = parseVoucherNum(source.voucherNumber);
  if (sourceNum === targetNum) {
    return { changed: false, voucher: source };
  }

  assertVouchersUnlocked(periodVouchers);

  const moving = periodVouchers.find((v) => v.id === voucherId);
  if (!moving) throw new Error('凭证不在当前会计期间内');

  const rest = periodVouchers.filter((v) => v.id !== voucherId);
  let insertIndex = rest.findIndex((v) => parseVoucherNum(v.voucherNumber) >= targetNum);
  if (insertIndex < 0) insertIndex = rest.length;

  const reordered = [...rest.slice(0, insertIndex), moving, ...rest.slice(insertIndex)];
  const pad = getNumberPad(periodVouchers);
  reordered.forEach((voucher, index) => {
    voucher.voucherNumber = formatVoucherNum(index + 1, pad);
  });

  await persistVoucherNumbers(reordered, pad);
  const updated = reordered.find((v) => v.id === voucherId);
  await DB.addAuditLog(
    '调整顺序',
    '凭证',
    `${source.voucherType}-${formatVoucherNum(sourceNum, pad)} → ${updated.voucherNo} 前移至 ${targetNum} 号`
  );
  return { changed: true, voucher: updated };
}

/** 插入凭证：在指定字号前腾出空位（其后凭证顺次后移） */
async function prepareInsertSlot(voucherType, date, beforeNumber) {
  const targetNum = parseVoucherNum(beforeNumber);
  if (!targetNum) throw new Error('请输入有效的凭证号');

  const yearMonth = getYearMonth(date);
  const periodVouchers = await getPeriodVouchers(voucherType, yearMonth);

  const pad = getNumberPad(periodVouchers);
  const toShift = periodVouchers
    .filter((v) => parseVoucherNum(v.voucherNumber) >= targetNum)
    .sort((a, b) => parseVoucherNum(b.voucherNumber) - parseVoucherNum(a.voucherNumber));

  assertVouchersUnlocked(toShift);

  for (const voucher of toShift) {
    voucher.voucherNumber = formatVoucherNum(parseVoucherNum(voucher.voucherNumber) + 1, pad);
    voucher.voucherNo = `${voucher.voucherType}-${voucher.voucherNumber}`;
    voucher.updatedAt = new Date().toISOString();
    voucher.checksum = generateChecksum(voucher);
    await DB.put('vouchers', voucher);
  }

  const reservedNumber = formatVoucherNum(targetNum, pad);
  await DB.addAuditLog(
    '插入凭证',
    '凭证',
    `${voucherType}-${reservedNumber} 前插入空位（${yearMonth}）`
  );
  return reservedNumber;
}

async function getStats() {
  const vouchers = await DB.getAll('vouchers');
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthVouchers = vouchers.filter((v) => v.date.startsWith(yearMonth));
  let totalDebit = 0;
  let totalAttachments = 0;
  for (const v of vouchers) {
    totalDebit += v.totalDebit || 0;
    totalAttachments += (v.attachmentIds || []).length;
  }
  return {
    total: vouchers.length,
    month: monthVouchers.length,
    totalDebit,
    totalAttachments
  };
}

async function getLedger(accountId, startDate, endDate) {
  const vouchers = await getAll({ startDate, endDate, status: '' });
  const approved = vouchers.filter((v) => v.status !== STATUS.DRAFT);
  const rows = [];
  let balance = 0;
  const account = await Accounts.getById(accountId);
  const isDebit = account ? account.direction === 'debit' : true;

  for (const v of approved.sort((a, b) => a.date.localeCompare(b.date))) {
    for (const e of v.entries) {
      if (e.accountId !== accountId) continue;
      const debit = parseFloat(String(e.debit)) || 0;
      const credit = parseFloat(String(e.credit)) || 0;
      balance += isDebit ? debit - credit : credit - debit;
      rows.push({
        date: v.date,
        voucherNo: v.voucherNo,
        summary: e.summary,
        debit,
        credit,
        balance: Math.round(balance * 100) / 100
      });
    }
  }
  return { account, rows, endingBalance: balance };
}

function formatMoney(n) {
  return (
    '¥' +
    (parseFloat(n) || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  );
}

export const Voucher = {
  STATUS,
  STATUS_LABEL,
  ATTACHMENT_READONLY_TIP,
  canModifyAttachments,
  canEditVoucher,
  isRedLetterVoucher,
  save,
  lock,
  approveMany,
  unapprove,
  unapproveMany,
  remove,
  forceRemove,
  removeByVoucherNo,
  removeAllUnlocked,
  getAll,
  getById,
  getAdjacentVoucher,
  findByVoucherNo,
  saveAttachment,
  addAttachmentToVoucher,
  reverse,
  reorder,
  prepareInsertSlot,
  updateAttachment,
  getAttachment,
  getStats,
  getLedger,
  calcTotals,
  getNextNumber,
  formatMoney,
  generateChecksum
};
