import { Button, Spin, Tooltip, Upload } from 'antd';
import { PaperClipOutlined } from '@ant-design/icons';
import { Voucher } from '../services/voucher';

export default function VoucherAttachmentControls({
  attachmentsCount = 0,
  onToggle,
  onUpload,
  uploadStatus = null,
  canModify = true,
  className = ''
}) {
  const uploadBusy = Boolean(uploadStatus);

  return (
    <div className={`voucher-sheet__attach-wrap ${className}`.trim()}>
      <div className="voucher-sheet__attach-main">
        <div
          className={
            attachmentsCount > 0
              ? 'voucher-sheet__attach-summary voucher-sheet__attach-summary--clickable'
              : 'voucher-sheet__attach-summary'
          }
          onClick={attachmentsCount > 0 ? onToggle : undefined}
          role={attachmentsCount > 0 ? 'button' : undefined}
          tabIndex={attachmentsCount > 0 ? 0 : undefined}
          onKeyDown={
            attachmentsCount > 0
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggle?.();
                  }
                }
              : undefined
          }
        >
          <span className="voucher-sheet__meta-label">附件</span>
          <span className="voucher-sheet__attach-count-value">{attachmentsCount}</span>
          <span className="voucher-sheet__attach-suffix">张</span>
          {attachmentsCount > 0 ? (
            <span className="voucher-sheet__attach-link" aria-hidden="true">
              <PaperClipOutlined />
              <sup>{attachmentsCount}</sup>
            </span>
          ) : null}
        </div>
        <Tooltip title={canModify ? undefined : Voucher.ATTACHMENT_READONLY_TIP}>
          <Upload
            customRequest={onUpload}
            showUploadList={false}
            multiple
            accept="image/*,.pdf"
            disabled={!canModify || uploadBusy}
          >
            <Button
              type="link"
              size="small"
              htmlType="button"
              icon={<PaperClipOutlined />}
              className="voucher-sheet__upload"
              disabled={!canModify || uploadBusy}
              loading={uploadBusy}
              title="可一次选择多个文件"
            >
              上传附件
            </Button>
          </Upload>
        </Tooltip>
      </div>
      {uploadStatus ? (
        <div className="voucher-sheet__upload-status" role="status" aria-live="polite">
          <Spin size="small" />
          <span>{uploadStatus}</span>
        </div>
      ) : null}
    </div>
  );
}
