import { useCallback, useEffect, useState } from 'react';
import { Modal, Button, Space, App, Popconfirm, Alert, Tooltip } from 'antd';
import { FilePdfOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { Voucher } from '../services/voucher';
import { ExportUtil, getCompanyInfo } from '../services/export';
import { confirmWarning } from '../utils/confirmAction';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { isCarryForwardVoucher, CARRY_FORWARD_VOUCHER_READONLY_TIP } from '../utils/carryForwardVoucher';
import { CarryForwardBadge } from './StatusBadge';
import AttachmentPreviewModal, { isPdfAttachment } from './AttachmentPreviewModal';

function AttachmentThumbnail({ attachment, onClick }) {
  const isPdf = isPdfAttachment(attachment);

  return (
    <button
      type="button"
      className="attachment-thumb"
      onClick={() => onClick(attachment)}
      title={attachment.name}
    >
      <div className="attachment-thumb__visual">
        {isPdf ? (
          <FilePdfOutlined className="attachment-thumb__pdf-icon" />
        ) : (
          <img src={attachment.url} alt="" className="attachment-thumb__img" />
        )}
      </div>
      <span className="attachment-thumb__name">{attachment.name}</span>
    </button>
  );
}

export default function VoucherDetailModal({
  voucherId,
  open,
  onClose,
  onLocked,
  onDeleted,
  onVoucherChange,
  navigationIds
}: {
  voucherId: string | null;
  open: boolean;
  onClose: () => void;
  onLocked?: () => void;
  onDeleted?: () => void;
  onVoucherChange?: (id: string) => void;
  /** 翻页范围（如当前筛选列表顺序）；不传则按全部凭证日期倒序 */
  navigationIds?: string[];
}) {
  const { message, modal } = App.useApp();
  const { refresh } = useApp();
  const { canMutateVoucher, canPrintVoucher } = useAuth();
  const [activeId, setActiveId] = useState<string | null>(voucherId);
  const [voucher, setVoucher] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [company, setCompany] = useState({ name: '', taxId: '' });
  const [loading, setLoading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [adjacent, setAdjacent] = useState<{ older: { id: string } | null; newer: { id: string } | null }>({
    older: null,
    newer: null
  });

  const navIdsKey = (navigationIds || []).join(',');

  useEffect(() => {
    if (open && voucherId) setActiveId(voucherId);
  }, [open, voucherId]);

  useEffect(() => {
    if (!open || !activeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const scopeIds = navigationIds?.length ? navigationIds : undefined;
      const [v, comp, older, newer] = await Promise.all([
        Voucher.getById(activeId),
        getCompanyInfo(),
        Voucher.getAdjacentVoucher(activeId, 'older', scopeIds),
        Voucher.getAdjacentVoucher(activeId, 'newer', scopeIds)
      ]);
      const atts = [];
      if (v?.attachmentIds) {
        for (const attId of v.attachmentIds) {
          const att = await Voucher.getAttachment(attId);
          if (att) atts.push(att);
        }
      }
      if (!cancelled) {
        setVoucher(v);
        setAttachments(atts);
        setAdjacent({ older, newer });
        setCompany({
          name: typeof comp.name === 'string' ? comp.name : '',
          taxId: typeof comp.taxId === 'string' ? comp.taxId : ''
        });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeId, navIdsKey]);

  useEffect(() => {
    if (!open) {
      setPreviewAttachment(null);
      setAdjacent({ older: null, newer: null });
    }
  }, [open]);

  const canGoOlder = Boolean(adjacent.older) && !loading;
  const canGoNewer = Boolean(adjacent.newer) && !loading;

  const navigateTo = useCallback((id: string) => {
    if (!id) return;
    setActiveId((prev) => (prev === id ? prev : id));
    onVoucherChange?.(id);
  }, [onVoucherChange]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowLeft' && canGoOlder && adjacent.older) {
        e.preventDefault();
        navigateTo(adjacent.older.id);
      } else if (e.key === 'ArrowRight' && canGoNewer && adjacent.newer) {
        e.preventDefault();
        navigateTo(adjacent.newer.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, adjacent, canGoOlder, canGoNewer, navigateTo]);

  const handlePrint = () => {
    if (!voucher || !canPrintVoucher(voucher)) {
      message.warning('无权打印该凭证');
      return;
    }
    const html = ExportUtil.renderPrintVoucher(voucher, company, attachments);
    ExportUtil.printVoucher(html);
  };

  const handleDelete = async () => {
    if (!voucher || voucher.status === 'locked') return;
    try {
      await Voucher.remove(voucher.id);
      message.success('凭证已删除');
      refresh();
      onDeleted?.();
      onClose();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleForceDelete = async () => {
    if (!voucher || voucher.status !== 'locked') return;
    try {
      await Voucher.forceRemove(voucher.id);
      message.success('凭证已删除');
      refresh();
      onDeleted?.();
      onClose();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleLock = async () => {
    if (!voucher) return;
    const ok = await confirmWarning(modal, {
      title: '确定结项？',
      content: `凭证 ${voucher.voucherNo} 结项后将不可修改和删除，仅可查看和打印。`,
      okText: '确定结项'
    });
    if (!ok) return;
    try {
      await Voucher.lock(voucher.id);
      message.success('凭证已结项');
      onLocked?.();
      onClose();
    } catch (err) {
      message.error(err.message);
    }
  };

  const handleUnapprove = async () => {
    if (!voucher || voucher.status !== Voucher.STATUS.APPROVED) return;
    const ok = await confirmWarning(modal, {
      title: '反审核',
      content: `确定将凭证 ${voucher.voucherNo} 改回草稿？反审核后可继续编辑。`,
      okText: '反审核'
    });
    if (!ok) return;
    try {
      const updated = await Voucher.unapprove(voucher.id);
      message.success('已反审核，凭证已改回草稿');
      setVoucher(updated);
      onLocked?.();
    } catch (err) {
      message.error(err.message || '反审核失败');
    }
  };

  const carryForward = Boolean(voucher && isCarryForwardVoucher(voucher));

  return (
    <>
      <Modal
        title={
          <Space size={8}>
            <span>{voucher ? `凭证 ${voucher.voucherNo}` : '凭证详情'}</span>
            {voucher ? <CarryForwardBadge voucher={voucher} /> : null}
          </Space>
        }
        centered
        open={open}
        onCancel={onClose}
        width={880}
        className="voucher-detail-modal"
        wrapClassName="voucher-detail-modal-wrap"
        footer={
          <Space>
            {voucher && canMutateVoucher(voucher) && !carryForward && voucher.status === Voucher.STATUS.APPROVED && (
              <Button danger onClick={handleUnapprove} disabled={!voucher}>
                反审核
              </Button>
            )}
            {voucher &&
              canMutateVoucher(voucher) &&
              !carryForward &&
              (voucher.status === 'locked' ? (
                <Popconfirm
                  title="确定强制删除已结项凭证？"
                  description={
                    voucher
                      ? `凭证 ${voucher.voucherNo} 及关联附件删除后不可恢复。`
                      : undefined
                  }
                  okText="强制删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={handleForceDelete}
                  disabled={!voucher}
                >
                  <Button danger disabled={!voucher}>
                    强制删除
                  </Button>
                </Popconfirm>
              ) : (
                <>
                  <Popconfirm
                    title="确定删除该凭证？"
                    description={
                      voucher
                        ? `凭证 ${voucher.voucherNo} 及关联附件删除后不可恢复。`
                        : undefined
                    }
                    okText="确定删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={handleDelete}
                    disabled={!voucher}
                  >
                    <Button danger disabled={!voucher}>
                      删除凭证
                    </Button>
                  </Popconfirm>
                  {voucher && canPrintVoucher(voucher) ? (
                    <Button onClick={handlePrint}>
                      打印凭证
                    </Button>
                  ) : null}
                  <Button onClick={handleLock} disabled={!voucher}>
                    凭证结项
                  </Button>
                </>
              ))}
            <Button type="primary" onClick={onClose}>
              关闭
            </Button>
          </Space>
        }
      >
        <div className="voucher-detail-modal__layout">
          <div className="voucher-detail-modal__rail">
            <Tooltip title={canGoOlder ? '上一张（更早）' : '已是最早一张'} placement="right">
              <span className="voucher-detail-modal__rail-hit">
                <Button
                  type="default"
                  shape="circle"
                  className="voucher-detail-modal__rail-btn"
                  icon={<LeftOutlined />}
                  disabled={!canGoOlder}
                  onClick={() => canGoOlder && adjacent.older && navigateTo(adjacent.older.id)}
                  aria-label="上一张"
                />
              </span>
            </Tooltip>
          </div>
          <div className="voucher-detail-modal__main">
            {loading && !voucher ? (
              <div className="voucher-detail-modal__loading">加载中…</div>
            ) : null}
            {carryForward ? (
              <Alert
                type="info"
                showIcon
                message={CARRY_FORWARD_VOUCHER_READONLY_TIP}
                style={{ marginBottom: 16 }}
              />
            ) : null}
            {voucher ? (
              <>
                <div
                  dangerouslySetInnerHTML={{
                    __html: ExportUtil.renderPrintVoucher(voucher, company, attachments)
                  }}
                />
                {attachments.length > 0 && (
                  <div className="voucher-attachment-previews">
                    <h4>附件预览</h4>
                    <div className="attachment-thumb-grid">
                      {attachments.map((a) => (
                        <AttachmentThumbnail
                          key={a.id}
                          attachment={a}
                          onClick={setPreviewAttachment}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
          <div className="voucher-detail-modal__rail">
            <Tooltip title={canGoNewer ? '下一张（更新）' : '已是最新一张'} placement="left">
              <span className="voucher-detail-modal__rail-hit">
                <Button
                  type="default"
                  shape="circle"
                  className="voucher-detail-modal__rail-btn"
                  icon={<RightOutlined />}
                  disabled={!canGoNewer}
                  onClick={() => canGoNewer && adjacent.newer && navigateTo(adjacent.newer.id)}
                  aria-label="下一张"
                />
              </span>
            </Tooltip>
          </div>
        </div>
      </Modal>

      <AttachmentPreviewModal
        attachment={previewAttachment}
        open={Boolean(previewAttachment)}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
}
