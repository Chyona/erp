import { useEffect, useState } from 'react';
import { Button, Checkbox, DatePicker, Dropdown, Input, Select, Space, Typography, App } from 'antd';
import { PlusOutlined, SearchOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Voucher } from '../services/voucher';
import { ExportUtil } from '../services/export';
import { DB } from '../services/db';
import VoucherTable from '../components/VoucherTable';
import VoucherDetailModal from '../components/VoucherDetailModal';
import VoucherImportModal from '../components/VoucherImportModal';
import { useApp } from '../context/AppContext';
import { confirmDanger } from '../utils/confirmAction';

const { Title } = Typography;
const { RangePicker } = DatePicker;

export default function VoucherList() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { refreshKey, accounts, refresh } = useApp();
  const [vouchers, setVouchers] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    keyword: ''
  });
  const [dateRange, setDateRange] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [showSubtotal, setShowSubtotal] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  const loadList = async (nextFilters = filters) => {
    const list = await Voucher.getAll(nextFilters);
    setVouchers(list);
    setSelectedIds((prev) => prev.filter((id) => list.some((v) => v.id === id)));
  };

  useEffect(() => {
    loadList();
  }, [refreshKey]);

  const applyFilters = (patch) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    loadList(next);
  };

  const handleSearch = () => {
    loadList();
  };

  const handleExport = async () => {
    const list = await Voucher.getAll(filters);
    if (!list.length) {
      message.error('无数据可导出');
      return;
    }
    const csv = ExportUtil.vouchersToCSV(list);
    ExportUtil.downloadBlob(
      csv,
      `凭证导出_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8'
    );
    await DB.addAuditLog('导出', 'CSV', `${list.length} 条凭证`);
    message.success('CSV 导出成功');
  };

  const selectedDraftCount = selectedIds.filter((id) => {
    const voucher = vouchers.find((v) => v.id === id);
    return voucher?.status === Voucher.STATUS.DRAFT;
  }).length;

  const selectedApprovedCount = selectedIds.filter((id) => {
    const voucher = vouchers.find((v) => v.id === id);
    return voucher?.status === Voucher.STATUS.APPROVED;
  }).length;

  const finishBatchAction = (result, { successKey, successLabel, skippedHint }) => {
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
    loadList();
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

  const handleRemoveUnlocked = async () => {
    const all = await Voucher.getAll();
    const unlocked = all.filter((v) => v.status !== Voucher.STATUS.LOCKED);
    const lockedCount = all.length - unlocked.length;

    if (!unlocked.length) {
      message.info('当前没有可删除的未锁定凭证');
      return;
    }

    const ok = await confirmDanger(modal, {
      title: '确定删除全部未锁定凭证？',
      content: `将永久删除 ${unlocked.length} 张凭证（草稿/已审核）及其附件，此操作不可恢复。${
        lockedCount ? `已锁定 ${lockedCount} 张将保留。` : ''
      }`,
      okText: `删除 ${unlocked.length} 张`
    });
    if (!ok) return;

    const result = await Voucher.removeAllUnlocked();
    message.success(`已删除 ${result.deleted} 张未锁定凭证`);
    refresh();
    loadList();
  };

  return (
    <div className="page-table-layout">
      <div className="page-header">
        <Title level={2} style={{ margin: 0 }}>
          凭证管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/vouchers/new')}>
          新建凭证
        </Button>
      </div>

      <div className="page-table-toolbar">
        <Space wrap>
        <RangePicker
          value={dateRange}
          onChange={(dates) => {
            setDateRange(dates);
            applyFilters({
              startDate: dates?.[0] ? dates[0].format('YYYY-MM-DD') : '',
              endDate: dates?.[1] ? dates[1].format('YYYY-MM-DD') : ''
            });
          }}
        />
        <Select
          placeholder="全部状态"
          allowClear
          style={{ width: 120 }}
          value={filters.status || undefined}
          onChange={(v) => applyFilters({ status: v || '' })}
          options={[
            { value: 'draft', label: '草稿' },
            { value: 'approved', label: '已审核' },
            { value: 'locked', label: '已锁定' }
          ]}
        />
        <Input
          placeholder="搜索摘要/凭证号/科目"
          style={{ width: 200 }}
          value={filters.keyword}
          onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
          onPressEnter={handleSearch}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
          查询
        </Button>
        <Checkbox checked={showSubtotal} onChange={(e) => setShowSubtotal(e.target.checked)}>
          显示凭证金额小计
        </Checkbox>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          导出 CSV
        </Button>
        <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
          导入历史凭证
        </Button>
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
        <Button danger icon={<DeleteOutlined />} onClick={handleRemoveUnlocked}>
          删除未锁定凭证
        </Button>
        </Space>
      </div>

      <VoucherTable
        scrollable
        selectable
        vouchers={vouchers}
        showSubtotal={showSubtotal}
        selectedIds={selectedIds}
        onSelectedIdsChange={setSelectedIds}
        onView={setViewId}
        onRefresh={loadList}
      />

      <VoucherDetailModal
        voucherId={viewId}
        open={!!viewId}
        onClose={() => setViewId(null)}
        onLocked={loadList}
        onDeleted={loadList}
      />

      <VoucherImportModal
        open={importOpen}
        accounts={accounts}
        onClose={() => setImportOpen(false)}
        onSuccess={() => {
          refresh();
          loadList();
        }}
      />
    </div>
  );
}