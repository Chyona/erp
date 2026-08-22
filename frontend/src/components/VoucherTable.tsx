import { useEffect, useMemo, useRef, useState } from 'react';
import { Table, Button, Space, Typography, App, Popconfirm, Upload, Tooltip, Checkbox, Popover } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ScrollTable from './ScrollTable';
import { DeleteOutlined, EyeOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Voucher } from '../services/voucher';
import type { Attachment, Voucher as VoucherRecord } from '../types';
import { useApp } from '../context/AppContext';
import { isCarryForwardVoucher } from '../utils/carryForwardVoucher';
import StatusBadge from './StatusBadge';
import VoucherMoreActions from './VoucherMoreActions';
import VoucherAttachmentColumn from './VoucherAttachmentColumn';

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

export default function VoucherTable({
  vouchers,
  compact = false,
  scrollable = false,
  selectable = false,
  selectedIds = [],
  onSelectedIdsChange,
  onView,
  onRefresh,
  showSubtotal = true
}: {
  vouchers: VoucherRecord[];
  compact?: boolean;
  scrollable?: boolean;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onView: (id: string) => void;
  onRefresh: () => void | Promise<void>;
  showSubtotal?: boolean;
}) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { refresh } = useApp();
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
            (v.status === Voucher.STATUS.DRAFT || v.status === Voucher.STATUS.APPROVED) &&
            !isCarryForwardVoucher(v)
        )
        .map((v) => v.id),
    [pagedVouchers]
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
    onRefresh?.();
  };

  const openVoucher = (voucher) => {
    if (voucher.status === Voucher.STATUS.LOCKED || isCarryForwardVoucher(voucher)) {
      onView?.(voucher.id);
      return;
    }
    navigate(`/vouchers/${voucher.id}/edit`);
  };

  const renderActions = (voucher) => (
    <Space size={0} direction="vertical" align="center" className="voucher-grouped-table__actions">
      <Button
        type="text"
        size="small"
        icon={<EyeOutlined />}
        title="查看"
        onClick={() => onView?.(voucher.id)}
      />
      {!isCarryForwardVoucher(voucher) &&
        (voucher.status === 'locked' ? (
          <Popconfirm
            title="确定强制删除已结项凭证？"
            description={`凭证 ${voucher.voucherNo} 及关联附件删除后不可恢复。`}
            okText="强制删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await Voucher.forceRemove(voucher.id);
                message.success('凭证已删除');
                notifyDataChanged();
              } catch (err) {
                message.error(err.message);
              }
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="强制删除" />
          </Popconfirm>
        ) : (
          <Popconfirm
            title="确定删除该凭证？"
            description={`凭证 ${voucher.voucherNo} 及关联附件删除后不可恢复。`}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                await Voucher.remove(voucher.id);
                message.success('凭证已删除');
                notifyDataChanged();
              } catch (err) {
                message.error(err.message);
              }
            }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        ))}
      {!isCarryForwardVoucher(voucher) ? (
        <VoucherMoreActions voucher={voucher} onRefresh={onRefresh} />
      ) : null}
    </Space>
  );

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
      setAttachPanelItems(atts);
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
        canModify={Voucher.canModifyAttachments(voucher.status)}
      />
    );
  };

  const renderAttachments = (voucher) => {
    const count = (voucher.attachmentIds || []).length;
    const editable = Voucher.canModifyAttachments(voucher.status);
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
            overlayClassName="voucher-list-attach-popover"
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
      title: '日期',
      dataIndex: ['voucher', 'date'],
      width: 108,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => record.voucher.date
    },
    {
      title: '凭证字号',
      key: 'voucherNo',
      width: 118,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => (
        <Link onClick={() => openVoucher(record.voucher)}>{record.voucher.voucherNo}</Link>
      )
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
      width: 220,
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
      width: 112,
      align: 'right',
      render: (_, record) =>
        record.rowType === 'subtotal'
          ? formatAmount(record.voucher.totalDebit, record.voucher)
          : formatAmount(record.entry.debit, record.voucher)
    },
    {
      title: '贷方金额',
      key: 'credit',
      width: 112,
      align: 'right',
      render: (_, record) =>
        record.rowType === 'subtotal'
          ? formatAmount(record.voucher.totalCredit, record.voucher)
          : formatAmount(record.entry.credit, record.voucher)
    },
    {
      title: '附件',
      key: 'attachments',
      width: 108,
      align: 'center',
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => renderAttachments(record.voucher)
    },
    {
      title: '制单人',
      key: 'preparedBy',
      width: 88,
      ellipsis: true,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => record.voucher.preparedBy || ''
    },
    {
      title: '审核人',
      key: 'reviewedBy',
      width: 88,
      ellipsis: true,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => record.voucher.reviewedBy || ''
    },
    {
      title: '状态',
      key: 'status',
      width: 148,
      onCell: (record) => mergeCell(record.groupRowSpan),
      render: (_, record) => (
        <StatusBadge status={record.voucher.status} voucher={record.voucher} />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 56,
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
            <Table.Summary.Cell index={selectable ? 7 : 6} colSpan={4} />
          </Table.Summary.Row>
        </Table.Summary>
      ) : null
  };

  if (scrollable) {
    return (
      <ScrollTable
        {...(tableProps as Record<string, unknown>)}
        scroll={{ x: selectable ? 1330 : 1290 }}
      />
    );
  }

  return <Table {...(tableProps as Record<string, unknown>)} />;
}
