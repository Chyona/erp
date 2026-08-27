import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Table, Button, Space, Typography, App, Upload, Tooltip, Checkbox, Popover, Pagination, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import ScrollTable from './ScrollTable';
import AppTable from './AppTable';
import EllipsisText from './EllipsisText';
import SensitiveColumnHeader from './SensitiveColumnHeader';
import { DeleteOutlined, EyeOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useVoucherPageNavigation } from '../hooks/useVoucherPageNavigation';
import { enrichAttachmentDisplayNames, attachmentNameContextFromVoucher } from '../utils/attachmentName';
import { readInvoiceRecognizeOnUpload } from '../hooks/useInvoiceRecognizeOnUpload';
import { Voucher } from '../services/voucher';
import type { Attachment, Voucher as VoucherRecord } from '../types';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isCarryForwardVoucher } from '../utils/carryForwardVoucher';
import StatusBadge from './StatusBadge';
import VoucherMoreActions from './VoucherMoreActions';
import VoucherAttachmentColumn from './VoucherAttachmentColumn';
import { confirmDeleteWithPassword } from '../utils/confirmDeleteWithPassword';
import { isAttachmentDuplicateError } from '../utils/attachmentDuplicate';
import { useOperatorDisplayLookup } from '../hooks/useOperatorDisplayLookup';
import { normalizeTableColumns } from '../utils/normalizeTableColumns';
import { resolveOperatorDisplayName } from '../utils/operatorDisplayName';
import { formatSensitiveText } from '../utils/maskSensitiveText';

const { Link } = Typography;

const VOUCHER_LIST_SCROLL_MIN_SELECTABLE = 1676;
const VOUCHER_LIST_SCROLL_MIN = 1636;
const VOUCHER_LIST_FIXED_LEFT_SPAN_SELECTABLE = 3;
const VOUCHER_LIST_FIXED_LEFT_SPAN = 2;

function formatTotalAmount(value: number) {
  const num = parseFloat(String(value));
  if (!num) return '';
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderVoucherTotalsSummaryRow(
  selectable: boolean,
  debit: number,
  credit: number
) {
  const fixedLeftSpan = selectable
    ? VOUCHER_LIST_FIXED_LEFT_SPAN_SELECTABLE
    : VOUCHER_LIST_FIXED_LEFT_SPAN;
  const base = fixedLeftSpan;
  const lastIdx = selectable ? 13 : 12;

  return (
    <Table.Summary.Row className="voucher-grouped-table__row--total">
      <Table.Summary.Cell index={0} colSpan={fixedLeftSpan} align="center">
        合计
      </Table.Summary.Cell>
      <Table.Summary.Cell index={base} />
      <Table.Summary.Cell index={base + 1} />
      <Table.Summary.Cell index={base + 2} align="right">
        {formatTotalAmount(debit)}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={base + 3} align="right">
        {formatTotalAmount(credit)}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={base + 4} />
      <Table.Summary.Cell index={base + 5} />
      <Table.Summary.Cell index={base + 6} />
      <Table.Summary.Cell index={base + 7} />
      <Table.Summary.Cell index={base + 8} />
      <Table.Summary.Cell index={base + 9} />
      <Table.Summary.Cell index={lastIdx} className="voucher-grouped-table__total-tail" />
    </Table.Summary.Row>
  );
}

function buildGroupedRows(vouchers, showSubtotal) {
  const rows = [];
  let groupIndex = 0;

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
        groupRowSpan: index === 0 ? groupSpan : 0,
        groupIndex
      });
    });

    if (showSubtotal) {
      rows.push({
        key: `${voucher.id}-subtotal`,
        rowType: 'subtotal',
        voucher,
        groupRowSpan: 0,
        groupIndex
      });
    }

    groupIndex += 1;
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

const VOUCHER_LIST_EMPTY_ROW = { key: '__voucher_list_empty__', rowType: 'empty' as const };

const VOUCHER_MIDDLE_COLUMN_KEYS = new Set([
  'summary',
  'account',
  'debit',
  'credit',
  'remark',
  'attachments',
  'invoiceNumbers',
  'preparedBy',
  'reviewedBy',
  'status'
]);

function isEmptyPlaceholderRow(record: { rowType?: string } | null | undefined) {
  return record?.rowType === 'empty';
}

function emptyPlaceholderCell(colKey: string) {
  if (colKey === 'summary') {
    return { colSpan: VOUCHER_MIDDLE_COLUMN_KEYS.size };
  }
  if (VOUCHER_MIDDLE_COLUMN_KEYS.has(colKey) && colKey !== 'summary') {
    return { colSpan: 0 };
  }
  return {};
}

