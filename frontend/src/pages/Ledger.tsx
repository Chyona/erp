import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Pagination, Table, Typography, App, Space, Tag } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useVoucherPageNavigation } from '../hooks/useVoucherPageNavigation';
import type { ColumnsType } from 'antd/es/table';
import type { Account, LedgerResult, LedgerRow } from '../types';
import { Voucher } from '../services/voucher';
import { Accounts } from '../services/accounts';
import { ExportUtil } from '../services/export';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useAuth } from '../context/AuthContext';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import ScrollTable from '../components/ScrollTable';
import PageTableLayout from '../components/PageTableLayout';
import EllipsisText from '../components/EllipsisText';
import VoucherTimeFilter from '../components/VoucherTimeFilter';
import LedgerAccountTree from '../components/LedgerAccountTree';
import {
  loadStoredTimeFilter,
  resolveTimeFilterQuery,
  saveStoredTimeFilter,
  type VoucherTimeFilterState
} from '../utils/voucherTimeFilter';
import { formatBalanceDirection, formatLedgerAmount } from '../utils/ledgerDisplay';

const { Link } = Typography;

const LEDGER_TABLE_SCROLL_X = 962;

export default function Ledger() {
  const { message } = App.useApp();
  const { refreshKey } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const { can } = useAuth();
  const { openVoucherEdit } = useVoucherPageNavigation();
  const [accountList, setAccountList] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState('');
  const [timeFilter, setTimeFilter] = useState<VoucherTimeFilterState>(() => loadStoredTimeFilter());
  const [dateRange, setDateRange] = useState(() => resolveTimeFilterQuery(loadStoredTimeFilter()));
  const [ledger, setLedger] = useState<LedgerResult | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const { loading: accountsLoading, run: runAccountsLoad } = useAsyncLoading(true);
  const { loading: queryLoading, run: runQuery } = useAsyncLoading();

  useEffect(() => {
    void runAccountsLoad(async () => {
      const accs = await Accounts.getAll();
      setAccountList(accs);
      setAccountId((current) => current || accs[0]?.id || '');
    });
  }, [refreshKey, tabDataRefresh, runAccountsLoad]);

  const loadLedger = useCallback(
    async (nextAccountId: string, startDate: string, endDate: string) => {
      if (!nextAccountId || !startDate || !endDate) {
        setLedger(null);
        return;
      }
      await runQuery(async () => {
        const result = await Voucher.getLedger(nextAccountId, startDate, endDate);
        setLedger(result);
        setPage(1);
      });
    },
    [runQuery]
  );

  useEffect(() => {
    void loadLedger(accountId, dateRange.startDate, dateRange.endDate);
  }, [accountId, dateRange.startDate, dateRange.endDate, refreshKey, tabDataRefresh, loadLedger]);

  const handleTimeQuery = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  const handleTimeFilterChange = (next: VoucherTimeFilterState) => {
    setTimeFilter(next);
    saveStoredTimeFilter(next);
  };

  const handleRefresh = () => {
    void loadLedger(accountId, dateRange.startDate, dateRange.endDate);
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

  const ledgerTotals = useMemo(() => {
    if (!ledger?.rows?.length) return null;
    let debit = 0;
    let credit = 0;
    for (const row of ledger.rows) {
      if (row.isOpening) continue;
      debit += row.debit || 0;
      credit += row.credit || 0;
    }
    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
      endingBalance: ledger.endingBalance
    };
  }, [ledger]);

  const openingRow = useMemo(
    () => ledger?.rows?.find((row) => row.isOpening) ?? null,
    [ledger]
  );
  const transactionRows = useMemo(
    () => ledger?.rows?.filter((row) => !row.isOpening) ?? [],
    [ledger]
  );

  const displayRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const pageTransactions = transactionRows.slice(start, start + pageSize);
    return openingRow ? [openingRow, ...pageTransactions] : pageTransactions;
  }, [openingRow, transactionRows, page, pageSize]);

  const openVoucher = useCallback(
    (row: LedgerRow) => {
      if (!row.voucherId) return;
      openVoucherEdit(row.voucherId);
    },
    [openVoucherEdit]
  );

  const renderVoucherNo = (value: string, row: LedgerRow) => {
    if (row.isOpening) return <span className="ledger-page__opening-muted">—</span>;
    if (!value) return '';

    const voucherLink = row.voucherId ? (
      <Link className="ledger-page__voucher-link" onClick={() => openVoucher(row)}>
        {value}
      </Link>
    ) : (
      value
    );

    if (row.isDraft) {
      return (
        <span className="ledger-page__draft-voucher">
          {voucherLink}
          <Tag color="gold" className="ledger-page__draft-tag">
            未审核
          </Tag>
        </span>
      );
    }

    return voucherLink;
  };

  const renderLedgerRowClass = (row: LedgerRow) => (row.isOpening ? 'ledger-page__row--opening' : '');

  const columns: ColumnsType<LedgerRow> = useMemo(
    () => [
      {
        title: '日期',
        dataIndex: 'date',
        width: 110,
        render: (value, row) =>
          row.isOpening ? <span className="ledger-page__opening-muted">—</span> : value
      },
      {
        title: '凭证字号',
        dataIndex: 'voucherNo',
        width: 120,
        render: (value, row) => renderVoucherNo(value || '', row)
      },
      {
        title: '摘要',
        dataIndex: 'summary',
        width: 280,
        ellipsis: true,
        render: (value, row) =>
          row.isOpening ? <span className="ledger-page__opening-label">{value}</span> : value
      },
      {
        title: '借方',
        dataIndex: 'debit',
        align: 'right',
        width: 120,
        render: (value, row) => {
          if (row.isOpening) return <span className="ledger-page__opening-muted">—</span>;
          if (row.isDraft) {
            return <span className="ledger-page__draft-amount">{formatLedgerAmount(value)}</span>;
          }
          return formatLedgerAmount(value);
        }
      },
      {
        title: '贷方',
        dataIndex: 'credit',
        align: 'right',
        width: 120,
        render: (value, row) => {
          if (row.isOpening) return <span className="ledger-page__opening-muted">—</span>;
          if (row.isDraft) {
            return <span className="ledger-page__draft-amount">{formatLedgerAmount(value)}</span>;
          }
          return formatLedgerAmount(value);
        }
      },
      {
        title: '方向',
        key: 'direction',
        align: 'center',
        width: 72,
        render: (_, row) => (
          <span className={row.isOpening ? 'ledger-page__opening-direction' : undefined}>
            {formatBalanceDirection(ledger?.account, row.balance)}
          </span>
        )
      },
      {
        title: '余额',
        dataIndex: 'balance',
        align: 'right',
        width: 120,
        render: (value, row) => (
          <span className={row.isOpening ? 'ledger-page__opening-balance' : undefined}>
            {Number(value).toFixed(2)}
          </span>
        )
      }
    ],
    [ledger?.account, openVoucher]
  );

  const tableSummary = ledgerTotals ? (
    <Table.Summary fixed>
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={3}>
          <strong>合计</strong>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={3} align="right">
          <strong>{formatLedgerAmount(ledgerTotals.debit)}</strong>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={4} align="right">
          <strong>{formatLedgerAmount(ledgerTotals.credit)}</strong>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={5} align="center">
          <strong>{formatBalanceDirection(ledger?.account, ledgerTotals.endingBalance)}</strong>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={6} align="right">
          <strong>{ledgerTotals.endingBalance.toFixed(2)}</strong>
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  ) : null;

  const paginationConfig = {
    current: page,
    pageSize,
    total: transactionRows.length,
    showSizeChanger: true,
    pageSizeOptions: [100, 200, 500],
    showTotal: (total: number) => {
      if (!total) return '共 0 条';
      const start = (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, total);
      return `${start}-${end} 共 ${total} 条`;
    },
    onChange: (nextPage: number, nextPageSize: number) => {
      setPage(nextPage);
      if (nextPageSize !== pageSize) setPageSize(nextPageSize);
    }
  };

  const tableLoading = accountsLoading || queryLoading;
  const selectedAccount = ledger?.account || accountList.find((item) => item.id === accountId) || null;

  return (
    <PageTableLayout className="ledger-page">
      <div className="ledger-page__top">
        <div className="ledger-page__toolbar-main">
          <VoucherTimeFilter
            value={timeFilter}
            onChange={handleTimeFilterChange}
            onQuery={handleTimeQuery}
            showFilter={false}
          />
          <div
            className={`ledger-page__account-chip${selectedAccount ? '' : ' ledger-page__account-chip--empty'}`}
          >
            <span className="ledger-page__account-chip__label">科目</span>
            {selectedAccount ? (
              <>
                <span className="ledger-page__account-chip__code">{selectedAccount.code}</span>
                <EllipsisText
                  className="ledger-page__account-chip__name"
                  tooltip={`${selectedAccount.code} ${selectedAccount.name}`}
                >
                  {selectedAccount.name}
                </EllipsisText>
              </>
            ) : (
              <span className="ledger-page__account-chip__placeholder">请选择科目</span>
            )}
          </div>
        </div>
        <div className="ledger-page__actions">
          <Space wrap>
            {can('export') ? (
              <Button icon={<DownloadOutlined />} onClick={handleExport}>
                导出
              </Button>
            ) : null}
            <Button
              className="ledger-page__refresh"
              icon={<ReloadOutlined />}
              loading={queryLoading}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </Space>
        </div>
      </div>

      <div className="ledger-page__body">
        <div className="ledger-page__main">
          <ScrollTable
            fillPage
            autoHeight
            bodyClassName="ledger-page__ledger-table"
            rowKey={(row) =>
              row.isOpening
                ? 'opening-balance'
                : `${row.voucherId || row.voucherNo}-${row.summary}-${row.debit}-${row.credit}`
            }
            columns={columns}
            dataSource={displayRows}
            loading={tableLoading}
            tableLayout="fixed"
            scroll={{ x: LEDGER_TABLE_SCROLL_X }}
            rowClassName={renderLedgerRowClass}
            pagination={false}
            locale={{ emptyText: '该期间无发生额' }}
            summary={() => tableSummary}
            footer={
              ledger?.rows?.length ? (
                <div className="table-scroll-footer ledger-page__pagination">
                  <Pagination size="small" {...paginationConfig} />
                </div>
              ) : null
            }
          />
        </div>

        <LedgerAccountTree
          accounts={accountList}
          selectedId={accountId}
          onSelect={setAccountId}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      </div>
    </PageTableLayout>
  );
}
