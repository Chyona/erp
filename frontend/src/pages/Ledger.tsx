import { useEffect, useState } from 'react';
import { Button, DatePicker, Select, Table, Typography, App, Space } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { clampDateRangeToToday, disableFutureDate } from '../utils/dateConstraints';
import type { ColumnsType } from 'antd/es/table';
import type { Account, LedgerResult, LedgerRow } from '../types';
import { Voucher } from '../services/voucher';
import { Accounts } from '../services/accounts';
import { ExportUtil } from '../services/export';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import ScrollTable from '../components/ScrollTable';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function Ledger() {
  const { message } = App.useApp();
  const { refreshKey } = useApp();
  const { can } = useAuth();
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('year'), dayjs()]);
  const [ledger, setLedger] = useState<LedgerResult | null>(null);
  const { loading: accountsLoading, run: runAccountsLoad } = useAsyncLoading(true);
  const { loading: queryLoading, run: runQuery } = useAsyncLoading();

  useEffect(() => {
    void runAccountsLoad(async () => {
      const accs = await Accounts.getAll();
      setAccountList(accs);
      if (accs.length) setAccountId(accs[0].id);
    });
  }, [refreshKey, runAccountsLoad]);

  const handleQuery = async () => {
    if (!accountId) return;
    const start = dateRange[0].format('YYYY-MM-DD');
    const end = dateRange[1].format('YYYY-MM-DD');
    await runQuery(async () => {
      const result = await Voucher.getLedger(accountId, start, end);
      setLedger(result);
    });
  };

  const handleExport = () => {
    if (!ledger?.rows?.length) {
      message.error('请先查询明细账');
      return;
    }
    const csv = ExportUtil.ledgerToCSV(ledger);
    const name = ledger.account ? `${ledger.account.code}_${ledger.account.name}` : 'ledger';
    ExportUtil.downloadBlob(csv, `明细账_${name}.csv`, 'text/csv;charset=utf-8');
    message.success('明细账导出成功');
  };

  const columns: ColumnsType<LedgerRow> = [
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '凭证号', dataIndex: 'voucherNo', width: 120 },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '借方',
      dataIndex: 'debit',
      align: 'right',
      width: 120,
      render: (v) => (v ? v.toFixed(2) : '')
    },
    {
      title: '贷方',
      dataIndex: 'credit',
      align: 'right',
      width: 120,
      render: (v) => (v ? v.toFixed(2) : '')
    },
    {
      title: '余额',
      dataIndex: 'balance',
      align: 'right',
      width: 120,
      render: (v) => v.toFixed(2)
    }
  ];

  const tableLoading = accountsLoading || queryLoading;

  return (
    <div className="page-table-layout">
      <div className="page-table-toolbar">
        <Title level={2} style={{ margin: '0 0 12px' }}>
          明细账
        </Title>
        <Space wrap>
          <Select
            style={{ width: 240 }}
            value={accountId || undefined}
            loading={accountsLoading}
            onChange={setAccountId}
            options={accountList.map((a) => ({
              value: a.id,
              label: Accounts.formatAccountOption(a)
            }))}
          />
          <RangePicker
            value={dateRange}
            disabledDate={disableFutureDate}
            onChange={(range) => {
              const next = clampDateRangeToToday(range as [Dayjs, Dayjs] | null);
              if (next) setDateRange(next);
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={queryLoading} onClick={handleQuery}>
            查询
          </Button>
          {can('export') ? (
            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              导出
            </Button>
          ) : null}
        </Space>
      </div>

      <ScrollTable
        rowKey={(r) => r.date + r.voucherNo + r.summary}
        columns={columns}
        dataSource={ledger?.rows || []}
        loading={tableLoading}
        pagination={false}
        locale={{ emptyText: '该期间无发生额，请先查询' }}
        summary={() =>
          ledger?.rows?.length ? (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={5}>
                  <strong>期末余额</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={5} align="right">
                  <strong>{ledger.endingBalance.toFixed(2)}</strong>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          ) : null
        }
      />
    </div>
  );
}
