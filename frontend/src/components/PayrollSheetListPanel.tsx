import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, DatePicker, Dropdown, Modal, Pagination, Space, Tag, App, Tooltip } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  ReloadOutlined,
  UploadOutlined,
  DownOutlined
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import ScrollTable from './ScrollTable';
import PayrollVoucherPickerModal from './PayrollVoucherPickerModal';
import { Salary, formatPayrollVoucherLinkNo, hasPayrollVoucherLinks, PAYROLL_DELETE_BLOCKED_BY_VOUCHER_MESSAGE, resolvePayrollVoucherShortLabel, type PayrollSheetListItem, type PayrollVoucherLinkType, type PayrollVoucherLinkView } from '../services/salary';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useApp } from '../context/AppContext';
import { usePageTabs } from '../context/PageTabsContext';
import { useAuth } from '../context/AuthContext';
import { useVoucherPageNavigation } from '../hooks/useVoucherPageNavigation';
import { confirmDanger } from '../utils/confirmAction';
import { clampMonthRangeToToday, clampMonthToToday, disableFutureMonth } from '../utils/dateConstraints';
import { defaultPayrollMonthDayjs, defaultPayrollMonthRange, taxExemptionPeriodKey } from '../utils/reportPeriod';

function monthKey(value: Dayjs) {
  return taxExemptionPeriodKey({ type: 'month', year: value.year(), month: value.month() + 1 });
}

function tableScrollX(columns: ColumnsType<PayrollSheetListItem>) {
  return columns.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 120), 0);
}

