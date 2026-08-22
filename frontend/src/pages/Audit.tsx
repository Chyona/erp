import { useEffect, useState } from 'react';
import { Typography } from 'antd';
import { ErpApi } from '../services/erpApi';
import { useApp } from '../context/AppContext';
import ScrollTable from '../components/ScrollTable';
import type { AuditLog } from '../types';

const { Title, Paragraph } = Typography;

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
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    (async () => {
      const all = await ErpApi.getAll('auditLogs');
      setLogs(all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200));
    })();
  }, [refreshKey]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 180,
      render: (t: string) => new Date(t).toLocaleString('zh-CN')
    },
    {
      title: '操作人',
      key: 'operator',
      width: 160,
      ellipsis: true,
      render: (_: unknown, record: AuditLog) => formatOperator(record)
    },
    { title: '操作', dataIndex: 'action', width: 120 },
    { title: '对象', dataIndex: 'target', width: 120 },
    { title: '详情', dataIndex: 'details', ellipsis: true }
  ];

  return (
    <div className="page-table-layout">
      <div className="page-table-toolbar">
        <Title level={2} style={{ margin: '0 0 8px' }}>
          审计日志
        </Title>
        <Paragraph type="secondary" style={{ margin: 0 }}>
          所有操作均自动记录操作人，便于税务查账时追溯数据来源与变更历史
        </Paragraph>
      </div>

      <ScrollTable
        rowKey="id"
        columns={columns}
        dataSource={logs}
        pagination={{
          pageSize: 100,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (total) => `共 ${total} 条`
        }}
        locale={{ emptyText: '暂无日志' }}
      />
    </div>
  );
}
