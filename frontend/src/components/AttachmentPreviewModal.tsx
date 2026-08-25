import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Image, Spin, App } from 'antd';
import {
  CloseOutlined,
  DownloadOutlined,
  LeftOutlined,
  PaperClipOutlined,
  RightOutlined
} from '@ant-design/icons';

import { downloadAttachment } from '../utils/attachmentName';
import { fetchPdfBuffer, renderPdfPageImages } from '../utils/pdfPreview';
import EllipsisText from './EllipsisText';

export type AttachmentLike = {
  id?: string;
  name?: string;
  displayName?: string;
  url?: string;
  type?: string;
};

function isPdfAttachment(att: AttachmentLike | null | undefined) {
  if (!att) return false;
  const label = att.displayName || att.name || '';
  return att.type === 'application/pdf' || /\.pdf$/i.test(label);
}

function attachmentLabel(att: AttachmentLike | null | undefined) {
  return att?.displayName || att?.name || '附件';
}

function PreviewFileTitle({ label }: { label: string }) {
  return (
    <div className="attachment-preview-title">
      <PaperClipOutlined className="attachment-preview-title__icon" aria-hidden />
      <EllipsisText className="attachment-preview-title__text" tooltip={label}>
        {label}
      </EllipsisText>
    </div>
  );
}

