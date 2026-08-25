import * as pdfjs from 'pdfjs-dist';

// 固定站点根路径，避免 Vite 打包成 assets/*.mjs（线上 MIME 易错）或 ./ 相对路径在 SPA 子路由下 404
pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.js`;

const PDF_CMAP_URL = `${import.meta.env.BASE_URL}pdfjs/cmaps/`;
const PDF_STANDARD_FONT_URL = `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`;

/** 银行/中文 PDF 需加载 cmaps 与 standard_fonts，否则常见「线条有、文字无」。 */
export function getPdfDocumentInit(source: string | ArrayBuffer) {
  const common = {
    cMapUrl: PDF_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDF_STANDARD_FONT_URL
  };

  if (typeof source === 'string') {
    return { url: source, withCredentials: false, ...common };
  }
  return { data: source, ...common };
}

export { pdfjs };
