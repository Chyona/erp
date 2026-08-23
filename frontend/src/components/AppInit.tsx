import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Typography } from 'antd';
import { useApp } from '../context/AppContext';
import { sanitizeUserMessage } from '../utils/userMessage';
import AppSpin from './AppSpin';

const { Paragraph, Text } = Typography;

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
        '请确认后端服务已启动。',
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
  const { reinitApp } = useApp();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<{ summary: string; tips: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await reinitApp();
        if (!cancelled) {
          setReady(true);
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
  }, [reinitApp]);

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
      <AppSpin fullscreen size="large" tip="加载中…">
        <div style={{ minHeight: 48, minWidth: 96 }} />
      </AppSpin>
    );
  }

  return children;
}
