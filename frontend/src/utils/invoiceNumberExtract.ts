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
    /Invoice\s*No\.?[^\d]{0,20}(\d{8,20})/gi,
    /"fphm"\s*:\s*"(\d{8,20})"/gi,
    /<fphm>\s*(\d{8,20})\s*<\/fphm>/gi,
    /\(fphm\)\s*(\d{8,20})/gi
  ];

  const found: string[] = [];
  for (const pattern of patterns) {
    found.push(...collectMatches(source, pattern));
  }

  for (const label of ['发票号码', '发票号码：', '发票号码:', 'fphm', 'FPHM']) {
    found.push(...extractNearLabel(source, label));
  }

  return dedupeInvoiceNumbers(found);
}

export async function extractInvoiceNumbersFromPdf(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const latin1 = new TextDecoder('latin1').decode(buffer);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  return dedupeInvoiceNumbers([
    ...extractInvoiceNumbersFromText(latin1),
    ...extractInvoiceNumbersFromText(utf8)
  ]);
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

export function mergeInvoiceNumbers(existing: string, found: string[]): string {
  const parts = String(existing || '')
    .split(/[,，、;\s]+/)
    .map((item) => digitsOnly(item))
    .filter(isValidInvoiceNumber);
  return dedupeInvoiceNumbers([...parts, ...found]).join(',');
}
