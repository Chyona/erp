import { useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Space, Typography, App, Upload, Tooltip, Checkbox, Popover } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ScrollTable from './ScrollTable';
import { DeleteOutlined, EyeOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { enrichAttachmentDisplayNames, attachmentNameContextFromVoucher } from '../utils/attachmentName';
import { Voucher } from '../services/voucher';
import type { Attachment, Voucher as VoucherRecord } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isCarryForwardVoucher } from '../utils/carryForwardVoucher';
import StatusBadge from './StatusBadge';
import VoucherMoreActions from './VoucherMoreActions';
import VoucherAttachmentColumn from './VoucherAttachmentColumn';
import { confirmDeleteWithPassword } from '../utils/confirmDeleteWithPassword';

const { Link } = Typography;

function buildGroupedRows(vouchers, showSubtotal) {
  const rows = [];

  for (const voucher of vouchers) {
    const entries = voucher.entries || [];
    if (!entries.length) continue;

    const groupSpan = showSubtotal ? entries.length + 1 : entries.length;

    entries.forEach((entry, index) => {
      rows.push({
        key: `${voucher.id}-entry-${index}`,
        rowType: 'entry',
        voucher,
        entry,
        groupRowSpan: index === 0 ? groupSpan : 0
      });
    });

    if (showSubtotal) {
      rows.push({
        key: `${voucher.id}-subtotal`,
        rowType: 'subtotal',
        voucher,
        groupRowSpan: 0
      });
    }
  }

  return rows;
}

function formatAmount(value: number | string, voucher?: Pick<VoucherRecord, 'reversedFromId' | 'reversedFromNo' | 'remark' | 'entries'>) {
  const num = parseFloat(String(value));
  if (!num) return '';
  const text = num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (voucher && Voucher.isRedLetterVoucher(voucher)) {
    return <span className="voucher-amount--red">{text}</span>;
  }
  return text;
}

function mergeCell(rowSpan) {
  return rowSpan > 0 ? { rowSpan } : { rowSpan: 0 };
}

