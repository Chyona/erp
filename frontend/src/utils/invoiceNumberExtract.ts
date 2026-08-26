import { getPdfDocumentInit, pdfjs } from './pdfWorker';

const IMAGE_EXT = /\.(png|jpe?g|webp|bmp|gif)$/i;
const PDF_EXT = /\.pdf$/i;

export function isInvoiceRecognizableFile(file: File | { name?: string; type?: string } | null | undefined) {
  if (!file) return false;
  const name = String(file.name || '');
  const type = String(file.type || '');
  return (
    type.startsWith('image/') ||
    type === 'application/pdf' ||
    IMAGE_EXT.test(name) ||
    PDF_EXT.test(name)
  );
}

function digitsOnly(value: string) {
  return String(value || '').replace(/\D/g, '');
}

function isValidInvoiceNumber(value: string) {
  const digits = digitsOnly(value);
  return digits.length >= 8 && digits.length <= 20;
}

function collectMatches(text: string, pattern: RegExp) {
  const found: string[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const num = digitsOnly(match[1] || match[0]);
    if (isValidInvoiceNumber(num)) found.push(num);
  }
  return found;
}

function extractNearLabel(text: string, label: string, windowSize = 96): string[] {
  const found: string[] = [];
  let from = 0;
  while (from < text.length) {
    const idx = text.indexOf(label, from);
    if (idx < 0) break;
    const slice = text.slice(idx, idx + windowSize);
    const match = slice.match(/(\d{8,20})/);
    if (match && isValidInvoiceNumber(match[1])) found.push(match[1]);
    from = idx + label.length;
  }
  return found;
}

export function extractInvoiceNumbersFromText(text: string): string[] {
  const source = String(text || '');
  if (!source) return [];

  const patterns = [
    /发票号码[^\d]{0,20}(\d{8,20})/gi,
    /数电(?:票|发票)号码[^\d]{0,20}(\d{8,20})/gi,
    /Invoice\s*No\.?[^\d]{0,20}(\d{8,20})/gi,
    /"fphm"\s*:\s*"(\d{8,20})"/gi,
    /<fphm>\s*(\d{8,20})\s*<\/fphm>/gi,
    /\(fphm\)\s*(\d{8,20})/gi
  ];

  const found: string[] = [];
  for (const pattern of patterns) {
    found.push(...collectMatches(source, pattern));
  }

  for (const label of [
    '发票号码',
    '发票号码：',
    '发票号码:',
    '数电票号码',
    '数电发票号码',
    'fphm',
    'FPHM'
  ]) {
    found.push(...extractNearLabel(source, label));
  }

  return dedupeInvoiceNumbers(found);
}

async function extractPdfPageText(data: ArrayBuffer, maxPages = 3): Promise<string[]> {
  const pdf = await pdfjs.getDocument(getPdfDocumentInit(data)).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    parts.push(
      content.items
        .map((item) => ('str' in item ? String(item.str || '') : ''))
        .join(' ')
    );
  }
  return parts;
}

export async function extractInvoiceNumbersFromPdf(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();

  try {
    const pageTexts = await extractPdfPageText(buffer);
    const fromTextLayer = dedupeInvoiceNumbers(
      pageTexts.flatMap((text) => extractInvoiceNumbersFromText(text))
    );
    if (fromTextLayer.length) return fromTextLayer;
  } catch {
    // 扫描件 PDF 无文字层，继续尝试嵌入元数据与大模型识别
  }

  const latin1 = new TextDecoder('latin1').decode(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return dedupeInvoiceNumbers([
    ...extractInvoiceNumbersFromText(latin1),
    ...extractInvoiceNumbersFromText(utf8)
  ]);
}

export function extractInvoiceNumbersFromFileName(name: string): string[] {
  const source = String(name || '');
  const found: string[] = [];

  for (const match of source.matchAll(/dzfp[_-]?(\d{8,20})/gi)) {
    if (match[1]) found.push(match[1]);
  }
  for (const match of source.matchAll(/(?<!\d)(\d{20})(?!\d)/g)) {
    found.push(match[1]);
  }

  return dedupeInvoiceNumbers(found);
}

export function dedupeInvoiceNumbers(numbers: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of numbers) {
    const num = digitsOnly(item);
    if (!isValidInvoiceNumber(num) || seen.has(num)) continue;
    seen.add(num);
    out.push(num);
  }
  return out;
}

export function parseInvoiceNumbersList(existing: string): string[] {
  return String(existing || '')
    .split(/[,，、;\s]+/)
    .map((item) => digitsOnly(item))
    .filter(isValidInvoiceNumber);
}

export function joinInvoiceNumbers(numbers: string[]): string {
  return dedupeInvoiceNumbers(numbers).join(',');
}

export function mergeInvoiceNumbers(existing: string, found: string[]): string {
  return joinInvoiceNumbers([...parseInvoiceNumbersList(existing), ...found]);
}

export function removeInvoiceNumbers(existing: string, toRemove: string[]): string {
  const removeSet = new Set(
    toRemove.map((item) => digitsOnly(item)).filter(isValidInvoiceNumber)
  );
  if (!removeSet.size) return String(existing || '').trim();
  return joinInvoiceNumbers(parseInvoiceNumbersList(existing).filter((num) => !removeSet.has(num)));
}