function AttachmentPreviewPager({
  index,
  total,
  canPrev,
  canNext,
  onPrev,
  onNext
}: {
  index: number;
  total: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (total <= 1) return null;

  return createPortal(
    <div className="attachment-preview-pager" role="navigation" aria-label="附件翻页">
      <button
        type="button"
        className="attachment-preview-pager__btn"
        disabled={!canPrev}
        onClick={onPrev}
        aria-label="上一个附件"
      >
        <LeftOutlined />
      </button>
      <span className="attachment-preview-pager__count">
        {index + 1} / {total}
      </span>
      <button
        type="button"
        className="attachment-preview-pager__btn"
        disabled={!canNext}
        onClick={onNext}
        aria-label="下一个附件"
      >
        <RightOutlined />
      </button>
    </div>,
    document.body
  );
}

type PdfPageImage = { page: number; src: string };

function PdfPreviewContent({ url, label }: { url: string; label: string }) {
  const [pages, setPages] = useState<PdfPageImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setPages([]);

    (async () => {
      try {
        const buffer = await fetchPdfBuffer(url);
        if (cancelled) return;
        const rendered = await renderPdfPageImages(buffer);
        if (cancelled) return;
        if (!rendered.length) {
          throw new Error('PDF 没有可显示的页面');
        }
        setPages(rendered);
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
    };
  }, [url]);

  if (loading) {
    return (
      <div className="attachment-lightbox__status">
        <Spin size="large" />
        <span>正在加载 PDF…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="attachment-lightbox__status">
        <p>{error}</p>
        <p className="attachment-lightbox__hint">若无法预览，请下载后本地查看。</p>
      </div>
    );
  }

  return (
    <div className="attachment-lightbox__pdf-pages">
      {pages.map((item) => (
        <img
          key={item.page}
          src={item.src}
          alt={`${label} 第 ${item.page} 页`}
          className="attachment-lightbox__pdf-page"
        />
      ))}
    </div>
  );
}

function PdfGalleryLightbox({
  attachments,
  index,
  onIndexChange,
  onClose
}: {
  attachments: AttachmentLike[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const safeIndex = Math.min(Math.max(index, 0), Math.max(attachments.length - 1, 0));
  const current = attachments[safeIndex];
  const label = attachmentLabel(current);
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < attachments.length - 1;
  const showSwitch = attachments.length > 1;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (!showSwitch) return;
      if (event.key === 'ArrowLeft' && canPrev) {
        event.preventDefault();
        onIndexChange(safeIndex - 1);
      }
      if (event.key === 'ArrowRight' && canNext) {
        event.preventDefault();
        onIndexChange(safeIndex + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onIndexChange, showSwitch, canPrev, canNext, safeIndex]);

  const handleDownload = async () => {
    if (!current?.url) return;
    try {
      await downloadAttachment(current.url, label);
    } catch (err) {
      message.error((err as Error).message || '下载失败');
    }
  };

  if (!current) return null;

  return createPortal(
    <div
      className="attachment-lightbox attachment-lightbox--document"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button type="button" className="attachment-lightbox__backdrop" onClick={onClose} aria-label="关闭预览" />
      <div className="attachment-lightbox__panel">
        <header className="attachment-lightbox__header attachment-lightbox__header--centered">
          <PreviewFileTitle label={label} />
          <button
            type="button"
            className="attachment-lightbox__close-fixed"
            onClick={onClose}
            aria-label="关闭"
          >
            <CloseOutlined />
          </button>
        </header>

        <div className="attachment-lightbox__body attachment-lightbox__body--document">
          <div className="attachment-lightbox__content attachment-lightbox__content--document" key={current.url || safeIndex}>
            {!current.url ? (
              <div className="attachment-lightbox__status">
                <p>附件地址无效</p>
              </div>
            ) : (
              <PdfPreviewContent url={current.url} label={label} />
            )}
          </div>
        </div>

        <footer className="attachment-lightbox__footer attachment-lightbox__footer--document">
          <Button
            type="text"
            icon={<DownloadOutlined />}
            className="attachment-lightbox__action"
            onClick={() => void handleDownload()}
          >
            下载 PDF
          </Button>
        </footer>
      </div>

      <AttachmentPreviewPager
        index={safeIndex}
        total={attachments.length}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={() => onIndexChange(safeIndex - 1)}
        onNext={() => onIndexChange(safeIndex + 1)}
      />
    </div>,
    document.body
  );
}

function ImageAttachmentPreview({
  attachments,
  index,
  onIndexChange,
  onClose
}: {
  attachments: AttachmentLike[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const safeIndex = Math.min(Math.max(index, 0), Math.max(attachments.length - 1, 0));
  const current = attachments[safeIndex];
  const label = attachmentLabel(current);
  const canPrev = safeIndex > 0;
  const canNext = safeIndex < attachments.length - 1;
  const showSwitch = attachments.length > 1;

  useEffect(() => {
    if (!showSwitch) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && canPrev) {
        event.preventDefault();
        onIndexChange(safeIndex - 1);
      }
      if (event.key === 'ArrowRight' && canNext) {
        event.preventDefault();
        onIndexChange(safeIndex + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSwitch, canPrev, canNext, safeIndex, onIndexChange]);

  if (!current?.url) return null;

  return (
    <>
      <Image
        wrapperStyle={{ display: 'none' }}
        src={current.url}
        preview={{
          visible: true,
          title: <PreviewFileTitle label={label} />,
          rootClassName: 'attachment-image-preview-root',
          onVisibleChange: (visible) => {
            if (!visible) onClose();
          }
        }}
      />
      <AttachmentPreviewPager
        index={safeIndex}
        total={attachments.length}
        canPrev={canPrev}
        canNext={canNext}
        onPrev={() => onIndexChange(safeIndex - 1)}
        onNext={() => onIndexChange(safeIndex + 1)}
      />
    </>
  );
}

/**
 * 附件预览：图片用 Ant Design 原生预览；PDF 用 lightbox + pdf.js。支持同凭证多附件切换。
 */
export default function AttachmentPreviewModal({
  attachments,
  initialIndex = 0,
  open,
  onClose,
  attachment
}: {
  attachments?: AttachmentLike[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  /** @deprecated 请使用 attachments + initialIndex */
  attachment?: AttachmentLike | null;
}) {
  const list = attachments?.length ? attachments : attachment ? [attachment] : [];
  const startIndex = Math.min(Math.max(initialIndex, 0), Math.max(list.length - 1, 0));
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex, list]);

  if (!open || !list.length) return null;

  const current = list[Math.min(Math.max(index, 0), list.length - 1)];

  if (isPdfAttachment(current)) {
    return (
      <PdfGalleryLightbox
        attachments={list}
        index={index}
        onIndexChange={setIndex}
        onClose={onClose}
      />
    );
  }

  return (
    <ImageAttachmentPreview
      attachments={list}
      index={index}
      onIndexChange={setIndex}
      onClose={onClose}
    />
  );
}

export { isPdfAttachment };
