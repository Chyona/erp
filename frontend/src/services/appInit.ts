import { ErpApi } from './erpApi';
import { apiRequest } from './apiClient';
import { repairFinanceInterestEntries } from './financeExpenseRepair';
import type { AppInitResult } from '../types';

/** 应用启动初始化：同步科目、校正分录、同步结项状态。仅在登录后或全库恢复后调用。 */
export async function runAppInit(): Promise<AppInitResult> {
  await ErpApi.open();
  const result = await apiRequest<Omit<AppInitResult, 'localRepaired'>>('POST', '/app/init');
  const localRepaired = await repairFinanceInterestEntries();
  return {
    companyName: result.companyName || '',
    accounts: result.accounts || [],
    repaired: result.repaired || 0,
    syncedLocks: result.syncedLocks || 0,
    localRepaired
  };
}
