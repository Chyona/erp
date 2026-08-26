import { getPdfDocumentInit, pdfjs } from './pdfWorker';

export { fetchPdfBuffer, renderPdfPageImages } from './pdfPreview';

export async function pdfPageToPngFile(file: File, pageNum = 1, scale = 2.5): Promise<File | null> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument(getPdfDocumentInit(data)).promise;
  if (pageNum < 1 || pageNum > pdf.numPages) return null;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF 转图片失败');

  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('PDF 转图片失败'));
    }, 'image/png');
  });

  const baseName = file.name.replace(/\.pdf$/i, '') || 'invoice';
  return new File([blob], `${baseName}-p${pageNum}.png`, { type: 'image/png' });
}

export async function pdfFirstPageToPngFile(file: File): Promise<File> {
  const png = await pdfPageToPngFile(file, 1);
  if (!png) throw new Error('PDF 没有可识别的页面');
  return png;
}
