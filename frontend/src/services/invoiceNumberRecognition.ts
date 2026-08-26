import { apiRequest, ApiError } from './apiClient';
import {
  dedupeInvoiceNumbers,
  extractInvoiceNumbersFromFileName,
  extractInvoiceNumbersFromPdf,
  isInvoiceRecognizableFile
} from '../utils/invoiceNumberExtract';
import { pdfPageToPngFile } from '../utils/pdfFirstPageImage';

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

async function recognizeInvoiceNumbersFromImage(
  file: File,
  options?: { allowEmpty?: boolean }
): Promise<string[]> {
  try {
    const { mimeType, base64 } = await fileToBase64(file);
    const data = await apiRequest<{ invoiceNumbers?: string[] }>('POST', '/vouchers/parse-invoice-number', {
      imageBase64: base64,
      mimeType
    });
    return dedupeInvoiceNumbers(data.invoiceNumbers || []);
  } catch (err) {
    if (
      options?.allowEmpty &&
      err instanceof ApiError &&
      (err.httpStatus === 422 || err.code === 422)
    ) {
      return [];
    }
    throw err;
  }
}

function isPdfFile(file: Pick<File, 'name' | 'type'>) {
  return PDF_MIME.test(file.type) || /\.pdf$/i.test(file.name || '');
}

function isImageFile(file: Pick<File, 'name' | 'type'>) {
  return IMAGE_MIME.test(file.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name || '');
}

export async function recognizeInvoiceNumbersFromFile(
  file: File,
  fileName = file.name
): Promise<string[]> {
  if (!isInvoiceRecognizableFile({ name: fileName, type: file.type })) {
    throw new Error('仅支持发票截图（PNG/JPG）或 PDF');
  }

  const fromName = extractInvoiceNumbersFromFileName(fileName);
  if (fromName.length) return fromName;

  const pdfLike = PDF_MIME.test(file.type) || /\.pdf$/i.test(fileName);

  if (pdfLike) {
    const fromPdf = await extractInvoiceNumbersFromPdf(file);
    if (fromPdf.length) return fromPdf;

    for (let pageNum = 1; pageNum <= 3; pageNum++) {
      const png = await pdfPageToPngFile(file, pageNum);
      if (!png) break;
      const numbers = await recognizeInvoiceNumbersFromImage(png, { allowEmpty: true });
      if (numbers.length) return numbers;
    }
    return [];
  }

  if (isImageFile({ ...file, name: fileName } as File)) {
    return recognizeInvoiceNumbersFromImage(file, { allowEmpty: true });
  }

  throw new Error('不支持的文件格式，请上传 PNG/JPG 截图或 PDF');
}
