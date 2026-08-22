import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Spin } from 'antd';
import { ErpApi } from '../services/erpApi';
import { apiRequest } from '../services/apiClient';
import { repairFinanceInterestEntries } from '../services/financeExpenseRepair';
import { useApp } from '../context/AppContext';
import type { Account } from '../types';

type AppInitResult = {
  companyName: string;
  accounts: Account[];
  repaired: number;
  syncedLocks: number;
};

export default function AppInit({ children }: { children: ReactNode }) {
  const { setCompanyName, setAccounts, refresh, refreshKey } = useApp();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError('');
        await ErpApi.open();

        const result = await apiRequest<AppInitResult>('POST', '/app/init');
        const repaired = await repairFinanceInterestEntries();
        const syncedFromServer = (result.repaired || 0) + (result.syncedLocks || 0);

        if (!cancelled) {
          setCompanyName(result.companyName || '');
          setAccounts(result.accounts || []);
          setReady(true);
          if (syncedFromServer > 0 || repaired > 0) {
            refresh();
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : '加载失败';
          setError(
            `${message}。请确认 PostgreSQL 已启动并已执行 go run ./cmd/envinit schema，且 API 运行在 :30000`
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, setCompanyName, setAccounts, refresh]);

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: '20vh auto', padding: '0 24px' }}>
        <Alert type="error" showIcon message="应用初始化失败" description={error} />
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中...">
          <div style={{ minHeight: 48, minWidth: 48 }} />
        </Spin>
      </div>
    );
  }

  return children;
}
