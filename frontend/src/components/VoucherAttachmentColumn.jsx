import { useState } from 'react';
import { Button, Modal, Popconfirm, Space, Upload, Tooltip } from 'antd';
import { CloseOutlined, DeleteOutlined, FilePdfOutlined, PaperClipOutlined } from '@ant-design/icons';
import { Voucher } from '../services/voucher.js';

function isPdfAttachment(att) {
  return att.type === 'application/pdf' || /\.pdf$/i.test(att.name || '');
}

function AttachmentPreviewModal({ attachment, open, onClose }) {
  if (!attachment) return null;
  const isPdf = isPdfAttachment(attachment);

  return (
    <Modal
      title={attachment.name}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button href={attachment.data} download={attachment.name}>
            下载
          </Button>
          <Button type="primary" onClick={onClose}>
            关闭
          </Button>
        </Space>
      }
      width={920}
      destroyOnHidden
      className="attachment-preview-modal"
    >
      {isPdf ? (
        <>
          <iframe
            title={attachment.name}
            src={`${attachment.data}#toolbar=1&navpanes=0`}
            className="attachment-preview-modal__pdf-frame"
          />
          <p className="attachment-preview-modal__hint">
            若无法预览，请点击「下载」后本地查看
          </p>
        </>
      ) : (
        <img
          src={attachment.data}
          alt={attachment.name}
          className="attachment-preview-modal__image"
        />
      )}
    </Modal>
  );
}

/** 凭证表格右侧附件列（可展开/收起） */
export default function VoucherAttachmentColumn({
  attachments,
  open,
  onClose,
  onRemove,
  onUpload,
  canModify = true
}) {
  const [preview, setPreview] = useState(null);

  if (!attachments.length || !open) return null;

  return (
    <>
      <div className="voucher-sheet__attach-col">
        <div className="voucher-sheet__attach-col-header">
          <span>附件</span>
          <button
            type="button"
            className="voucher-sheet__attach-col-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseOutlined />
          </button>
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
                    <img src={att.data} alt={att.name} />
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
                <Button type="link" size="small" htmlType="button" icon={<PaperClipOutlined />}>
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
