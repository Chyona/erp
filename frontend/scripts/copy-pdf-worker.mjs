import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = join(fileURLToPath(import.meta.url), '..', '..');
const source = join(frontendRoot, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
const targetDir = join(frontendRoot, 'public');
const target = join(targetDir, 'pdf.worker.min.js');

if (!existsSync(source)) {
  console.error('[copy-pdf-worker] 未找到 pdfjs worker，请先执行 pnpm install');
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log('[copy-pdf-worker] 已复制到 public/pdf.worker.min.js');
