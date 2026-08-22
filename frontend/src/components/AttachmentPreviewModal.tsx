import { useEffect, useState } from 'react';
import { Button, Modal, Space, Spin } from 'antd';

function isPdfAttachment(att: { type?: string; name?: string } | null | undefined) {
  if (!att) return false;
  return att.type === 'application/pdf' || /\.pdf$/i.test(att.name || '');
}

type AttachmentLike = {
  name?: string;
  url?: string;
  type?: string;
};

/**
 * 附件预览：图片直接展示；PDF 先拉取为 Blob 再本地预览（避免 COS 跨域 iframe 空白）。
 */
export default function AttachmentPreviewModal({
  attachment,
  open,
  onClose
}: {
  attachment: AttachmentLike | null;
  open: boolean;
  onClose: () => void;
}) {
  const isPdf = isPdfAttachment(attachment);
  const [pdfSrc, setPdfSrc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !attachment?.url || !isPdf) {
      setPdfSrc('');
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl = '';
    setLoading(true);
    setError('');
    setPdfSrc('');

    (async () => {
      try {
        const res = await fetch(attachment.url!);
        if (!res.ok) {
          throw new Error(`加载失败（HTTP ${res.status}）`);
        }
        const blob = await res.blob();
        const pdfBlob =
          blob.type === 'application/pdf' || blob.type === ''
            ? new Blob([blob], { type: 'application/pdf' })
            : blob;
        objectUrl = URL.createObjectURL(pdfBlob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPdfSrc(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError((err as Error)?.message || 'PDF 预览加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, attachment?.url, isPdf]);

  if (!attachment) return null;

  return (
    <Modal
      title={attachment.name}
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button href={attachment.url} target="_blank" rel="noreferrer">
            新窗口打开
          </Button>
          <Button href={attachment.url} download={attachment.name}>
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
        <div className="attachment-preview-modal__pdf-wrap">
          {loading && (
            <div className="attachment-preview-modal__pdf-status">
              <Spin />
              <span>正在加载 PDF…</span>
            </div>
          )}
          {!loading && error && (
            <div className="attachment-preview-modal__pdf-status">
              <p>{error}</p>
              <p className="attachment-preview-modal__hint">
                若无法预览，请点击「新窗口打开」或「下载」后本地查看。也可能需在 COS 桶配置跨域（CORS）。
              </p>
            </div>
          )}
          {!loading && !error && pdfSrc && (
            <iframe
              title={attachment.name}
              src={`${pdfSrc}#toolbar=1&navpanes=0`}
              className="attachment-preview-modal__pdf-frame"
            />
          )}
        </div>
      ) : (
        <img
          src={attachment.url}
          alt={attachment.name}
          className="attachment-preview-modal__image"
        />
      )}
    </Modal>
  );
}

export { isPdfAttachment };
