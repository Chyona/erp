import { STATIC_REMARK_EXAMPLES, STATIC_SUMMARY_EXAMPLES } from '../constants/voucherPhraseExamples';
import {
  VoucherPhrases,
  getResolvedBuiltinTexts,
  type VoucherPhraseKind
} from './voucherPhrases';

const MAX_OPTIONS = 30;

export type PhraseLibraryItem = {
  key: string;
  text: string;
  source: 'custom' | 'builtin';
  id?: string;
  builtinOriginal?: string;
};

type CatalogState = {
  summary: string[];
  remark: string[];
  loaded: boolean;
  loading: Promise<void> | null;
};

const state: CatalogState = {
  summary: [],
  remark: [],
  loaded: false,
  loading: null
};

function dedupeOrdered(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const text = String(raw || '').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

async function loadCatalog() {
  const [userSummaries, userRemarks, summaryOverrides, remarkOverrides] = await Promise.all([
    VoucherPhrases.getPhrases('summary'),
    VoucherPhrases.getPhrases('remark'),
    VoucherPhrases.getBuiltinPhraseOverrides('summary'),
    VoucherPhrases.getBuiltinPhraseOverrides('remark')
  ]);

  state.summary = dedupeOrdered([
    ...userSummaries.map((item) => item.text),
    ...getResolvedBuiltinTexts('summary', summaryOverrides)
  ]);
  state.remark = dedupeOrdered([
    ...userRemarks.map((item) => item.text),
    ...getResolvedBuiltinTexts('remark', remarkOverrides)
  ]);
  state.loaded = true;
}

export function invalidateVoucherPhraseCatalog() {
  state.loaded = false;
  state.loading = null;
  state.summary = [];
  state.remark = [];
}

export async function ensureVoucherPhraseCatalog() {
  if (state.loaded) return;
  if (!state.loading) {
    state.loading = loadCatalog().finally(() => {
      state.loading = null;
    });
  }
  await state.loading;
}

function rankMatch(text: string, keyword: string): number {
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  if (!kw) return 0;
  if (lower === kw) return 0;
  if (lower.startsWith(kw)) return 1;
  const idx = lower.indexOf(kw);
  return idx >= 0 ? 2 + idx / 1000 : 999;
}

export async function searchVoucherPhrases(
  kind: VoucherPhraseKind,
  keyword = '',
  limit = MAX_OPTIONS
): Promise<string[]> {
  await ensureVoucherPhraseCatalog();
  const pool = kind === 'summary' ? state.summary : state.remark;
  const kw = keyword.trim();
  if (!kw) return pool.slice(0, limit);

  return pool
    .filter((text) => text.toLowerCase().includes(kw.toLowerCase()))
    .sort((a, b) => rankMatch(a, kw) - rankMatch(b, kw))
    .slice(0, limit);
}

export async function listVoucherPhraseLibrary(
  kind: VoucherPhraseKind,
  keyword = ''
): Promise<PhraseLibraryItem[]> {
  const staticList = kind === 'summary' ? STATIC_SUMMARY_EXAMPLES : STATIC_REMARK_EXAMPLES;
  const [custom, overrides] = await Promise.all([
    VoucherPhrases.getPhrases(kind),
    VoucherPhrases.getBuiltinPhraseOverrides(kind)
  ]);

  const items: PhraseLibraryItem[] = [];
  const seen = new Set<string>();
  const hidden = new Set(overrides.hidden);

  for (const item of custom) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    items.push({
      key: item.id,
      id: item.id,
      text: item.text,
      source: 'custom'
    });
  }

  for (const original of staticList) {
    if (hidden.has(original)) continue;
    const text = overrides.replaced[original] ?? original;
    if (seen.has(text)) continue;
    seen.add(text);
    items.push({
      key: `builtin:${original}`,
      text,
      source: 'builtin',
      builtinOriginal: original
    });
  }

  const kw = keyword.trim().toLowerCase();
  if (!kw) return items;
  return items.filter((item) => item.text.toLowerCase().includes(kw));
}

async function rememberVoucherPhrase(kind: VoucherPhraseKind, text: string) {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  try {
    await VoucherPhrases.addPhrase(kind, normalized);
    return true;
  } catch {
    return false;
  }
}

/** 保存凭证时按需收录摘要/备注到短语库 */
export async function rememberVoucherPhrasesFromVoucher(
  entries: Array<{ summary?: string }>,
  remark?: string
) {
  let changed = false;
  const summaries = dedupeOrdered(
    entries.map((entry) => String(entry.summary || '').trim()).filter(Boolean)
  );

  for (const text of summaries) {
    if (await rememberVoucherPhrase('summary', text)) changed = true;
  }

  const normalizedRemark = String(remark || '').trim();
  if (normalizedRemark && (await rememberVoucherPhrase('remark', normalizedRemark))) {
    changed = true;
  }

  if (changed) invalidateVoucherPhraseCatalog();
}
