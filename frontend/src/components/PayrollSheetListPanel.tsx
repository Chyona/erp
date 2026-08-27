import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, DatePicker, Dropdown, Modal, Pagination, Space, App } from 'antd';
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
import { Salary, type PayrollSheetListItem, type PayrollVoucherLinkType } from '../services/salary';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useApp } from '../context/AppContext';
import { usePageTabs } from '../context/PageTabsContext';
import { useAuth } from '../context/AuthContext';
import { useVoucherPageNavigation } from '../hooks/useVoucherPageNavigation';
import { confirmDanger } from '../utils/confirmAction';
import { defaultReportPeriod, taxExemptionPeriodKey } from '../utils/reportPeriod';

function monthKey(value: Dayjs) {
  return taxExemptionPeriodKey({ type: 'month', year: value.year(), month: value.month() + 1 });
}

function defaultMonthRange(): [Dayjs, Dayjs] {
  const now = defaultReportPeriod();
  const end = dayjs(`${now.year}-${String(now.month).padStart(2, '0')}-01`);
  const start = end.subtract(6, 'month');
  return [start, end];
}

export default function PayrollSheetListPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const { openPageTab } = usePageTabs();
  const { user } = useAuth();
  const { openVoucherEdit } = useVoucherPageNavigation();
  const [range, setRange] = useState<[Dayjs, Dayjs]>(() => defaultMonthRange());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<PayrollSheetListItem[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copyTargetMonth, setCopyTargetMonth] = useState<Dayjs>(() => defaultMonthRange()[1]);
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
    setCopyTargetMonth(dayjs(`${endKey}-01`));
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
      const hasSource = await Salary.hasPeriodSalaryData(prevKey);
      if (!hasSource) {
        message.warning(`${Salary.formatPeriodLabel(prevKey)}暂无工资表数据`);
        return Promise.reject(new Error('上月暂无工资表数据'));
      }

      await Salary.copyFromPreviousMonth(periodKey, user?.nickname || user?.username);
      message.success('已复制上月工资表');
      setCopyModalOpen(false);
      refresh();
      await loadData();
      openDetail(periodKey);
    } catch (err) {
      if ((err as Error).message !== '上月暂无工资表数据') {
        message.error((err as Error).message || '复制失败');
      }
      return Promise.reject(err);
    } finally {
      setCopySubmitting(false);
    }
  };

  const handleDelete = async (record: PayrollSheetListItem) => {
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

  const columns: ColumnsType<PayrollSheetListItem> = [
    {
      title: '操作',
      key: 'actions',
      width: readOnly ? 96 : 128,
      render: (_, record) => (
        <Space size={4}>
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
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label="删除"
                onClick={() => void handleDelete(record)}
              />
            </>
          ) : null}
          <Button type="text" size="small" icon={<UploadOutlined />} aria-label="导出" disabled />
        </Space>
      )
    },
    { title: '工资月份', dataIndex: 'periodLabel', width: 110 },
    {
      title: '工资类别',
      dataIndex: 'salaryCategory',
      width: 100,
      render: (value) => value || '—'
    },
    {
      title: '职员数',
      dataIndex: 'staffCount',
      width: 80,
      align: 'center'
    },
    {
      title: '应发工资汇总',
      dataIndex: 'grossTotal',
      width: 120,
      align: 'right',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '实发工资汇总',
      dataIndex: 'netSalary',
      width: 120,
      align: 'right',
      render: (value) => Salary.formatMoneyDisplay(value)
    },
    {
      title: '计提工资凭证',
      key: 'accrualVoucher',
      width: 160,
      render: (_, record) =>
        record.accrualVoucher ? (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              className="payroll-sheet-list__voucher-link"
              onClick={() =>
                record.accrualVoucher?.missing
                  ? undefined
                  : openVoucherEdit(record.accrualVoucher.voucherId)
              }
            >
              {record.accrualVoucher.voucherNo || '凭证已删除'}
            </Button>
            {!readOnly ? (
              <Button
                type="link"
                size="small"
                danger
                onClick={() =>
                  void Salary.removeVoucherLink(record.periodKey, record.accrualVoucher!.id).then(
                    loadData
                  )
                }
              >
                删除
              </Button>
            ) : null}
          </Space>
        ) : (
          '—'
        )
    },
    {
      title: '发放工资凭证',
      key: 'paymentVoucher',
      width: 160,
      render: (_, record) =>
        record.paymentVoucher ? (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              className="payroll-sheet-list__voucher-link"
              onClick={() =>
                record.paymentVoucher?.missing
                  ? undefined
                  : openVoucherEdit(record.paymentVoucher.voucherId)
              }
            >
              {record.paymentVoucher.voucherNo || '凭证已删除'}
            </Button>
            {!readOnly ? (
              <Button
                type="link"
                size="small"
                danger
                onClick={() =>
                  void Salary.removeVoucherLink(record.periodKey, record.paymentVoucher!.id).then(
                    loadData
                  )
                }
              >
                删除
              </Button>
            ) : null}
          </Space>
        ) : (
          '—'
        )
    },
    { title: '创建方式', dataIndex: 'creationMethod', width: 100 },
    { title: '创建人', dataIndex: 'createdBy', width: 100, ellipsis: true },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 }
  ];

  return (
    <div className="payroll-sheet-list-panel">
      <div className="payroll-sheet-list-panel__toolbar">
        <Space wrap size={12}>
          <span>月份</span>
          <DatePicker.RangePicker
            picker="month"
            allowClear={false}
            value={range}
            onChange={(values) => {
              if (values?.[0] && values[1]) setRange([values[0], values[1]]);
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
          loading={loading}
          rowKey="periodKey"
          columns={columns}
          dataSource={pagedRows}
          pagination={false}
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
        width={560}
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
            onChange={(value) => {
              if (value) setCopyTargetMonth(value.startOf('month'));
            }}
          />
          <span>的工资数据</span>
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
