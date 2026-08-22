import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

function assertPdfBuffer(buffer: ArrayBuffer) {
  const head = new TextDecoder().decode(buffer.slice(0, 5));
  if (!head.startsWith('%PDF-')) {
    throw new Error('文件不是有效的 PDF');
  }
}

export async function fetchPdfBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`加载失败（HTTP ${res.status}）`);
  }
  const buffer = await res.arrayBuffer();
  assertPdfBuffer(buffer);
  return buffer;
}

/** 将 PDF 各页渲染为 JPEG 图片（data URL），用于预览。 */
export async function renderPdfPageImages(
  source: string | ArrayBuffer,
  maxWidth = 960
): Promise<{ page: number; src: string }[]> {
  const loadingTask =
    typeof source === 'string'
      ? pdfjs.getDocument({ url: source, withCredentials: false })
      : pdfjs.getDocument({ data: source });
  const pdf = await loadingTask.promise;
  const pages: { page: number; src: string }[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / baseViewport.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('PDF 预览渲染失败');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({ page: pageNum, src: canvas.toDataURL('image/jpeg', 0.92) });
  }

  return pages;
}
