import { ErpApi } from './erpApi';

const SETTING_KEY = 'dashboardIndicators';

export type DashboardIndicatorSource = 'balance' | 'income';

export type DashboardIndicatorDefinition = {
  id: string;
  label: string;
  codePrefix: string;
  source: DashboardIndicatorSource;
  incomeKey?: string;
  visible: boolean;
  builtin?: boolean;
};

export const DEFAULT_DASHBOARD_INDICATORS: DashboardIndicatorDefinition[] = [
  { id: 'cash', label: '现金', codePrefix: '1001', source: 'balance', visible: true, builtin: true },
  { id: 'bank', label: '银行存款', codePrefix: '1002', source: 'balance', visible: true, builtin: true },
  { id: 'receivable', label: '应收账款', codePrefix: '1122', source: 'balance', visible: true, builtin: true },
  { id: 'payable', label: '应付账款', codePrefix: '2202', source: 'balance', visible: true, builtin: true },
  {
    id: 'revenue',
    label: '主营业务收入',
    codePrefix: '5001',
    source: 'income',
    incomeKey: 'revenue',
    visible: true,
    builtin: true
  },
  {
    id: 'sellingExpense',
    label: '销售费用',
    codePrefix: '5601',
    source: 'income',
    incomeKey: 'sellingExpense',
    visible: true,
    builtin: true
  },
  {
    id: 'adminExpense',
    label: '管理费用',
    codePrefix: '5602',
    source: 'income',
    incomeKey: 'adminExpense',
    visible: true,
    builtin: true
  }
];

function normalizeIndicator(raw: Partial<DashboardIndicatorDefinition>): DashboardIndicatorDefinition | null {
  const label = String(raw.label || '').trim();
  const codePrefix = String(raw.codePrefix || '').trim();
  if (!label || !codePrefix) return null;
  const source: DashboardIndicatorSource = raw.source === 'income' ? 'income' : 'balance';
  return {
    id: raw.id || ErpApi.generateId(),
    label,
    codePrefix,
    source,
    incomeKey: source === 'income' ? String(raw.incomeKey || '').trim() || undefined : undefined,
    visible: raw.visible !== false,
    builtin: Boolean(raw.builtin)
  };
}

function mergeWithDefaults(saved: DashboardIndicatorDefinition[]) {
  if (!saved.length) return DEFAULT_DASHBOARD_INDICATORS.map((item) => ({ ...item }));

  const defaultsById = new Map(DEFAULT_DASHBOARD_INDICATORS.map((item) => [item.id, item]));
  const merged = saved
    .map((item) => {
      const fallback = defaultsById.get(item.id);
      return normalizeIndicator({
        ...fallback,
        ...item,
        builtin: fallback?.builtin ?? item.builtin
      });
    })
    .filter((item): item is DashboardIndicatorDefinition => Boolean(item));

  for (const fallback of DEFAULT_DASHBOARD_INDICATORS) {
    if (!merged.some((item) => item.id === fallback.id)) {
      merged.push({ ...fallback });
    }
  }

  return merged;
}

export async function getDashboardIndicatorConfigs(): Promise<DashboardIndicatorDefinition[]> {
  const raw = await ErpApi.getSetting(SETTING_KEY);
  if (!Array.isArray(raw) || !raw.length) {
    return DEFAULT_DASHBOARD_INDICATORS.map((item) => ({ ...item }));
  }
  const normalized = raw
    .map((item) => normalizeIndicator(item as Partial<DashboardIndicatorDefinition>))
    .filter((item): item is DashboardIndicatorDefinition => Boolean(item));
  return mergeWithDefaults(normalized);
}

export async function saveDashboardIndicatorConfigs(items: DashboardIndicatorDefinition[]) {
  const next = items
    .map((item) => normalizeIndicator(item))
    .filter((item): item is DashboardIndicatorDefinition => Boolean(item));
  await ErpApi.setSetting(SETTING_KEY, next);
  return next;
}

export async function getVisibleDashboardIndicators() {
  const configs = await getDashboardIndicatorConfigs();
  return configs.filter((item) => item.visible);
}

export function createDashboardIndicator(
  payload: Pick<DashboardIndicatorDefinition, 'label' | 'codePrefix'> &
    Partial<Pick<DashboardIndicatorDefinition, 'source' | 'incomeKey'>>
): DashboardIndicatorDefinition {
  const source = payload.source === 'income' ? 'income' : 'balance';
  return {
    id: ErpApi.generateId(),
    label: payload.label.trim(),
    codePrefix: payload.codePrefix.trim(),
    source,
    incomeKey: source === 'income' ? payload.incomeKey?.trim() || undefined : undefined,
    visible: true,
    builtin: false
  };
}
