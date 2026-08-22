import { useState } from 'react';
import { Button, Popconfirm, Upload, Tooltip } from 'antd';
import {
  ClearOutlined,
  CloseOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PaperClipOutlined
} from '@ant-design/icons';
import { Voucher } from '../services/voucher';
import AttachmentPreviewModal, { isPdfAttachment } from './AttachmentPreviewModal';

/** 凭证表格右侧附件列（可展开/收起） */
export default function VoucherAttachmentColumn({
  attachments,
  open,
  onClose,
  onRemove,
  onRemoveMany,
  onUpload,
  canModify = true
}) {
  const [preview, setPreview] = useState(null);

  const removeAll = () => {
    const indices = (attachments || []).map((_, index) => index);
    if (!indices.length) return;
    if (onRemoveMany) {
      onRemoveMany(indices);
    } else {
      [...indices].sort((a, b) => b - a).forEach((index) => onRemove?.(index));
    }
  };

  if (!attachments.length || !open) return null;

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
        <div className="voucher-sheet__attach-col-body">
          {attachments.map((att, index) => {
            const isPdf = isPdfAttachment(att);
            return (
              <div key={att.id} className="voucher-attach-panel__item">
                <div className="voucher-attach-panel__item-head">
                  <span className="voucher-attach-panel__name" title={att.name}>
                    {att.name}
                  </span>
                  <Popconfirm
                    title="确定删除该附件？"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => onRemove?.(index)}
                    disabled={!canModify}
                  >
                    <button
                      type="button"
                      className="voucher-attach-panel__delete"
                      aria-label="删除"
                      disabled={!canModify}
                    >
                      <DeleteOutlined />
                    </button>
                  </Popconfirm>
                </div>
                <button
                  type="button"
                  className="voucher-attach-panel__preview"
                  onClick={() => setPreview(att)}
                  title="点击预览"
                >
                  {isPdf ? (
                    <div className="voucher-attach-panel__pdf">
                      <FilePdfOutlined />
                      <span>PDF</span>
                    </div>
                  ) : (
                    <img src={att.url} alt={att.name} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
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
        attachment={preview}
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
      />
    </>
  );
}

export { isPdfAttachment };
