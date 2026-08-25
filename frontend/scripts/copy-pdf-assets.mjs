import { copyFileSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = join(fileURLToPath(import.meta.url), '..', '..');
const pdfjsRoot = join(frontendRoot, 'node_modules/pdfjs-dist');
const publicRoot = join(frontendRoot, 'public');

function copyDir(sourceRel, targetRel) {
  const source = join(pdfjsRoot, sourceRel);
  const target = join(publicRoot, targetRel);
  if (!existsSync(source)) {
    console.error(`[copy-pdf-assets] 未找到 ${sourceRel}，请先执行 pnpm install`);
    process.exit(1);
  }
  mkdirSync(join(publicRoot, targetRel.split('/')[0]), { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[copy-pdf-assets] 已复制 ${sourceRel} → public/${targetRel}`);
}

const workerSource = join(pdfjsRoot, 'build/pdf.worker.min.mjs');
const workerTarget = join(publicRoot, 'pdf.worker.min.js');

if (!existsSync(workerSource)) {
  console.error('[copy-pdf-assets] 未找到 pdfjs worker，请先执行 pnpm install');
  process.exit(1);
}

mkdirSync(publicRoot, { recursive: true });
copyFileSync(workerSource, workerTarget);
console.log('[copy-pdf-assets] 已复制 worker → public/pdf.worker.min.js');

copyDir('cmaps', 'pdfjs/cmaps');
copyDir('standard_fonts', 'pdfjs/standard_fonts');
