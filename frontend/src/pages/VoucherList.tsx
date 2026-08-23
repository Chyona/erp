import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Dropdown, Space, Typography, App } from 'antd';
import {
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Voucher } from '../services/voucher';
import { ExportUtil } from '../services/export';
import { ErpApi } from '../services/erpApi';
import VoucherTable from '../components/VoucherTable';
import VoucherDetailModal from '../components/VoucherDetailModal';
import VoucherImportModal from '../components/VoucherImportModal';
import VoucherFilterPanel, { EMPTY_VOUCHER_FILTERS } from '../components/VoucherFilterPanel';
import VoucherTimeFilter from '../components/VoucherTimeFilter';
import { defaultTimeFilter } from '../utils/voucherTimeFilter';
import type { VoucherTimeFilterState } from '../utils/voucherTimeFilter';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isCarryForwardVoucher } from '../utils/carryForwardVoucher';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import type { VoucherFilters } from '../types';

const { Title } = Typography;

function countActiveFilters(filters: VoucherFilters) {
  const keys: (keyof VoucherFilters)[] = [
    'voucherNumber',
    'status',
    'summary',
    'accountCode',
    'amountMin',
    'amountMax',
    'businessType',
    'signatory',
    'remark'
  ];
  return keys.filter((key) => {
    const value = filters[key];
    return value !== '' && value != null;
  }).length;
}

const INITIAL_TIME_FILTER = defaultTimeFilter();

