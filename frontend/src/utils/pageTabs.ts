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

export function resolvePageTabTitle(pathname: string) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (/^\/vouchers\/\d+\/edit$/.test(pathname)) return '编辑凭证';
  return pathname.replace(/^\//, '') || '页面';
}

export function isHomeTabKey(key: string) {
  return key === HOME_TAB_KEY;
}

export function ensureHomeTabFirst<T extends { key: string }>(tabs: T[], homeTab: T): T[] {
  const rest = tabs.filter((tab) => tab.key !== HOME_TAB_KEY);
  return [homeTab, ...rest];
}
