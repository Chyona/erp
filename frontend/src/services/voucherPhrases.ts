import { ErpApi } from './erpApi';
import { STATIC_REMARK_EXAMPLES, STATIC_SUMMARY_EXAMPLES } from '../constants/voucherPhraseExamples';

export type VoucherPhraseKind = 'summary' | 'remark';

export interface VoucherPhrase {
  id: string;
  text: string;
  createdAt?: string;
}

export type VoucherBuiltinOverrides = {
  hidden: string[];
  replaced: Record<string, string>;
};

const SETTING_KEYS: Record<VoucherPhraseKind, string> = {
  summary: 'voucherSummaryPhrases',
  remark: 'voucherRemarkPhrases'
};

const OVERRIDE_KEYS: Record<VoucherPhraseKind, string> = {
  summary: 'voucherSummaryBuiltinOverrides',
  remark: 'voucherRemarkBuiltinOverrides'
};

const STATIC_LISTS: Record<VoucherPhraseKind, string[]> = {
  summary: STATIC_SUMMARY_EXAMPLES,
  remark: STATIC_REMARK_EXAMPLES
};

function emptyOverrides(): VoucherBuiltinOverrides {
  return { hidden: [], replaced: {} };
}

function normalizeOverrides(raw: unknown): VoucherBuiltinOverrides {
  if (!raw || typeof raw !== 'object') return emptyOverrides();
  const data = raw as Partial<VoucherBuiltinOverrides>;
  const hidden = Array.isArray(data.hidden)
    ? data.hidden.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const replaced: Record<string, string> = {};
  if (data.replaced && typeof data.replaced === 'object') {
    for (const [key, value] of Object.entries(data.replaced)) {
      const original = String(key || '').trim();
      const text = String(value || '').trim();
      if (original && text) replaced[original] = text;
    }
  }
  return { hidden, replaced };
}

async function getBuiltinOverrides(kind: VoucherPhraseKind): Promise<VoucherBuiltinOverrides> {
  return normalizeOverrides(await ErpApi.getSetting(OVERRIDE_KEYS[kind]));
}

async function saveBuiltinOverrides(kind: VoucherPhraseKind, overrides: VoucherBuiltinOverrides) {
  await ErpApi.setSetting(OVERRIDE_KEYS[kind], overrides);
}

export function resolveBuiltinPhraseText(original: string, overrides: VoucherBuiltinOverrides) {
  return overrides.replaced[original] ?? original;
}

export function getResolvedBuiltinTexts(
  kind: VoucherPhraseKind,
  overrides: VoucherBuiltinOverrides
): string[] {
  const hidden = new Set(overrides.hidden);
  return STATIC_LISTS[kind]
    .filter((original) => !hidden.has(original))
    .map((original) => resolveBuiltinPhraseText(original, overrides));
}

async function collectExistingTexts(
  kind: VoucherPhraseKind,
  options: { excludeCustomId?: string; excludeBuiltinOriginal?: string } = {}
): Promise<Set<string>> {
  const [custom, overrides] = await Promise.all([getList(kind), getBuiltinOverrides(kind)]);
  const texts = new Set<string>();

  for (const item of custom) {
    if (item.id === options.excludeCustomId) continue;
    texts.add(item.text);
  }

  const hidden = new Set(overrides.hidden);
  for (const original of STATIC_LISTS[kind]) {
    if (hidden.has(original)) continue;
    if (original === options.excludeBuiltinOriginal) continue;
    texts.add(resolveBuiltinPhraseText(original, overrides));
  }

  return texts;
}

async function assertPhraseAvailable(
  kind: VoucherPhraseKind,
  text: string,
  options: { excludeCustomId?: string; excludeBuiltinOriginal?: string } = {}
) {
  const normalized = text.trim();
  if (!normalized) throw new Error('内容不能为空');
  if (normalized.length > 200) throw new Error('内容不能超过 200 字');

  const texts = await collectExistingTexts(kind, options);
  if (texts.has(normalized)) {
    throw new Error('已存在相同内容');
  }
}

async function getList(kind: VoucherPhraseKind): Promise<VoucherPhrase[]> {
  const list = await ErpApi.getSetting(SETTING_KEYS[kind]);
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => ({
      id: String(item?.id || ''),
      text: String(item?.text || '').trim(),
      createdAt: item?.createdAt
    }))
    .filter((item) => item.id && item.text);
}

async function saveList(kind: VoucherPhraseKind, list: VoucherPhrase[]) {
  await ErpApi.setSetting(SETTING_KEYS[kind], list);
}

export async function getPhrases(kind: VoucherPhraseKind): Promise<VoucherPhrase[]> {
  return getList(kind);
}

export async function addPhrase(kind: VoucherPhraseKind, text: string): Promise<VoucherPhrase> {
  const normalized = text.trim();
  await assertPhraseAvailable(kind, normalized);

  const list = await getList(kind);
  const item: VoucherPhrase = {
    id: ErpApi.generateId(),
    text: normalized,
    createdAt: new Date().toISOString()
  };
  await saveList(kind, [item, ...list]);
  return item;
}

export async function updatePhrase(
  kind: VoucherPhraseKind,
  id: string,
  text: string
): Promise<VoucherPhrase> {
  const normalized = text.trim();
  await assertPhraseAvailable(kind, normalized, { excludeCustomId: id });

  const list = await getList(kind);
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) throw new Error('短语不存在');

  const updated = { ...list[index], text: normalized };
  const next = [...list];
  next[index] = updated;
  await saveList(kind, next);
  return updated;
}

export async function removePhrase(kind: VoucherPhraseKind, id: string) {
  const list = await getList(kind);
  await saveList(
    kind,
    list.filter((item) => item.id !== id)
  );
}

export async function getBuiltinPhraseOverrides(
  kind: VoucherPhraseKind
): Promise<VoucherBuiltinOverrides> {
  return getBuiltinOverrides(kind);
}

export async function updateBuiltinPhrase(
  kind: VoucherPhraseKind,
  original: string,
  text: string
): Promise<string> {
  const source = String(original || '').trim();
  if (!source) throw new Error('内置短语不存在');
  if (!STATIC_LISTS[kind].includes(source)) throw new Error('内置短语不存在');

  const normalized = text.trim();
  await assertPhraseAvailable(kind, normalized, { excludeBuiltinOriginal: source });

  const overrides = await getBuiltinOverrides(kind);
  const hidden = overrides.hidden.filter((item) => item !== source);
  const replaced = { ...overrides.replaced };

  if (normalized === source) {
    delete replaced[source];
  } else {
    replaced[source] = normalized;
  }

  await saveBuiltinOverrides(kind, { hidden, replaced });
  return normalized;
}

export async function removeBuiltinPhrase(kind: VoucherPhraseKind, original: string) {
  const source = String(original || '').trim();
  if (!source) throw new Error('内置短语不存在');
  if (!STATIC_LISTS[kind].includes(source)) throw new Error('内置短语不存在');

  const overrides = await getBuiltinOverrides(kind);
  const hidden = overrides.hidden.includes(source)
    ? overrides.hidden
    : [...overrides.hidden, source];
  const replaced = { ...overrides.replaced };
  delete replaced[source];

  await saveBuiltinOverrides(kind, { hidden, replaced });
}

export const VoucherPhrases = {
  getPhrases,
  addPhrase,
  updatePhrase,
  removePhrase,
  getBuiltinPhraseOverrides,
  updateBuiltinPhrase,
  removeBuiltinPhrase,
  getResolvedBuiltinTexts
};
