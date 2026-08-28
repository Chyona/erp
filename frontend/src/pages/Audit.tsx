import { useEffect, useMemo, useState } from 'react';
import { Typography } from 'antd';
import { ErpApi } from '../services/erpApi';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import ScrollTable from '../components/ScrollTable';
import PageTableLayout from '../components/PageTableLayout';
import SensitiveColumnHeader from '../components/SensitiveColumnHeader';
import { formatSensitiveText } from '../utils/maskSensitiveText';
import type { AuditLog } from '../types';

const { Paragraph } = Typography;

function formatOperator(log: AuditLog): string {
  const name = (log.operatorNickname || '').trim() || (log.operatorUsername || '').trim();
  if (name && log.operatorUsername && log.operatorNickname && log.operatorNickname !== log.operatorUsername) {
    return `${log.operatorNickname}（${log.operatorUsername}）`;
  }
  if (name) return name;
  return '未知';
}

export default function Audit() {
  const { refreshKey } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [showOperatorPlain, setShowOperatorPlain] = useState(false);
  const { loading, run } = useAsyncLoading(true);

  useEffect(() => {
    void run(async () => {
      const all = await ErpApi.getAll('auditLogs');
      setLogs(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200));
    });
  }, [refreshKey, tabDataRefresh, run]);

  const columns = useMemo(
    () => [
      {
        title: '时间',
        dataIndex: 'timestamp',
        width: 180,
        render: (t: string) => new Date(t).toLocaleString('zh-CN')
      },
      {
        title: (
          <SensitiveColumnHeader
            label="操作人"
            visible={showOperatorPlain}
            onToggle={() => setShowOperatorPlain((value) => !value)}
          />
        ),
        key: 'operator',
        width: 176,
        ellipsis: true,
        render: (_: unknown, record: AuditLog) =>
          formatSensitiveText(formatOperator(record), showOperatorPlain)
      },
      { title: '操作', dataIndex: 'action', width: 120 },
      { title: '对象', dataIndex: 'target', width: 120 },
      { title: '详情', dataIndex: 'details', ellipsis: true }
    ],
    [showOperatorPlain]
  );

  return (
    <PageTableLayout
      toolbar={
        <Paragraph type="secondary" style={{ margin: 0 }}>
          所有操作均自动记录操作人，便于税务查账时追溯数据来源与变更历史
        </Paragraph>
      }
    >
      <ScrollTable
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        pagination={{
          pageSize: 100,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (total) => `共 ${total} 条`
        }}
        locale={{ emptyText: '暂无日志' }}
      />
    </PageTableLayout>
  );
}