export default function VoucherList() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { refreshKey, accounts, refresh } = useApp();
  const { can } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [filters, setFilters] = useState<VoucherFilters>({
    ...EMPTY_VOUCHER_FILTERS,
    startDate: INITIAL_TIME_FILTER.startDate,
    endDate: INITIAL_TIME_FILTER.endDate
  });
  const [draftFilters, setDraftFilters] = useState<VoucherFilters>({
    ...EMPTY_VOUCHER_FILTERS,
    startDate: INITIAL_TIME_FILTER.startDate,
    endDate: INITIAL_TIME_FILTER.endDate
  });
  const [timeFilter, setTimeFilter] = useState<VoucherTimeFilterState>(INITIAL_TIME_FILTER);
  const [viewId, setViewId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [showSubtotal, setShowSubtotal] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [total, setTotal] = useState(0);
  const { loading: listLoading, run: runListLoad } = useAsyncLoading(true);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const loadList = async (
    nextFilters: VoucherFilters = filters,
    nextPage = page,
    nextPageSize = pageSize
  ) => {
    await runListLoad(async () => {
      const result = await Voucher.listPage(nextFilters, { page: nextPage, pageSize: nextPageSize });
      setVouchers(result.list);
      setTotal(result.total);
      setPage(result.page);
      setPageSize(result.pageSize);
      setSelectedIds((prev) => prev.filter((id) => result.list.some((v) => v.id === id)));
    });
  };

  const handlePaginationChange = (nextPage: number, nextPageSize: number) => {
    void loadList(filters, nextPage, nextPageSize);
  };

  useEffect(() => {
    loadList();
  }, [refreshKey]);

  const applyFilters = (patch: Partial<VoucherFilters>, options: { closePanel?: boolean } = {}) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    setDraftFilters(next);
    loadList(next, 1, pageSize);
    if (options.closePanel) setFilterOpen(false);
  };

  const handleTimeQuery = (startDate: string, endDate: string) => {
    applyFilters({ startDate, endDate });
  };

  const handleFilterSearch = () => {
    applyFilters(
      {
        ...draftFilters,
        startDate: filters.startDate,
        endDate: filters.endDate
      },
      { closePanel: true }
    );
  };

  const handleFilterReset = () => {
    const next = {
      ...EMPTY_VOUCHER_FILTERS,
      startDate: filters.startDate,
      endDate: filters.endDate
    };
    setDraftFilters(next);
    setFilters(next);
    loadList(next, 1, pageSize);
  };

  const handleRefresh = () => {
    void loadList();
  };

  const handleExport = async (withAttachments = false) => {
    const list = await Voucher.getAll(filters);
    if (!list.length) {
      message.error('无数据可导出');
      return;
    }

    const loadingKey = 'voucher-export';
    message.loading({
      content: withAttachments ? '正在打包表格与附件…' : '正在导出表格…',
      key: loadingKey,
      duration: 0
    });
    try {
      const result = await ExportUtil.exportVouchersPackage(list, {
        withAttachments,
        onProgress: (done, total) => {
          if (!withAttachments || !total) return;
          message.loading({
            content: `正在下载附件 ${done}/${total}…`,
            key: loadingKey,
            duration: 0
          });
        }
      });
      await ErpApi.addAuditLog(
        '导出',
        withAttachments ? 'ZIP' : 'Excel',
        withAttachments
          ? `${result.voucherCount} 条凭证，附件 ${result.attachmentCount} 个${result.failed ? `，失败 ${result.failed}` : ''
          }`
          : `${result.voucherCount} 条凭证`
      );
      if (withAttachments) {
        message.success({
          content:
            `已导出 ZIP：表格 ${result.voucherCount} 条` +
            (result.attachmentCount ? `，附件 ${result.attachmentCount} 个` : '（无附件）') +
            (result.failed ? `，${result.failed} 个附件下载失败` : ''),
          key: loadingKey
        });
      } else {
        message.success({ content: 'Excel 导出成功', key: loadingKey });
      }
    } catch (err) {
      message.error({ content: (err as Error).message || '导出失败', key: loadingKey });
    }
  };

  const selectedDraftCount = selectedIds.filter((id) => {
    const voucher = vouchers.find((v) => v.id === id);
    return voucher?.status === Voucher.STATUS.DRAFT;
  }).length;

  const selectedApprovedCount = selectedIds.filter((id) => {
    const voucher = vouchers.find((v) => v.id === id);
    return voucher?.status === Voucher.STATUS.APPROVED && !isCarryForwardVoucher(voucher);
  }).length;

  const finishBatchAction = (
    result: { skipped: number; failed: { id: string; voucherNo?: string }[];[key: string]: unknown },
    { successKey, successLabel, skippedHint }: { successKey: string; successLabel: string; skippedHint: string }
  ) => {
    if (result[successKey]) {
      message.success(`已成功${successLabel} ${result[successKey]} 张凭证`);
    }
    if (result.skipped && !result[successKey] && !result.failed.length) {
      message.info(skippedHint);
    }
    if (result.failed.length) {
      const names = result.failed.map((item) => item.voucherNo).join('、');
      message.error(`${result.failed.length} 张操作失败：${names}`);
    }
    setSelectedIds(result.failed.map((item) => item.id));
    refresh();
  };

  const handleBatchApprove = () => {
    if (!selectedDraftCount) {
      message.warning('请先勾选要审核的草稿凭证');
      return;
    }

    modal.confirm({
      title: '批量审核',
      content: `确定将选中的 ${selectedDraftCount} 张草稿凭证审核通过？`,
      okText: `审核 ${selectedDraftCount} 张`,
      cancelText: '取消',
      onOk: async () => {
        const result = await Voucher.approveMany(selectedIds);
        finishBatchAction(result, {
          successKey: 'approved',
          successLabel: '审核',
          skippedHint: '所选凭证中没有可审核的草稿'
        });
      }
    });
  };

  const handleBatchUnapprove = () => {
    if (!selectedApprovedCount) {
      message.warning('请先勾选要反审核的已审核凭证');
      return;
    }

    modal.confirm({
      title: '批量反审核',
      content: `确定将选中的 ${selectedApprovedCount} 张已审核凭证改回草稿？`,
      okText: `反审核 ${selectedApprovedCount} 张`,
      cancelText: '取消',
      onOk: async () => {
        const result = await Voucher.unapproveMany(selectedIds);
        finishBatchAction(result, {
          successKey: 'unapproved',
          successLabel: '反审核',
          skippedHint: '所选凭证中没有可反审核的已审核凭证'
        });
      }
    });
  };

  return (
    <div className="page-table-layout">
      <div className="page-header">
        <Title level={2} style={{ margin: 0 }}>
          凭证管理
        </Title>
        {can('voucher.create') ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vouchers/new')}>
            新建凭证
          </Button>
        ) : null}
      </div>

      <div className="page-table-toolbar voucher-list-toolbar">
        <div className="voucher-list-toolbar__main">
          <VoucherTimeFilter
            value={timeFilter}
            onChange={setTimeFilter}
            onQuery={handleTimeQuery}
            filterOpen={filterOpen}
            onFilterOpenChange={(open) => {
              setFilterOpen(open);
              if (open) setDraftFilters(filters);
            }}
            activeFilterCount={activeFilterCount}
            filterContent={
              <VoucherFilterPanel
                value={draftFilters}
                onChange={setDraftFilters}
                onSearch={handleFilterSearch}
                onReset={handleFilterReset}
              />
            }
          />

          <Checkbox checked={showSubtotal} onChange={(e) => setShowSubtotal(e.target.checked)}>
            显示凭证金额小计
          </Checkbox>
        </div>

        <div className="voucher-list-toolbar__actions">
          <Space>
          </Space>
          <Space wrap>
            {can('voucher.approve') ? (
              <Dropdown.Button
                onClick={handleBatchApprove}
                menu={{
                  items: [{ key: 'unapprove', label: '反审核' }],
                  onClick: ({ key }) => {
                    if (key === 'unapprove') handleBatchUnapprove();
                  }
                }}
              >
                审核
              </Dropdown.Button>
            ) : null}
            {can('export') ? (
              <Dropdown.Button
                icon={<DownloadOutlined />}
                onClick={() => void handleExport(false)}
                menu={{
                  items: [
                    { key: 'export-csv', label: '仅导出表格（Excel）' },
                    { key: 'export-zip', label: '导出表格及所属期间附件（ZIP）' }
                  ],
                  onClick: ({ key }) => {
                    if (key === 'export-csv') void handleExport(false);
                    if (key === 'export-zip') void handleExport(true);
                  }
                }}
              >
                导出
              </Dropdown.Button>
            ) : null}
            {can('voucher.import') ? (
              <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
                导入历史凭证
              </Button>
            ) : null}
            <Button
              className="voucher-list-toolbar__refresh"
              icon={<ReloadOutlined />}
              loading={listLoading}
              onClick={handleRefresh}
            >
              刷新
            </Button>
          </Space>
        </div>
      </div>

      <div className="page-table-layout__table">
        <VoucherTable
          scrollable
          selectable
          serverPagination
          loading={listLoading}
          vouchers={vouchers}
          showSubtotal={showSubtotal}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onView={setViewId}
          pagination={{ current: page, pageSize, total }}
          onPaginationChange={handlePaginationChange}
        />
      </div>

      <VoucherDetailModal
        voucherId={viewId}
        open={!!viewId}
        onClose={() => setViewId(null)}
        onVoucherChange={setViewId}
        navigationIds={vouchers.map((v) => v.id)}
      />

      <VoucherImportModal
        open={importOpen}
        accounts={accounts}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          refresh();
        }}
      />
    </div>
  );
}
