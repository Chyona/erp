import { Button, Input, Space, Spin, Tooltip, Upload } from 'antd';
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
      <Space size={4} align="center" wrap className="voucher-sheet__attach-row">
        <Space
          size={4}
          className={
            attachmentsCount > 0 ? 'voucher-sheet__attach-group--clickable' : undefined
          }
          onClick={attachmentsCount > 0 ? onToggle : undefined}
        >
          <span className="voucher-sheet__meta-label">附件</span>
          <Input readOnly value={attachmentsCount} className="voucher-sheet__attach-count" />
          <span className="voucher-sheet__attach-suffix">张</span>
          {attachmentsCount > 0 && (
            <span className="voucher-sheet__attach-link">
              <PaperClipOutlined />
              <sup>{attachmentsCount}</sup>
            </span>
          )}
        </Space>
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
      </Space>
      {uploadStatus ? (
        <div className="voucher-sheet__upload-status" role="status" aria-live="polite">
          <Spin size="small" />
          <span>{uploadStatus}</span>
        </div>
      ) : null}
    </div>
  );
}
