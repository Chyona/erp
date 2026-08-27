const ROUTE_TITLES: Record<string, string> = {
  '/': '工作台',
  '/vouchers': '凭证管理',
  '/vouchers/new': '录凭证',
  '/accounts': '会计科目',
  '/ledger': '明细账',
  '/general-ledger': '总账',
  '/reports': '报表',
  '/closing/period-end': '季末结转',
  '/closing/reimbursement': '月底报销',
  '/payroll/sheet': '工资表',
  '/payroll/stats': '工资统计',
  '/payroll/staff': '部门职员',
  '/audit': '操作日志',
  '/users': '用户管理',
  '/settings': '系统设置',
  '/backup-restore': '备份与恢复'
};

export const PAGE_TABS_MAX = 20;

export const HOME_TAB_KEY = '/';

export function createHomeTab(): { key: string; path: string; title: string; closable: boolean } {
  return {
    key: HOME_TAB_KEY,
    path: HOME_TAB_KEY,
    title: ROUTE_TITLES[HOME_TAB_KEY] || '工作台',
    closable: false
  };
}

export function getTabKey(pathname: string, search = '') {
  return `${pathname}${search}`;
}

export function parseTabPath(path: string) {
  const qIndex = path.indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = qIndex >= 0 ? path.slice(qIndex) : '';
  return {
    pathname,
    search,
    key: getTabKey(pathname, search),
    fullPath: `${pathname}${search}`
  };
}

export const VOUCHER_NEW_TAB_KEY = '/vouchers/new';
export const VOUCHER_EDIT_TAB_KEY = '/vouchers/edit';

export function isVoucherNewPath(pathname: string) {
  return pathname === VOUCHER_NEW_TAB_KEY;
}

export function isVoucherEditPath(pathname: string) {
  return /^\/vouchers\/[^/]+\/edit$/.test(pathname);
}

export function isVoucherEditTabKey(key: string) {
  return key === VOUCHER_EDIT_TAB_KEY || isVoucherEditPath(key);
}

export function resolveTabIdentity(pathname: string, search = '') {
  const path = `${pathname}${search}`;
  if (isVoucherNewPath(pathname)) {
    return { key: VOUCHER_NEW_TAB_KEY, path, pathname };
  }
  if (isVoucherEditPath(pathname)) {
    return { key: VOUCHER_EDIT_TAB_KEY, path, pathname };
  }
  return { key: getTabKey(pathname, search), path, pathname };
}

export function resolvePageTabTitle(pathname: string) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  const sheetMatch = pathname.match(/^\/payroll\/sheet\/(\d{4}-\d{2})$/);
  if (sheetMatch) return '工资详情';
  if (/^\/vouchers\/[^/]+\/edit$/.test(pathname)) return '凭证';
  return pathname.replace(/^\//, '') || '页面';
}

/** Tab 标题仅由 tab key 决定，创建后不再变更。 */
export function resolvePageTabTitleFromKey(key: string) {
  if (isHomeTabKey(key)) return ROUTE_TITLES[HOME_TAB_KEY] || '工作台';
  if (key === VOUCHER_NEW_TAB_KEY) return ROUTE_TITLES[VOUCHER_NEW_TAB_KEY];
  if (key === VOUCHER_EDIT_TAB_KEY) return '凭证';
  if (isVoucherEditPath(key)) return '凭证';
  const pathname = key.includes('?') ? key.slice(0, key.indexOf('?')) : key;
  return resolvePageTabTitle(pathname);
}

export function isHomeTabKey(key: string) {
  return key === HOME_TAB_KEY;
}

export function ensureHomeTabFirst<T extends { key: string }>(tabs: T[], homeTab: T): T[] {
  const rest = tabs.filter((tab) => tab.key !== HOME_TAB_KEY);
  return [homeTab, ...rest];
}
