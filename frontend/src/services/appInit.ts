import type { Account, AppInitResult } from '../types';
import { ErpApi } from './erpApi';
import { apiRequest } from './apiClient';
import { repairFinanceInterestEntries } from './financeExpenseRepair';
import { validateSession } from './session';
import { isAuthError } from '../utils/apiError';

export type AppInitOutcome = AppInitResult & {
  degraded: boolean;
  initWarning?: string;
};

const DEGRADED_SYNC_MSG = '后台同步暂不可用，已跳过后台维护；部分科目或结项状态可能不是最新。';
const DEGRADED_OFFLINE_MSG = '暂时无法连接服务器，已进入离线浏览模式；数据同步将在服务恢复后自动完成。';

async function loadFallbackContext(warning: string): Promise<AppInitOutcome> {
  let companyName = '';
  let accounts: Account[] = [];
  try {
    const raw = await ErpApi.getSetting('companyName');
    companyName = String(raw ?? '').trim();
  } catch {
    // 忽略：降级模式下尽力读取
  }
  try {
    accounts = await ErpApi.getAll('accounts');
  } catch {
    // 忽略
  }
  return {
    companyName,
    accounts,
    repaired: 0,
    syncedLocks: 0,
    localRepaired: 0,
    degraded: true,
    initWarning: warning
  };
}

/** 应用启动初始化：先验登录态，再同步科目/分录/结项；服务端不可用时降级进入系统。 */
export async function runAppInit(): Promise<AppInitOutcome> {
  await ErpApi.open();

  try {
    await validateSession();
  } catch (err) {
    if (isAuthError(err)) throw err;
    return loadFallbackContext(DEGRADED_OFFLINE_MSG);
  }

  try {
    const result = await apiRequest<Omit<AppInitResult, 'localRepaired'>>('POST', '/app/init');
    let localRepaired = 0;
    try {
      localRepaired = await repairFinanceInterestEntries();
    } catch {
      // 本地修复失败不阻断进入系统
    }
    return {
      companyName: result.companyName || '',
      accounts: result.accounts || [],
      repaired: result.repaired || 0,
      syncedLocks: result.syncedLocks || 0,
      localRepaired,
      degraded: false
    };
  } catch (err) {
    if (isAuthError(err)) throw err;
    return loadFallbackContext(DEGRADED_SYNC_MSG);
  }
}
