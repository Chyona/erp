import { DB } from './db';
import { DEFAULT_ACCOUNTS } from './defaultAccounts';
import type { Account } from '../types';

let initPromise: Promise<void> | null = null;

const defaultCodes = new Set(DEFAULT_ACCOUNTS.map((a) => a.code));

/** 按科目编码去重，保留最早创建的一条 */
async function dedupeByCode() {
  const existing = await DB.getAll('accounts');
  const seen = new Map();
  const toDelete = [];

  const sorted = [...existing].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  for (const acc of sorted) {
    if (seen.has(acc.code)) {
      toDelete.push(acc.id);
    } else {
      seen.set(acc.code, acc);
    }
  }

  for (const id of toDelete) {
    await DB.remove('accounts', id);
  }

  if (toDelete.length) {
    await DB.addAuditLog('清理', '会计科目', `删除 ${toDelete.length} 个重复科目`);
  }

  return toDelete.length;
}

/** 补全默认科目，并校正默认科目的名称/类别（修复历史错误数据） */
async function syncDefaultAccounts() {
  const existing = await DB.getAll('accounts');
  const byCode = new Map(existing.map((a) => [a.code, a]));
  let added = 0;
  let updated = 0;

  for (const acc of DEFAULT_ACCOUNTS) {
    const current = byCode.get(acc.code);
    if (!current) {
      await DB.put('accounts', {
        id: DB.generateId(),
        ...acc,
        createdAt: new Date().toISOString()
      });
      added++;
      continue;
    }

    const needsUpdate =
      current.name !== acc.name ||
      current.category !== acc.category ||
      current.direction !== acc.direction;

    if (needsUpdate) {
      await DB.put('accounts', {
        ...current,
        name: acc.name,
        category: acc.category,
        direction: acc.direction,
        updatedAt: new Date().toISOString()
      });
      updated++;
    }
  }

  if (added > 0) {
    await DB.addAuditLog('同步', '会计科目', `导入默认科目 ${added} 个`);
  }
  if (updated > 0) {
    await DB.addAuditLog('同步', '会计科目', `校正默认科目 ${updated} 个`);
  }

  return { added, updated };
}

/** 按科目主数据校正凭证分录里缓存的科目名称 */
async function syncVoucherEntryAccountNames() {
  const accounts = await getAll();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const vouchers = await DB.getAll('vouchers');
  let voucherCount = 0;

  for (const v of vouchers) {
    let changed = false;
    for (const e of v.entries || []) {
      const acc = byId.get(e.accountId);
      if (!acc) continue;
      if (e.accountName !== acc.name || e.accountCode !== acc.code) {
        e.accountName = acc.name;
        e.accountCode = acc.code;
        changed = true;
      }
    }
    if (changed) {
      await DB.put('vouchers', v);
      voucherCount++;
    }
  }

  if (voucherCount > 0) {
    await DB.addAuditLog('同步', '凭证分录', `校正 ${voucherCount} 张凭证的科目名称`);
  }

  return voucherCount;
}

/** 删除不在默认列表中、且未被凭证引用的科目 */
async function pruneExtraAccounts() {
  const existing = await DB.getAll('accounts');
  const vouchers = await DB.getAll('vouchers');
  const usedIds = new Set();

  for (const v of vouchers) {
    for (const e of v.entries || []) {
      if (e.accountId) usedIds.add(e.accountId);
    }
  }

  let removed = 0;
  for (const acc of existing) {
    if (defaultCodes.has(acc.code)) continue;
    if (usedIds.has(acc.id)) continue;
    await DB.remove('accounts', acc.id);
    removed++;
  }

  if (removed > 0) {
    await DB.addAuditLog('清理', '会计科目', `移除 ${removed} 个非默认科目`);
  }

  return removed;
}

async function doInit() {
  await dedupeByCode();
  await syncDefaultAccounts();
  await syncVoucherEntryAccountNames();
  await pruneExtraAccounts();
}

async function init() {
  if (!initPromise) {
    initPromise = doInit().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

async function getAll() {
  const accounts = await DB.getAll('accounts');
  return accounts.sort((a, b) => a.code.localeCompare(b.code));
}

async function getById(id) {
  return DB.get('accounts', id);
}

async function save(account: Account): Promise<Account> {
  const all = await getAll();
  const duplicate = all.find((a) => a.code === account.code && a.id !== account.id);
  if (duplicate) {
    throw new Error(`科目编码 ${account.code} 已存在`);
  }

  const isNew = !account.id;
  if (isNew) {
    account.id = DB.generateId();
    account.createdAt = new Date().toISOString();
  }
  account.updatedAt = new Date().toISOString();
  await DB.put('accounts', account);
  await DB.addAuditLog(
    isNew ? '新增' : '修改',
    '会计科目',
    `${account.code} ${account.name}`
  );
  return account;
}

async function remove(id) {
  const account = await getById(id);
  if (account) {
    await DB.remove('accounts', id);
    await DB.addAuditLog('删除', '会计科目', `${account.code} ${account.name}`);
  }
}

function formatAccountOption(account) {
  return `${account.code} ${account.name}`;
}

export const Accounts = {
  init,
  getAll,
  getById,
  save,
  remove,
  formatAccountOption,
  DEFAULT_ACCOUNTS
};
