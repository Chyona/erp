import * as pdfjs from 'pdfjs-dist';

export { fetchPdfBuffer, renderPdfPageImages } from './pdfPreview';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function pdfFirstPageToPngFile(file: File): Promise<File> {
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
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
  return new File([blob], `${baseName}.png`, { type: 'image/png' });
}
