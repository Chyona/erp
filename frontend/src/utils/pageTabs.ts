const ROUTE_TITLES: Record<string, string> = {
  '/': '工作台',
  '/vouchers': '凭证管理',
  '/vouchers/new': '录凭证',
  '/accounts': '会计科目',
  '/ledger': '明细账',
  '/general-ledger': '总账',
  '/reports': '报表',
  '/audit': '操作日志',
  '/users': '用户管理',
  '/settings': '系统设置'
};

export const PAGE_TABS_MAX = 20;

export function getTabKey(pathname: string, search = '') {
  return `${pathname}${search}`;
}

export function resolvePageTabTitle(pathname: string) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  if (/^\/vouchers\/\d+\/edit$/.test(pathname)) return '编辑凭证';
  return pathname.replace(/^\//, '') || '页面';
}

export function isHomeTabKey(key: string) {
  return key === '/';
}
