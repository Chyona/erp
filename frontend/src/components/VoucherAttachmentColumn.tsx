import { useState } from 'react';
import { Button, Popconfirm, Upload, Tooltip, Spin } from 'antd';
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PaperClipOutlined
} from '@ant-design/icons';
import { Voucher } from '../services/voucher';
import AttachmentPreviewModal, { isPdfAttachment, type AttachmentLike } from './AttachmentPreviewModal';

/** 凭证表格右侧附件列（可展开/收起） */
export default function VoucherAttachmentColumn({
  attachments,
  open,
  onClose,
  onRemove,
  onRemoveMany,
  onUpload,
  canModify = true
}: {
  attachments: AttachmentLike[];
  open: boolean;
  onClose: () => void;
  onRemove?: (index: number) => void | Promise<void>;
  onRemoveMany?: (indices: number[]) => void | Promise<void>;
  onUpload?: import('antd/es/upload/interface').UploadProps['customRequest'];
  canModify?: boolean;
}) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const runRemoveMany = async (indices: number[]) => {
    if (!indices.length || busy) return;
    setBusy(true);
    try {
      if (onRemoveMany) {
        await onRemoveMany(indices);
      } else if (onRemove) {
        const sorted = [...indices].sort((a, b) => b - a);
        for (const index of sorted) {
          await onRemove(index);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const runRemoveOne = async (index: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await onRemove?.(index);
    } finally {
      setBusy(false);
    }
  };

  if (!attachments.length || !open) return null;

  const removeAll = () => runRemoveMany(attachments.map((_, index) => index));

  return (
    <>
      <div className="voucher-sheet__attach-col">
        <div className="voucher-sheet__attach-col-header">
          <span className="voucher-sheet__attach-col-title">附件</span>
          <div className="voucher-sheet__attach-col-actions">
            {canModify && attachments.length > 0 && (
              <Popconfirm
                title={`确定清除当前凭证的 ${attachments.length} 个附件？`}
                okText="清除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={removeAll}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  loading={busy}
                  disabled={busy}
                  icon={<ClearOutlined />}
                  className="voucher-sheet__attach-col-clear"
                >
                  清除
                </Button>
              </Popconfirm>
            )}
            <button
              type="button"
              className="voucher-sheet__attach-col-close"
              onClick={onClose}
              aria-label="关闭"
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
        <Spin spinning={busy} tip="处理中…">
          <div className="voucher-sheet__attach-col-body">
            {attachments.map((att, index) => {
              const isPdf = isPdfAttachment(att);
              const label = att.displayName || att.name;
              return (
                <div key={att.id} className="voucher-attach-panel__item">
                  <div className="voucher-attach-panel__item-head">
                    <span className="voucher-attach-panel__name" title={label}>
                      {label}
                    </span>
                    {canModify ? (
                      <Popconfirm
                        title="确定删除该附件？"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => runRemoveOne(index)}
                      >
                        <button
                          type="button"
                          className="voucher-attach-panel__delete"
                          aria-label="删除"
                          disabled={busy}
                        >
                          <DeleteOutlined />
                        </button>
                      </Popconfirm>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="voucher-attach-panel__preview"
                    onClick={() => {
                      setPreviewIndex(index);
                    }}
                    title="点击预览"
                    disabled={busy}
                  >
                    {isPdf ? (
                      <div className="voucher-attach-panel__pdf">
                        <FilePdfOutlined />
                        <span>PDF</span>
                      </div>
                    ) : (
                      <img src={att.url} alt={label} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </Spin>
        {onUpload && (
          <div className="voucher-sheet__attach-col-footer">
            {canModify ? (
              <Upload
                customRequest={onUpload}
                showUploadList={false}
                multiple
                accept="image/*,.pdf"
              >
                <Button
                  type="link"
                  size="small"
                  htmlType="button"
                  icon={<PaperClipOutlined />}
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
                  htmlType="button"
                  icon={<PaperClipOutlined />}
                  disabled
                >
                  上传附件
                </Button>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      <AttachmentPreviewModal
        attachments={attachments}
        initialIndex={previewIndex ?? 0}
        open={previewIndex !== null}
        onClose={() => setPreviewIndex(null)}
      />
    </>
  );
}

export { isPdfAttachment };
