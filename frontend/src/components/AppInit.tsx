import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Spin, Typography } from 'antd';
import { ErpApi } from '../services/erpApi';
import { apiRequest } from '../services/apiClient';
import { repairFinanceInterestEntries } from '../services/financeExpenseRepair';
import { useApp } from '../context/AppContext';
import { sanitizeUserMessage } from '../utils/userMessage';
import type { Account } from '../types';

const { Paragraph, Text } = Typography;

type AppInitResult = {
  companyName: string;
  accounts: Account[];
  repaired: number;
  syncedLocks: number;
};

function formatInitError(err: unknown): { summary: string; tips: string[] } {
  const raw = err instanceof Error ? err.message : '加载失败';
  const lower = raw.toLowerCase();

  if (
    /无法连接服务器|后端不可用|failed to fetch|networkerror|net::|econnrefused|http\s*[45]\d\d|加载失败/i.test(
      raw
    ) ||
    lower.includes('fetch')
  ) {
    return {
      summary: '连不上服务器，暂时无法打开系统。',
      tips: [
        '请确认电脑上的「后端服务」已启动（一般在本机 30000 端口）。',
        '请确认数据库服务已启动。',
        '若是第一次使用，需先完成数据库初始化后再启动后端。',
        '都就绪后，刷新本页面再试。'
      ]
    };
  }

  return {
    summary: sanitizeUserMessage(raw),
    tips: ['请稍后刷新页面重试；若仍然失败，请联系管理员协助排查。']
  };
}

export default function AppInit({ children }: { children: ReactNode }) {
  const { setCompanyName, setAccounts, refresh, refreshKey } = useApp();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<{ summary: string; tips: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
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
          setError(formatInitError(err));
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
        <Alert
          type="error"
          showIcon
          message="无法启动系统"
          description={
            <div>
              <Paragraph style={{ marginBottom: 12 }}>{error.summary}</Paragraph>
              <Text type="secondary">你可以按下面步骤检查：</Text>
              <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {error.tips.map((tip) => (
                  <li key={tip} style={{ marginBottom: 4 }}>
                    {tip}
                  </li>
                ))}
              </ol>
            </div>
          }
        />
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
