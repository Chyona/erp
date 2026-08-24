import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, App } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { Reports as ReportsService } from '../services/reports';
import { ExportUtil } from '../services/export';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import ScrollTable from '../components/ScrollTable';
import ReportPeriodFilter from '../components/ReportPeriodFilter';
import {
  defaultReportPeriod,
  formatReportPeriod,
  reportPeriodToDateRange
} from '../utils/reportPeriod';
import type { GeneralLedgerRow } from '../types';

const TABLE_SCROLL_X = 874;

const FILL_COL_CLASS = 'general-ledger-page__fill-col';

function formatAmount(value: number | null | undefined) {
  if (value == null || Math.abs(Number(value)) < 0.005) return '';
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatBalance(value: number) {
  return Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export default function GeneralLedger() {
  const { message } = App.useApp();
  const { refreshKey } = useApp();
  const { can } = useAuth();
  const [period, setPeriod] = useState(defaultReportPeriod);
  const [refreshToken, setRefreshToken] = useState(0);
  const [data, setData] = useState<Awaited<ReturnType<typeof ReportsService.getGeneralLedger>> | null>(
    null
  );
  const { loading, run } = useAsyncLoading();

  const dateRange = useMemo(() => reportPeriodToDateRange(period), [period]);

  useEffect(() => {
    void run(async () => {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const result = await ReportsService.getGeneralLedger(start, end);
      setData(result);
    });
  }, [dateRange, refreshKey, refreshToken, run]);

  const columns: ColumnsType<GeneralLedgerRow> = [
    {
      title: '科目编码',
      dataIndex: 'accountCode',
      width: 120,
      fixed: 'left',
      align: 'center',
      className: 'general-ledger-page__col-code',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-code' }),
      onCell: (record) => ({
        rowSpan: record.accountRowSpan,
        className: 'general-ledger-page__col-code'
      })
    },
    {
      title: '科目名称',
      dataIndex: 'accountName',
      width: 160,
      fixed: 'left',
      ellipsis: true,
      className: 'general-ledger-page__col-name',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-name' }),
      onCell: (record) => ({
        rowSpan: record.accountRowSpan,
        className: 'general-ledger-page__col-name'
      })
    },
    {
      title: '期间',
      dataIndex: 'period',
      width: 120,
      align: 'center',
      className: 'general-ledger-page__col-period',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-period' }),
      onCell: () => ({ className: 'general-ledger-page__col-period' })
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      width: 200,
      align: 'center',
      className: 'general-ledger-page__col-summary',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-summary' }),
      onCell: () => ({ className: 'general-ledger-page__col-summary' })
    },
    {
      title: '借方',
      dataIndex: 'debit',
      width: 160,
      align: 'right',
      className: 'general-ledger-page__col-amount',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-amount' }),
      onCell: () => ({ className: 'general-ledger-page__col-amount' }),
      render: (value) => formatAmount(value)
    },
    {
      title: '贷方',
      dataIndex: 'credit',
      width: 160,
      align: 'right',
      className: 'general-ledger-page__col-amount',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-amount' }),
      onCell: () => ({ className: 'general-ledger-page__col-amount' }),
      render: (value) => formatAmount(value)
    },
    {
      title: '方向',
      dataIndex: 'direction',
      width: 80,
      align: 'center',
      className: 'general-ledger-page__col-direction',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-direction' }),
      onCell: () => ({ className: 'general-ledger-page__col-direction' })
    },
    {
      title: '余额',
      dataIndex: 'balance',
      width: 160,
      align: 'right',
      className: 'general-ledger-page__col-balance',
      onHeaderCell: () => ({ className: 'general-ledger-page__col-balance' }),
      render: (value: number) => formatBalance(value),
      onCell: (record) => ({
        className: [
          'general-ledger-page__col-balance',
          record.balance < -0.005 ? 'general-ledger-page__balance--negative' : ''
        ]
          .filter(Boolean)
          .join(' ')
      })
    },
    {
      title: '',
      key: '__fill',
      className: FILL_COL_CLASS,
      onHeaderCell: () => ({ className: FILL_COL_CLASS }),
      onCell: () => ({ className: FILL_COL_CLASS }),
      render: () => null
    }
  ];

  const handleExport = () => {
    if (!data?.rows?.length) {
      message.error('请先查询总账');
      return;
    }
    const csv = ExportUtil.generalLedgerToCSV(data, formatReportPeriod(period));
    ExportUtil.downloadBlob(
      csv,
      `总账_${formatReportPeriod(period)}.csv`,
      'text/csv;charset=utf-8'
    );
    message.success('总账导出成功');
  };

  return (
    <div className="page-table-layout general-ledger-page">
      <div className="page-table-toolbar general-ledger-page__toolbar">
        <ReportPeriodFilter
          value={period}
          onChange={setPeriod}
          loading={loading}
          onRefresh={() => setRefreshToken((token) => token + 1)}
          beforeRefresh={
            can('export') ? (
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
            ) : null
          }
        />
      </div>

      <ScrollTable
        fillPage
        autoHeight
        rowKey="key"
        columns={columns}
        dataSource={data?.rows || []}
        loading={loading}
        pagination={false}
        bordered
        size="small"
        tableLayout="fixed"
        scroll={{ x: TABLE_SCROLL_X }}
        locale={{ emptyText: '请选择期间并查询' }}
        footer={
          data?.rows?.length ? (
            <div className="table-scroll-footer">共 {data.rows.length / 3} 个科目</div>
          ) : null
        }
      />
    </div>
  );
}