export default function PayrollSheetListPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const { openPageTab } = usePageTabs();
  const { user } = useAuth();
  const { openVoucherEdit } = useVoucherPageNavigation();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => defaultPayrollMonthRange());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PayrollSheetListItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetMonth, setCopyTargetMonth] = useState<Dayjs>(() => defaultPayrollMonthDayjs());
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [linkModalPeriod, setLinkModalPeriod] = useState<PayrollSheetListItem | null>(null);
  const [linkExistingIds, setLinkExistingIds] = useState<string[]>([]);
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  const startKey = monthKey(range[0]);
  const endKey = monthKey(range[1]);

  const copyTargetPeriodKey = monthKey(copyTargetMonth);
  const copySourcePeriodKey = Salary.previousPeriodKey(copyTargetPeriodKey);
  const copySourcePeriodLabel = copySourcePeriodKey
    ? Salary.formatPeriodLabel(copySourcePeriodKey)
    : '—';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await Salary.listSheets(startKey, endKey);
      setRows(list);
    } catch (err) {
      message.error((err as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [endKey, message, startKey]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey, tabDataRefresh]);

  useEffect(() => {
    setPage(1);
  }, [startKey, endKey]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [page, pageSize, rows]);

  const openDetail = (periodKey: string) => {
    openPageTab(`/payroll/sheet/${periodKey}`);
  };

  const handleManualEntry = async () => {
    const periodKey = endKey;
    if (!readOnly) {
      await Salary.ensurePeriod(periodKey, {
        creationMethod: 'manual',
        createdBy: user?.nickname || user?.username
      });
      refresh();
    }
    openDetail(periodKey);
  };

  const openCopyModal = () => {
    setCopyTargetMonth(clampMonthToToday(dayjs(`${endKey}-01`)));
    setCopyModalOpen(true);
  };

  const handleCopyConfirm = async () => {
    const periodKey = copyTargetPeriodKey;
    const prevKey = Salary.previousPeriodKey(periodKey);
    if (!prevKey) {
      message.error('无法计算上月');
      return Promise.reject(new Error('无法计算上月'));
    }

    setCopySubmitting(true);
    try {
      const hasSource = await Salary.hasPeriodCopySource(prevKey);
      if (!hasSource) {
        message.warning(`${Salary.formatPeriodLabel(prevKey)}暂无工资或劳务数据`);
        return Promise.reject(new Error('上月暂无工资或劳务数据'));
      }

      await Salary.copyFromPreviousMonth(periodKey, user?.nickname || user?.username);
      message.success('已复制上月工资及劳务数据');
      setCopyModalOpen(false);
      refresh();
      await loadData();
      openDetail(periodKey);
    } catch (err) {
      if ((err as Error).message !== '上月暂无工资或劳务数据') {
        message.error((err as Error).message || '复制失败');
      }
      return Promise.reject(err);
    } finally {
      setCopySubmitting(false);
    }
  };

  const handleDelete = async (record: PayrollSheetListItem) => {
    if (hasPayrollVoucherLinks(record)) {
      message.warning(PAYROLL_DELETE_BLOCKED_BY_VOUCHER_MESSAGE);
      return;
    }
    const ok = await confirmDanger(modal, {
      title: '删除工资表？',
      content: `确定删除「${record.periodLabel}」工资表吗？`
    });
    if (!ok) return;
    try {
      await Salary.deletePeriod(record.periodKey);
      message.success('已删除');
      refresh();
      await loadData();
    } catch (err) {
      message.error((err as Error).message || '删除失败');
    }
  };

  const openLinkModal = async (record: PayrollSheetListItem) => {
    try {
      const period = await Salary.getPeriod(record.periodKey);
      setLinkExistingIds(period.voucherLinks.map((item) => item.voucherId));
      setLinkModalPeriod(record);
    } catch (err) {
      message.error((err as Error).message || '加载工资表失败');
    }
  };

  const handleLinkConfirm = async (payload: {
    voucherId: string;
    linkType: PayrollVoucherLinkType;
    customLabel?: string;
  }) => {
    if (!linkModalPeriod) return;
    setLinkSubmitting(true);
    try {
      await Salary.addVoucherLink(linkModalPeriod.periodKey, payload);
      message.success('已关联凭证');
      setLinkModalPeriod(null);
      refresh();
      await loadData();
    } catch (err) {
      message.error((err as Error).message || '关联失败');
      throw err;
    } finally {
      setLinkSubmitting(false);
    }
  };

  const renderVoucherLinks = (record: PayrollSheetListItem, links: PayrollVoucherLinkView[]) => {
    if (!links.length) return '—';
    return (
      <div className="payroll-sheet-list__voucher-links">
        {links.map((link) => (
          <div key={link.id} className="payroll-sheet-list__voucher-link-row">
            <Tag bordered={false} className="payroll-sheet-list__voucher-tag">
              {resolvePayrollVoucherShortLabel(link)}
            </Tag>
            <Button
              type="link"
              size="small"
              className="payroll-sheet-list__voucher-link"
              disabled={link.missing}
              onClick={() => (link.missing ? undefined : openVoucherEdit(link.voucherId))}
            >
              {formatPayrollVoucherLinkNo(link)}
            </Button>
            {!readOnly ? (
              <Button
                type="link"
                size="small"
                danger
                onClick={() =>
                  void Salary.removeVoucherLink(record.periodKey, link.id).then(() => {
                    refresh();
                    return loadData();
                  })
                }
              >
                删除
              </Button>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const columns: ColumnsType<PayrollSheetListItem> = [
    {
      title: '操作',
      key: 'actions',
      width: 90,
      fixed: 'left',
      align: 'center',
      render: (_, record) => (
        <Space size={2}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            aria-label="编辑"
            onClick={() => openDetail(record.periodKey)}
          />
          {!readOnly ? (
            <>
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                aria-label="关联凭证"
                title="关联凭证"
                onClick={() => void openLinkModal(record)}
              />
              <Tooltip
                title={
                  hasPayrollVoucherLinks(record) ? PAYROLL_DELETE_BLOCKED_BY_VOUCHER_MESSAGE : undefined
                }
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label="删除"
                  disabled={hasPayrollVoucherLinks(record)}
                  onClick={() => void handleDelete(record)}
                />
              </Tooltip>
            </>
          ) : null}
        </Space>
      )
    },
    {
      title: '工资月份',
      dataIndex: 'periodLabel',
      width: 100,
      fixed: 'left'
    },
    {
      title: '职员数',
      dataIndex: 'staffCount',
      width: 75,
      align: 'center'
    },
    {
      title: '应发工资汇总',
      dataIndex: 'grossTotal',
      align: 'right',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '实发工资汇总',
      dataIndex: 'netSalary',
      align: 'right',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '劳务人数',
      dataIndex: 'laborCount',
      width: 75,
      align: 'center'
    },
    {
      title: '应发劳务汇总',
      dataIndex: 'laborGrossTotal',
      align: 'right',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '实发劳务汇总',
      dataIndex: 'laborNetTotal',
      align: 'right',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '人力成本',
      dataIndex: 'employerCostTotal',
      align: 'right',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '计提',
      key: 'accrualVouchers',
      width: 240,
      render: (_, record) => renderVoucherLinks(record, record.accrualVouchers)
    },
    {
      title: '发放/支付',
      key: 'paymentVouchers',
      width: 240,
      render: (_, record) => renderVoucherLinks(record, record.paymentVouchers)
    },
    { title: '创建方式', dataIndex: 'creationMethod', width: 80 },
    { title: '创建人', dataIndex: 'createdBy', width: 80, ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', width: 160 }
  ];

  const scrollX = tableScrollX(columns) + (readOnly ? 0 : 48);

  return (
    <div className="payroll-sheet-list-panel">
      <div className="payroll-sheet-list-panel__toolbar">
        <Space wrap size={12}>
          <span>月份</span>
          <DatePicker.RangePicker
            picker="month"
            allowClear={false}
            value={range}
            disabledDate={disableFutureMonth}
            onChange={(values) => {
              if (values?.[0] && values[1]) {
                const clamped = clampMonthRangeToToday([values[0], values[1]]);
                if (clamped) setRange(clamped);
              }
            }}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
            刷新
          </Button>
        </Space>
        {!readOnly ? (
          <Space wrap size={8} className="payroll-sheet-list-panel__actions">
            <Dropdown
              menu={{
                items: [{ key: 'import', label: '导入工资表', disabled: true }]
              }}
            >
              <Button type="primary">
                导入 <DownOutlined />
              </Button>
            </Dropdown>
            <Button onClick={openCopyModal}>复制上月</Button>
            <Button onClick={() => void handleManualEntry()}>手动录入</Button>
          </Space>
        ) : null}
      </div>

      <div className="payroll-sheet-list-panel__table">
        <ScrollTable
          fillPage
          autoHeight
          size="small"
          bordered
          tableLayout="fixed"
          loading={loading}
          rowKey="periodKey"
          columns={columns}
          dataSource={pagedRows}
          pagination={false}
          scroll={{ x: scrollX }}
          className="payroll-sheet-list-table"
          bodyClassName="page-table-body--payroll-sheet-list"
          wrapStyle={
            {
              '--payroll-sheet-list-scroll-x': `${scrollX}px`
            } as CSSProperties
          }
          rowSelection={
            readOnly
              ? undefined
              : {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys.map(String))
              }
          }
          locale={{ emptyText: '暂无数据' }}
          footer={
            <div className="table-scroll-footer payroll-sheet-list-panel__pagination">
              <Pagination
                size="small"
                current={page}
                pageSize={pageSize}
                total={rows.length}
                showSizeChanger
                pageSizeOptions={[20, 50, 100, 500]}
                showTotal={(total) => `共 ${total} 条`}
                onChange={(nextPage, nextSize) => {
                  setPage(nextPage);
                  if (nextSize !== pageSize) setPageSize(nextSize);
                }}
              />
            </div>
          }
        />
      </div>

      <Modal
        title="选择新建工资表月份"
        width={600}
        open={copyModalOpen}
        centered
        okText="确定"
        cancelText="取消"
        confirmLoading={copySubmitting}
        onCancel={() => {
          if (!copySubmitting) setCopyModalOpen(false);
        }}
        onOk={() => handleCopyConfirm()}
      >
        <div className="payroll-copy-modal__body">
          <span>系统将复制</span>
          <strong className="payroll-copy-modal__source">{copySourcePeriodLabel}</strong>
          <span>工资表自动生成</span>
          <DatePicker
            picker="month"
            allowClear={false}
            value={copyTargetMonth}
            className="payroll-copy-modal__picker"
            disabledDate={disableFutureMonth}
            onChange={(value) => {
              if (value) setCopyTargetMonth(clampMonthToToday(value));
            }}
          />
          <span>的工资及劳务数据</span>
        </div>
      </Modal>

      <PayrollVoucherPickerModal
        open={Boolean(linkModalPeriod)}
        periodLabel={linkModalPeriod?.periodLabel ?? ''}
        existingVoucherIds={linkExistingIds}
        confirmLoading={linkSubmitting}
        onCancel={() => {
          if (!linkSubmitting) setLinkModalPeriod(null);
        }}
        onConfirm={handleLinkConfirm}
      />
    </div>
  );
}
