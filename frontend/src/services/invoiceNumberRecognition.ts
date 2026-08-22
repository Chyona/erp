import { apiRequest } from './apiClient';
import {
  dedupeInvoiceNumbers,
  extractInvoiceNumbersFromPdf,
  isInvoiceRecognizableFile
} from '../utils/invoiceNumberExtract';
import { pdfFirstPageToPngFile } from '../utils/pdfFirstPageImage';

const IMAGE_MIME = /^image\//i;
const PDF_MIME = /^application\/pdf$/i;

async function fileToBase64(file: File): Promise<{ mimeType: string; base64: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    mimeType: file.type || 'image/png',
    base64: btoa(binary)
  };
}

async function recognizeInvoiceNumbersFromImage(file: File): Promise<string[]> {
  const { mimeType, base64 } = await fileToBase64(file);
  const data = await apiRequest<{ invoiceNumbers?: string[] }>('POST', '/vouchers/parse-invoice-number', {
    imageBase64: base64,
    mimeType
  });
  return dedupeInvoiceNumbers(data.invoiceNumbers || []);
}

function isPdfFile(file: File) {
  return PDF_MIME.test(file.type) || /\.pdf$/i.test(file.name || '');
}

function isImageFile(file: File) {
  return IMAGE_MIME.test(file.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name || '');
}

export async function recognizeInvoiceNumbersFromFile(file: File): Promise<string[]> {
  if (!isInvoiceRecognizableFile(file)) {
    throw new Error('仅支持发票截图（PNG/JPG）或 PDF');
  }

  if (isPdfFile(file)) {
    const fromPdf = await extractInvoiceNumbersFromPdf(file);
    if (fromPdf.length) return fromPdf;

    try {
      const png = await pdfFirstPageToPngFile(file);
      return recognizeInvoiceNumbersFromImage(png);
    } catch (err) {
      throw new Error(
        (err as Error)?.message ||
          '未能从 PDF 识别发票号码，请确认已配置 APP_LLM_API_KEY 且后端已重启'
      );
    }
  }

  if (isImageFile(file)) {
    return recognizeInvoiceNumbersFromImage(file);
  }

  throw new Error('不支持的文件格式，请上传 PNG/JPG 截图或 PDF');
}