function resolveCellProps(
  record: { rowType?: string; groupRowSpan?: number },
  colKey: string,
  mergeGroup = false
) {
  if (isEmptyPlaceholderRow(record)) {
    return emptyPlaceholderCell(colKey);
  }
  if (mergeGroup) {
    return mergeCell(record.groupRowSpan);
  }
  return {};
}

function renderEmptyPlaceholder() {
  return (
    <div className="app-table-empty">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无凭证数据" />
    </div>
  );
}

function renderMultilineText(value: string | undefined, splitPattern = /[,，、;\s]+/) {
  const parts = String(value || '')
    .split(splitPattern)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  const text = parts.join('、');
  if (parts.length === 1) {
    return (
      <EllipsisText className="voucher-grouped-table__invoice-numbers" tooltip={text}>
        {parts[0]}
      </EllipsisText>
    );
  }
  return (
    <span className="voucher-grouped-table__invoice-numbers">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="voucher-grouped-table__invoice-numbers-line">
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
  serverPagination = false,
  selectedIds = [],
  onSelectedIdsChange,
  onView,
  showSubtotal = true,
  loading = false,
  pagination: paginationProp,
  onPaginationChange
}: {
  vouchers: VoucherRecord[];
  compact?: boolean;
  scrollable?: boolean;
  selectable?: boolean;
  serverPagination?: boolean;
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onView: (id: string) => void;
  showSubtotal?: boolean;
  loading?: boolean;
  pagination?: { current: number; pageSize: number; total: number };
  onPaginationChange?: (page: number, pageSize: number) => void;
}) {
  const { openVoucherEdit } = useVoucherPageNavigation();
  const { message, modal } = App.useApp();
  const { refresh } = useApp();
  const { canMutateVoucher, canAccessOwnVoucher, role } = useAuth();
  const operatorLookup = useOperatorDisplayLookup();
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(100);
  const page = paginationProp?.current ?? internalPage;
  const pageSize = paginationProp?.pageSize ?? internalPageSize;
  const total = paginationProp?.total ?? vouchers.length;
  const useServerPagination = serverPagination && Boolean(paginationProp && onPaginationChange);
  const [uploadingId, setUploadingId] = useState('');
  const [attachPanelVoucher, setAttachPanelVoucher] = useState<VoucherRecord | null>(null);
  const [attachPanelItems, setAttachPanelItems] = useState<Attachment[]>([]);
  const [attachPanelLoading, setAttachPanelLoading] = useState(false);
  const [showPreparedByPlain, setShowPreparedByPlain] = useState(false);
  const [showReviewedByPlain, setShowReviewedByPlain] = useState(false);
  const listUploadTailRef = useRef(new Map<string, Promise<void>>());
  const listUploadToastRef = useRef({
    count: 0,
    recognized: [] as string[],
    timer: 0 as ReturnType<typeof setTimeout> | 0
  });

  const noteListUploadSuccess = (recognized: string[] = []) => {
    listUploadToastRef.current.count += 1;
    if (recognized.length) {
      listUploadToastRef.current.recognized.push(...recognized);
    }
    if (listUploadToastRef.current.timer) {
      clearTimeout(listUploadToastRef.current.timer);
    }
    listUploadToastRef.current.timer = setTimeout(() => {
      const n = listUploadToastRef.current.count;
      const nums = [...new Set(listUploadToastRef.current.recognized)];
      listUploadToastRef.current.count = 0;
      listUploadToastRef.current.recognized = [];
      listUploadToastRef.current.timer = 0;
      if (n <= 0) return;
      if (nums.length > 0) {
        message.success(
          n > 1
            ? `已上传 ${n} 个附件，已识别发票号 ${nums.join(', ')}`
            : `附件上传成功，已识别发票号 ${nums.join(', ')}`
        );
        return;
      }
      message.success(n > 1 ? `已上传 ${n} 个附件` : '附件上传成功');
    }, 280);
  };

  useEffect(() => {
    if (!useServerPagination) {
      setInternalPage(1);
    }
  }, [vouchers, useServerPagination]);

  const pagedVouchers = useMemo(() => {
    if (compact || useServerPagination) return vouchers;
    const start = (page - 1) * pageSize;
    return vouchers.slice(start, start + pageSize);
  }, [vouchers, page, pageSize, compact, useServerPagination]);

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
    openVoucherEdit(voucher.id);
  };

  const canOpenVoucherLink = (voucher) => canAccessOwnVoucher(voucher);

  const renderActions = (voucher) => {
    const mutable = canMutateVoucher(voucher) && !isCarryForwardVoucher(voucher);
    return (
      <Space size={0} align="center" wrap={false} className="voucher-grouped-table__actions">
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
          const { voucher: updated, recognizedInvoiceNumbers } = await Voucher.addAttachmentToVoucher(
            voucher.id,
            file,
            { recognizeInvoice: readInvoiceRecognizeOnUpload() }
          );
          option.onSuccess?.({});
          noteListUploadSuccess(recognizedInvoiceNumbers);
          if (attachPanelVoucherRef.current?.id === voucher.id) {
            await loadAttachPanel(updated);
          }
          notifyDataChanged();
        } catch (err) {
          if (isAttachmentDuplicateError(err)) {
            message.warning(err.message);
            option.onSuccess?.({});
            return;
          }
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
      <Space size={4} align="center" wrap={false} className="voucher-grouped-table__attach">
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
          onCell: (record) => resolveCellProps(record, 'select', true),
          render: (_, record) => {
            if (isEmptyPlaceholderRow(record)) return null;
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
      width: 80,
      fixed: 'left',
      onCell: (record) => resolveCellProps(record, 'voucherNo', true),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return null;
        return canOpenVoucherLink(record.voucher) ? (
          <Link onClick={() => openVoucherPage(record.voucher)}>{record.voucher.voucherNo}</Link>
        ) : (
          record.voucher.voucherNo
        );
      }
    },
    {
      title: '日期',
      dataIndex: ['voucher', 'date'],
      width: 100,
      fixed: 'left',
      onCell: (record) => resolveCellProps(record, 'date', true),
      render: (_, record) => (isEmptyPlaceholderRow(record) ? null : record.voucher.date)
    },
    {
      title: '摘要',
      key: 'summary',
      ellipsis: true,
      onCell: (record) => resolveCellProps(record, 'summary'),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return renderEmptyPlaceholder();
        if (record.rowType === 'subtotal') {
          return <span className="voucher-grouped-table__subtotal-label">金额小计</span>;
        }
        return record.entry.summary;
      }
    },
    {
      title: '科目',
      key: 'account',
      width: 150,
      ellipsis: true,
      onCell: (record) => resolveCellProps(record, 'account'),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return null;
        if (record.rowType === 'subtotal') return '';
        const { accountCode, accountName } = record.entry;
        return accountCode ? `${accountCode} ${accountName || ''}`.trim() : '';
      }
    },
    {
      title: '借方金额',
      key: 'debit',
      width: 120,
      align: 'right',
      onCell: (record) => resolveCellProps(record, 'debit'),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return null;
        return record.rowType === 'subtotal'
          ? formatAmount(record.voucher.totalDebit, record.voucher)
          : formatAmount(record.entry.debit, record.voucher);
      }
    },
    {
      title: '贷方金额',
      key: 'credit',
      width: 120,
      align: 'right',
      onCell: (record) => resolveCellProps(record, 'credit'),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return null;
        return record.rowType === 'subtotal'
          ? formatAmount(record.voucher.totalCredit, record.voucher)
          : formatAmount(record.entry.credit, record.voucher);
      }
    },
    {
      title: '备注',
      key: 'remark',
      ellipsis: true,
      className: 'voucher-grouped-table__remark-col',
      onCell: (record) => resolveCellProps(record, 'remark', true),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return null;
        return record.voucher.remark || '';
      }
    },
    {
      title: '附件',
      key: 'attachments',
      width: 80,
      align: 'center',
      className: 'voucher-grouped-table__attach-col',
      onCell: (record) => resolveCellProps(record, 'attachments', true),
      render: (_, record) => (isEmptyPlaceholderRow(record) ? null : renderAttachments(record.voucher))
    },
    {
      title: '发票号',
      key: 'invoiceNumbers',
      width: 200,
      className: 'voucher-grouped-table__invoice-col',
      onCell: (record) => ({
        ...resolveCellProps(record, 'invoiceNumbers', true),
        className: 'voucher-grouped-table__invoice-col'
      }),
      render: (_, record) =>
        isEmptyPlaceholderRow(record) ? null : renderMultilineText(record.voucher.invoiceNumbers)
    },
    {
      title: (
        <SensitiveColumnHeader
          label="制单人"
          visible={showPreparedByPlain}
          onToggle={() => setShowPreparedByPlain((value) => !value)}
        />
      ),
      key: 'preparedBy',
      width: 88,
      ellipsis: true,
      onCell: (record) => resolveCellProps(record, 'preparedBy', true),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return null;
        const name = resolveOperatorDisplayName(
          record.voucher.preparedBy,
          operatorLookup,
          record.voucher.createdByAccountId
        );
        return formatSensitiveText(name, showPreparedByPlain);
      }
    },
    {
      title: (
        <SensitiveColumnHeader
          label="审核人"
          visible={showReviewedByPlain}
          onToggle={() => setShowReviewedByPlain((value) => !value)}
        />
      ),
      key: 'reviewedBy',
      width: 88,
      ellipsis: true,
      onCell: (record) => resolveCellProps(record, 'reviewedBy', true),
      render: (_, record) => {
        if (isEmptyPlaceholderRow(record)) return null;
        const name = resolveOperatorDisplayName(record.voucher.reviewedBy, operatorLookup);
        return formatSensitiveText(name, showReviewedByPlain);
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      onCell: (record) => resolveCellProps(record, 'status', true),
      render: (_, record) =>
        isEmptyPlaceholderRow(record) ? null : (
          <StatusBadge status={record.voucher.status} voucher={record.voucher} />
        )
    },
    {
      title: '操作',
      key: 'actions',
      width: 65,
      align: 'center',
      fixed: 'right',
      onCell: (record) => resolveCellProps(record, 'actions', true),
      render: (_, record) => (isEmptyPlaceholderRow(record) ? null : renderActions(record.voucher))
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
    const normalizedCompactColumns = normalizeTableColumns(compactColumns as ColumnsType<VoucherRecord>);
    return (
      <Table
        rowKey="id"
        loading={loading}
        columns={normalizedCompactColumns as ColumnsType<any>}
        dataSource={vouchers}
        pagination={false}
        locale={{ emptyText: '暂无凭证数据' }}
        size="middle"
      />
    );
  }

  const handlePaginationChange = (nextPage: number, nextSize?: number) => {
    const resolvedSize = nextSize ?? pageSize;
    if (useServerPagination && onPaginationChange) {
      onPaginationChange(nextPage, resolvedSize);
      return;
    }
    setInternalPage(nextPage);
    setInternalPageSize(resolvedSize);
  };

  const voucherPaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100'],
    showTotal: (count: number) => `共 ${count} 张凭证`,
    onChange: handlePaginationChange,
    onShowSizeChange: handlePaginationChange
  };

  const isEmpty = groupedRows.length === 0;
  const displayRows = isEmpty ? [VOUCHER_LIST_EMPTY_ROW] : groupedRows;

  const tableProps = {
    className: 'voucher-grouped-table',
    rowKey: 'key',
    loading,
    columns: groupedColumns as ColumnsType<any>,
    dataSource: displayRows,
    // 服务端按「凭证」分页时，dataSource 是展开后的分录行，不能再让 Table 按行二次切片
    pagination: useServerPagination ? false : voucherPaginationConfig,
    rowClassName: (record) => {
      if (isEmptyPlaceholderRow(record)) return 'voucher-grouped-table__row--empty';
      return record.rowType === 'subtotal' ? 'voucher-grouped-table__row--subtotal' : '';
    },
    locale: { emptyText: '暂无凭证数据' },
    size: 'small',
    bordered: true,
    tableLayout: 'fixed',
    summary: () =>
      groupedRows.length ? (
        <Table.Summary fixed={scrollable || undefined}>
          {renderVoucherTotalsSummaryRow(selectable, pageTotals.debit, pageTotals.credit)}
        </Table.Summary>
      ) : null
  };

  const paginationFooter =
    useServerPagination && total > 0 ? (
      <div className="table-scroll-footer">
        <Pagination className="voucher-grouped-table__pagination" {...voucherPaginationConfig} />
      </div>
    ) : null;

  const listChromeFooter = paginationFooter ? (
    <div className="voucher-table-chrome">{paginationFooter}</div>
  ) : null;

  const tableScrollX = selectable ? VOUCHER_LIST_SCROLL_MIN_SELECTABLE : VOUCHER_LIST_SCROLL_MIN;

  if (scrollable) {
    return (
      <ScrollTable
        {...(tableProps as Record<string, unknown>)}
        fillPage
        bodyClassName="page-table-body--voucher-list"
        wrapStyle={{ '--voucher-list-scroll-x': `${tableScrollX}px` } as CSSProperties}
        scroll={{ x: tableScrollX }}
        scrollBarBelowSummary
        footer={listChromeFooter}
      />
    );
  }

  return (
    <>
      <AppTable {...(tableProps as Record<string, unknown>)} />
      {listChromeFooter}
    </>
  );
}