function renderMultilineText(value: string | undefined, splitPattern = /[,，、;\s]+/) {
  const parts = String(value || '')
    .split(splitPattern)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return (
    <span className="voucher-grouped-table__multiline">
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

export default function VoucherTable({
  vouchers,
  compact = false,
  scrollable = false,
  selectable = false,
  selectedIds = [],
  onSelectedIdsChange,
  onView,
  showSubtotal = true,
  loading = false
}: {
  vouchers: VoucherRecord[];
  compact?: boolean;
  scrollable?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onView: (id: string) => void;
  showSubtotal?: boolean;
  loading?: boolean;
}) {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { refresh } = useApp();
  const { canMutateVoucher, canAccessOwnVoucher, role } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [uploadingId, setUploadingId] = useState('');
  const [attachPanelVoucher, setAttachPanelVoucher] = useState<VoucherRecord | null>(null);
  const [attachPanelItems, setAttachPanelItems] = useState<Attachment[]>([]);
  const [attachPanelLoading, setAttachPanelLoading] = useState(false);
  const listUploadTailRef = useRef(new Map<string, Promise<void>>());
  const listUploadToastRef = useRef({ count: 0, timer: 0 as ReturnType<typeof setTimeout> | 0 });

  const noteListUploadSuccess = (count = 1) => {
    listUploadToastRef.current.count += count;
    if (listUploadToastRef.current.timer) {
      clearTimeout(listUploadToastRef.current.timer);
    }
    listUploadToastRef.current.timer = setTimeout(() => {
      const n = listUploadToastRef.current.count;
      listUploadToastRef.current.count = 0;
      listUploadToastRef.current.timer = 0;
      if (n > 0) {
        message.success(n > 1 ? `已上传 ${n} 个附件` : '附件上传成功');
      }
    }, 280);
  };

  useEffect(() => {
    setPage(1);
  }, [vouchers]);

  const pagedVouchers = useMemo(() => {
    if (compact) return vouchers;
    const start = (page - 1) * pageSize;
    return vouchers.slice(start, start + pageSize);
  }, [vouchers, page, pageSize, compact]);

  const groupedRows = useMemo(
    () => (compact ? [] : buildGroupedRows(pagedVouchers, showSubtotal)),
    [pagedVouchers, showSubtotal, compact]
  );

  const pageTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const voucher of pagedVouchers) {
      debit += voucher.totalDebit || 0;
      credit += voucher.totalCredit || 0;
    }
    return {
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100
    };
  }, [pagedVouchers]);

  const pageSelectableIds = useMemo(
    () =>
      pagedVouchers
        .filter(
          (v) =>
            canMutateVoucher(v) &&
            (v.status === Voucher.STATUS.DRAFT || v.status === Voucher.STATUS.APPROVED) &&
            !isCarryForwardVoucher(v)
        )
        .map((v) => v.id),
    [pagedVouchers, canMutateVoucher]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allPageSelectableSelected =
    pageSelectableIds.length > 0 && pageSelectableIds.every((id) => selectedSet.has(id));
  const somePageSelectableSelected =
    pageSelectableIds.some((id) => selectedSet.has(id)) && !allPageSelectableSelected;

  const toggleVoucherSelect = (voucherId, checked) => {
    if (!onSelectedIdsChange) return;
    if (checked) {
      onSelectedIdsChange([...selectedIds, voucherId]);
      return;
    }
    onSelectedIdsChange(selectedIds.filter((id) => id !== voucherId));
  };

  const toggleSelectAllPage = (checked) => {
    if (!onSelectedIdsChange) return;
    if (checked) {
      const merged = new Set([...selectedIds, ...pageSelectableIds]);
      onSelectedIdsChange([...merged]);
      return;
    }
    const pageSelectableSet = new Set(pageSelectableIds);
    onSelectedIdsChange(selectedIds.filter((id) => !pageSelectableSet.has(id)));
  };

  const notifyDataChanged = () => {
    refresh();
  };

  const requestDeleteVoucher = (voucher, force = false) => {
    confirmDeleteWithPassword({
      modal,
      isAdmin: role === 'admin',
      title: force ? '确定强制删除已结项凭证？' : '确定删除该凭证？',
      content: `凭证 ${voucher.voucherNo} 及关联附件删除后不可恢复。`,
      okText: force ? '强制删除' : '确定删除',
      onConfirm: async (confirmPassword) => {
        if (force) {
          await Voucher.forceRemove(voucher.id, { confirmPassword });
        } else {
          await Voucher.remove(voucher.id, { confirmPassword });
        }
        message.success('凭证已删除');
        notifyDataChanged();
      }
    });
  };
  const openVoucherPage = (voucher) => {
    if (!canAccessOwnVoucher(voucher)) return;
    // 已结项只能看详情弹窗（编辑页会拦截）
    if (voucher.status === Voucher.STATUS.LOCKED || isCarryForwardVoucher(voucher)) {
      onView?.(voucher.id);
      return;
    }
    navigate(`/vouchers/${voucher.id}/edit`);
  };

  const canOpenVoucherLink = (voucher) => canAccessOwnVoucher(voucher);

  const renderActions = (voucher) => {
    const mutable = canMutateVoucher(voucher) && !isCarryForwardVoucher(voucher);
    return (
      <Space size={0} direction="vertical" align="center" className="voucher-grouped-table__actions">
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          title="查看"
          onClick={() => onView?.(voucher.id)}
        />
        {mutable ? (
          voucher.status === 'locked' ? (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="强制删除"
              onClick={() => requestDeleteVoucher(voucher, true)}
            />
          ) : (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              title="删除"
              onClick={() => requestDeleteVoucher(voucher, false)}
            />
          )
        ) : null}
        {mutable ? <VoucherMoreActions voucher={voucher} /> : null}
      </Space>
    );
  };

  const attachPanelVoucherRef = useRef(attachPanelVoucher);
  attachPanelVoucherRef.current = attachPanelVoucher;

  const handleListUpload = (
    voucher: VoucherRecord,
    option: Parameters<NonNullable<import('antd/es/upload/interface').UploadProps['customRequest']>>[0]
  ) => {
    const file = option.file as File;
    const prev = listUploadTailRef.current.get(voucher.id) || Promise.resolve();
    const job = prev
      .catch(() => undefined)
      .then(async () => {
        setUploadingId(voucher.id);
        try {
          const updated = await Voucher.addAttachmentToVoucher(voucher.id, file);
          option.onSuccess?.({});
          noteListUploadSuccess(1);
          if (attachPanelVoucherRef.current?.id === voucher.id) {
            await loadAttachPanel(updated);
          }
          notifyDataChanged();
        } catch (err) {
          message.error((err as Error).message || '附件上传失败');
          option.onError?.(err as Error);
        } finally {
          setUploadingId((cur) => (cur === voucher.id ? '' : cur));
        }
      });
    listUploadTailRef.current.set(
      voucher.id,
      job.then(
        () => undefined,
        () => undefined
      )
    );
  };

  const loadAttachPanel = async (voucher: VoucherRecord) => {
    setAttachPanelLoading(true);
    try {
      const latest = (await Voucher.getById(voucher.id)) || voucher;
      const ids = latest.attachmentIds?.length
        ? latest.attachmentIds
        : voucher.attachmentIds || [];
      const atts: Attachment[] = [];
      for (const attId of ids) {
        try {
          const att = await Voucher.getAttachment(attId);
          if (att) atts.push(att);
        } catch {
          // 单条失败不阻断其余附件
        }
      }
      setAttachPanelVoucher(latest);
      setAttachPanelItems(
        enrichAttachmentDisplayNames(attachmentNameContextFromVoucher(latest), atts)
      );
      if (!atts.length) {
        message.warning('未找到附件文件，请重新上传');
        setAttachPanelVoucher(null);
      }
    } catch (err) {
      message.error((err as Error).message || '加载附件失败');
      setAttachPanelVoucher(null);
      setAttachPanelItems([]);
    } finally {
      setAttachPanelLoading(false);
    }
  };

  const openAttachPanel = (voucher: VoucherRecord) => {
    setAttachPanelVoucher(voucher);
    setAttachPanelItems([]);
    void loadAttachPanel(voucher);
  };

  const closeAttachPanel = () => {
    setAttachPanelVoucher(null);
    setAttachPanelItems([]);
  };

  // 点击面板外空白、滚动表格时自动关闭附件浮层
  useEffect(() => {
    if (!attachPanelVoucher) return;

    const isInsideAttachUi = (node: EventTarget | null) => {
      if (!(node instanceof Element)) return false;
      return Boolean(
        node.closest('.voucher-list-attach-popover') ||
        node.closest('.voucher-grouped-table__attach-count') ||
        node.closest('.ant-popconfirm') ||
        node.closest('.ant-modal-root') ||
        node.closest('.ant-image-preview')
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      if (isInsideAttachUi(e.target)) return;
      closeAttachPanel();
    };

    const onScroll = (e: Event) => {
      const target = e.target;
      if (target instanceof Element && target.closest('.voucher-list-attach-popover')) {
        return;
      }
      closeAttachPanel();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [attachPanelVoucher]);

  const toggleAttachPanel = (voucher: VoucherRecord) => {
    if (attachPanelVoucher?.id === voucher.id) {
      closeAttachPanel();
      return;
    }
    openAttachPanel(voucher);
  };

  const handlePanelRemove = async (index: number) => {
    if (!attachPanelVoucher) return;
    const att = attachPanelItems[index];
    if (!att) return;
    try {
      const updated = await Voucher.removeAttachmentsFromVoucher(attachPanelVoucher.id, [att.id]);
      message.success('附件已删除');
      const next = attachPanelItems.filter((_, i) => i !== index);
      setAttachPanelItems(next);
      setAttachPanelVoucher(updated);
      if (!next.length) closeAttachPanel();
      notifyDataChanged();
    } catch (err) {
      message.error((err as Error).message || '删除附件失败');
    }
  };

  const handlePanelRemoveMany = async (indices: number[]) => {
    if (!attachPanelVoucher || !indices?.length) return;
    const ids = indices
      .map((i) => attachPanelItems[i]?.id)
      .filter(Boolean) as string[];
    if (!ids.length) return;
    try {
      const updated = await Voucher.removeAttachmentsFromVoucher(attachPanelVoucher.id, ids);
      message.success(`已删除 ${ids.length} 个附件`);
      const removeSet = new Set(ids);
      const next = attachPanelItems.filter((att) => !removeSet.has(att.id));
      setAttachPanelItems(next);
      setAttachPanelVoucher(updated);
      if (!next.length) closeAttachPanel();
      notifyDataChanged();
    } catch (err) {
      message.error((err as Error).message || '批量删除失败');
    }
  };

  const handlePanelUpload = async (option: Parameters<NonNullable<import('antd/es/upload/interface').UploadProps['customRequest']>>[0]) => {
    if (!attachPanelVoucher) return;
    await handleListUpload(attachPanelVoucher, option);
  };

  const renderAttachPanelContent = (voucher: VoucherRecord) => {
    if (attachPanelLoading && !attachPanelItems.length) {
      return <div className="voucher-list-attach-popover__loading">加载中…</div>;
    }
    if (!attachPanelItems.length) {
      return <div className="voucher-list-attach-popover__loading">暂无附件</div>;
    }
    return (
      <VoucherAttachmentColumn
        attachments={attachPanelItems}
        open
        onClose={closeAttachPanel}
        onRemove={handlePanelRemove}
        onRemoveMany={handlePanelRemoveMany}
        onUpload={handlePanelUpload}
        canModify={
          canMutateVoucher(voucher) && Voucher.canModifyAttachments(voucher.status)
        }
      />
    );
  };

  const renderAttachments = (voucher) => {
    const count = (voucher.attachmentIds || []).length;
    const editable =
      canMutateVoucher(voucher) && Voucher.canModifyAttachments(voucher.status);
    const panelOpen = attachPanelVoucher?.id === voucher.id;

    const uploadLink = editable ? (
      <Upload
        showUploadList={false}
        multiple
        accept="image/*,.pdf"
        customRequest={(options) => handleListUpload(voucher, options)}
      >
        <Button
          type="link"
          size="small"
          icon={<PaperClipOutlined />}
          loading={uploadingId === voucher.id}
          className="voucher-grouped-table__upload"
          title="可一次选择多个文件"
        >
          上传附件
        </Button>
      </Upload>
    ) : (
      <Tooltip title={Voucher.ATTACHMENT_READONLY_TIP}>
        <Button
          type="link"
          size="small"
          icon={<PaperClipOutlined />}
          disabled
          className="voucher-grouped-table__upload voucher-grouped-table__upload--disabled"
        >
          上传附件
        </Button>
      </Tooltip>
    );

    return (
      <Space size={2} direction="vertical" className="voucher-grouped-table__attach">
        {count > 0 && (
          <Popover
            open={panelOpen}
            trigger={[]}
            placement="leftTop"
            arrow={{ pointAtCenter: true }}
            getPopupContainer={() => document.body}
            zIndex={1100}
            classNames={{ root: 'voucher-list-attach-popover' }}
            content={renderAttachPanelContent(voucher)}
          >
            <Button
              type="link"
              size="small"
              className="voucher-grouped-table__attach-count"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleAttachPanel(voucher);
              }}
            >
              {count} 张
            </Button>
          </Popover>
        )}
        {uploadLink}
      </Space>
    );
  };

  const groupedColumns = [
    ...(selectable
      ? [
        {
          title: (
            <Checkbox
              indeterminate={somePageSelectableSelected}
              checked={allPageSelectableSelected}
              disabled={!pageSelectableIds.length}
              onChange={(e) => toggleSelectAllPage(e.target.checked)}
            />
          ),
          key: 'select',
          width: 40,
          align: 'center',
          fixed: 'left',
          onCell: (record) => mergeCell(record.groupRowSpan),
          render: (_, record) => {
            const voucher = record.voucher;
            const rowSelectable =
              (voucher.status === Voucher.STATUS.DRAFT ||
                voucher.status === Voucher.STATUS.APPROVED) &&
              !isCarryForwardVoucher(voucher);
            return (
              <Checkbox
                checked={selectedSet.has(voucher.id)}
                disabled={!rowSelectable}
                onChange={(e) => toggleVoucherSelect(voucher.id, e.target.checked)}
              />
            );
          }
        }
      ]
      : []),
    {
      title: '凭证字号',
      key: 'voucherNo',
      width: 90,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) =>
        canOpenVoucherLink(record.voucher) ? (
          <Link onClick={() => openVoucherPage(record.voucher)}>{record.voucher.voucherNo}</Link>
        ) : (
          record.voucher.voucherNo
        )
    },
    {
      title: '日期',
      dataIndex: ['voucher', 'date'],
      width: 110,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => record.voucher.date
    },
    {
      title: '摘要',
      key: 'summary',
      ellipsis: true,
      render: (_, record) =>
        record.rowType === 'subtotal' ? (
          <span className="voucher-grouped-table__subtotal-label">金额小计</span>
        ) : (
          record.entry.summary
        )
    },
    {
      title: '科目',
      key: 'account',
      width: 140,
      ellipsis: true,
      render: (_, record) => {
        if (record.rowType === 'subtotal') return '';
        const { accountCode, accountName } = record.entry;
        return accountCode ? `${accountCode} ${accountName || ''}`.trim() : '';
      }
    },
    {
      title: '借方金额',
      key: 'debit',
      width: 110,
      align: 'right',
      render: (_, record) =>
        record.rowType === 'subtotal'
          ? formatAmount(record.voucher.totalDebit, record.voucher)
          : formatAmount(record.entry.debit, record.voucher)
    },
    {
      title: '贷方金额',
      key: 'credit',
      width: 110,
      align: 'right',
      render: (_, record) =>
        record.rowType === 'subtotal'
          ? formatAmount(record.voucher.totalCredit, record.voucher)
          : formatAmount(record.entry.credit, record.voucher)
    },
    {
      title: '备注',
      key: 'remark',
      ellipsis: true,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => (
        <span className="voucher-grouped-table__multiline">{record.voucher.remark || ''}</span>
      )
    },
    {
      title: '附件',
      key: 'attachments',
      width: 90,
      align: 'center',
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => renderAttachments(record.voucher)
    },
    {
      title: '发票号',
      key: 'invoiceNumbers',
      width: 160,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => renderMultilineText(record.voucher.invoiceNumbers)
    },
    {
      title: '制单人',
      key: 'preparedBy',
      width: 80,
      ellipsis: true,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => record.voucher.preparedBy || ''
    },
    {
      title: '审核人',
      key: 'reviewedBy',
      width: 80,
      ellipsis: true,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => record.voucher.reviewedBy || ''
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => (
        <StatusBadge status={record.voucher.status} voucher={record.voucher} />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 60,
      align: 'center',
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => renderActions(record.voucher)
    }
  ];

  const compactColumns = [
    { title: '凭证字号', dataIndex: 'voucherNo', width: 120 },
    { title: '日期', dataIndex: 'date', width: 110 },
    {
      title: '摘要',
      key: 'summary',
      ellipsis: true,
      render: (_, record) => record.entries?.[0]?.summary || ''
    },
    {
      title: '金额',
      dataIndex: 'totalDebit',
      width: 120,
      align: 'right',
      render: (v) => v?.toFixed(2)
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 148,
      render: (status, record) => <StatusBadge status={status} voucher={record} />
    }
  ];

  if (compact) {
    return (
      <Table
        rowKey="id"
        loading={loading}
        columns={compactColumns as ColumnsType<any>}
        dataSource={vouchers}
        pagination={false}
        locale={{ emptyText: '暂无凭证数据' }}
        size="middle"
      />
    );
  }

  const tableProps = {
    className: 'voucher-grouped-table',
    rowKey: 'key',
    loading,
    columns: groupedColumns as ColumnsType<any>,
    dataSource: groupedRows,
    pagination: {
      current: page,
      pageSize,
      total: vouchers.length,
      showSizeChanger: true,
      pageSizeOptions: [10, 20, 50, 100],
      showTotal: (total) => `共 ${total} 张凭证`,
      onChange: (nextPage, nextSize) => {
        setPage(nextPage);
        setPageSize(nextSize);
      }
    },
    rowClassName: (record) =>
      record.rowType === 'subtotal' ? 'voucher-grouped-table__row--subtotal' : '',
    locale: { emptyText: '暂无凭证数据' },
    size: 'small',
    bordered: true,
    summary: () =>
      groupedRows.length ? (
        <Table.Summary fixed>
          <Table.Summary.Row className="voucher-grouped-table__row--total">
            <Table.Summary.Cell index={0} colSpan={selectable ? 5 : 4} align="center">
              合计
            </Table.Summary.Cell>
            <Table.Summary.Cell index={selectable ? 5 : 4} align="right">
              {formatAmount(pageTotals.debit)}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={selectable ? 6 : 5} align="right">
              {formatAmount(pageTotals.credit)}
            </Table.Summary.Cell>
            <Table.Summary.Cell index={selectable ? 7 : 6} colSpan={selectable ? 8 : 7} />
          </Table.Summary.Row>
        </Table.Summary>
      ) : null
  };

  if (scrollable) {
    return (
      <ScrollTable
        {...(tableProps as Record<string, unknown>)}
        scroll={{ x: selectable ? 1630 : 1590 }}
      />
    );
  }

  return <Table {...(tableProps as Record<string, unknown>)} />;
}
