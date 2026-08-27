import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createHomeTab,
  ensureHomeTabFirst,
  getTabKey,
  isHomeTabKey,
  PAGE_TABS_MAX,
  parseTabPath,
  resolvePageTabTitleFromKey,
  isVoucherEditPath,
  isVoucherNewPath,
  isPayrollSheetDetailPath,
  resolveTabIdentity,
  VOUCHER_NEW_TAB_KEY,
  PAYROLL_SHEET_DETAIL_TAB_KEY
} from '../utils/pageTabs';

function removeDuplicateSingletonTabs<T extends { key: string; path: string }>(
  tabs: T[],
  key: string,
  pathname: string,
  cacheRef: React.MutableRefObject<Map<string, ReactElement>>
) {
  let next = tabs;
  if (isVoucherNewPath(pathname)) {
    next = next.filter((tab) => {
      const tabPathname = parseTabPath(tab.path).pathname;
      if (isVoucherNewPath(tabPathname) && tab.key !== key) {
        cacheRef.current.delete(tab.key);
        return false;
      }
      return true;
    });
  }
  if (isVoucherEditPath(pathname)) {
    next = next.filter((tab) => {
      const tabPathname = parseTabPath(tab.path).pathname;
      const isEditTab = tab.key === key || isVoucherEditPath(tab.key) || isVoucherEditPath(tabPathname);
      if (isEditTab && tab.key !== key) {
        cacheRef.current.delete(tab.key);
        return false;
      }
      return true;
    });
  }
  if (isPayrollSheetDetailPath(pathname)) {
    next = next.filter((tab) => {
      const tabPathname = parseTabPath(tab.path).pathname;
      const isDetailTab =
        tab.key === key ||
        tab.key === PAYROLL_SHEET_DETAIL_TAB_KEY ||
        isPayrollSheetDetailPath(tab.key) ||
        isPayrollSheetDetailPath(tabPathname);
      if (isDetailTab && tab.key !== key) {
        cacheRef.current.delete(tab.key);
        return false;
      }
      return true;
    });
  }
  return next;
}

export type PageTab = {
  key: string;
  path: string;
  title: string;
  closable: boolean;
};

type PageTabsContextValue = {
  tabs: PageTab[];
  activeKey: string;
  cacheRef: React.MutableRefObject<Map<string, ReactElement>>;
  tabDataRefreshKeys: Record<string, number>;
  switchTab: (key: string) => void;
  closeTab: (key: string, options?: { fallbackPath?: string }) => void;
  closeTabAndOpen: (closingKey: string, targetPath: string) => void;
  refreshTab: (key: string) => void;
  closeOtherTabs: (key: string) => void;
  closeAllTabs: () => void;
  openPageTab: (targetPath: string, options?: { refresh?: boolean }) => void;
};

const PageTabsContext = createContext<PageTabsContextValue | null>(null);
const TabPaneContext = createContext<string | null>(null);

export function TabPaneProvider({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return <TabPaneContext.Provider value={tabKey}>{children}</TabPaneContext.Provider>;
}

export function useTabPaneKey() {
  return useContext(TabPaneContext);
}

export function useTabDataRefresh() {
  const tabKey = useContext(TabPaneContext);
  const { tabDataRefreshKeys } = usePageTabs();
  if (!tabKey) return 0;
  return tabDataRefreshKeys[tabKey] ?? 0;
}

export function PageTabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const cacheRef = useRef<Map<string, ReactElement>>(new Map());
  const homeTab = useMemo(() => createHomeTab(), []);
  const [tabDataRefreshKeys, setTabDataRefreshKeys] = useState<Record<string, number>>({});
  const [tabs, setTabs] = useState<PageTab[]>(() => {
    const { key, path, pathname } = resolveTabIdentity(location.pathname, location.search);
    if (isHomeTabKey(key)) {
      return [homeTab];
    }
    return ensureHomeTabFirst(
      [
        {
          key,
          path,
          title: resolvePageTabTitleFromKey(key),
          closable: true
        }
      ],
      homeTab
    );
  });

  const activeKey = resolveTabIdentity(location.pathname, location.search).key;

  useEffect(() => {
    const { key, path, pathname } = resolveTabIdentity(location.pathname, location.search);

    setTabs((prev) => {
      let withHome = prev.some((tab) => isHomeTabKey(tab.key)) ? prev : ensureHomeTabFirst(prev, homeTab);
      withHome = removeDuplicateSingletonTabs(withHome, key, pathname, cacheRef);

      const existing = withHome.find((tab) => tab.key === key);
      if (existing) {
        if (existing.path === path) return ensureHomeTabFirst(withHome, homeTab);
        return ensureHomeTabFirst(
          withHome.map((tab) => (tab.key === key ? { ...tab, path } : tab)),
          homeTab
        );
      }

      const nextTab: PageTab = {
        key,
        path,
        title: resolvePageTabTitleFromKey(key),
        closable: true
      };

      let next = ensureHomeTabFirst([...withHome, nextTab], homeTab);
      while (next.length > PAGE_TABS_MAX) {
        const removeIndex = next.findIndex((tab) => tab.closable);
        if (removeIndex < 0) break;
        cacheRef.current.delete(next[removeIndex].key);
        next = next.filter((_, index) => index !== removeIndex);
      }
      return ensureHomeTabFirst(next, homeTab);
    });
  }, [homeTab, location.pathname, location.search]);

  const switchTab = useCallback(
    (key: string) => {
      const tab = tabs.find((item) => item.key === key);
      if (tab) navigate(tab.path);
    },
    [navigate, tabs]
  );

  const closeTab = useCallback(
    (key: string, options?: { fallbackPath?: string }) => {
      if (isHomeTabKey(key)) return;

      let nextPath: string | null = null;
      setTabs((prev) => {
        const index = prev.findIndex((tab) => tab.key === key);
        if (index < 0 || !prev[index].closable) return prev;

        cacheRef.current.delete(key);
        const next = prev.filter((tab) => tab.key !== key);

        if (key === activeKey) {
          nextPath =
            options?.fallbackPath ??
            (next[Math.min(index, next.length - 1)] ?? next[next.length - 1])?.path ??
            '/';
        }

        return next;
      });

      if (nextPath) navigate(nextPath);
    },
    [activeKey, navigate]
  );

  const closeTabAndOpen = useCallback(
    (closingKey: string, targetPath: string) => {
      const { pathname, search } = parseTabPath(targetPath);
      const target = resolveTabIdentity(pathname, search);
      const keysToClose = new Set<string>();
      if (!isHomeTabKey(closingKey)) keysToClose.add(closingKey);
      if (!isHomeTabKey(activeKey)) keysToClose.add(activeKey);

      setTabs((prev) => {
        let next = prev.filter((tab) => {
          if (!keysToClose.has(tab.key) || !tab.closable) return true;
          cacheRef.current.delete(tab.key);
          return false;
        });

        if (!next.some((tab) => tab.key === target.key)) {
          next = [
            ...next,
            {
              key: target.key,
              path: target.path,
              title: resolvePageTabTitleFromKey(target.key),
              closable: true
            }
          ];
        }

        return ensureHomeTabFirst(next, homeTab);
      });

      setTabDataRefreshKeys((prev) => ({ ...prev, [target.key]: (prev[target.key] || 0) + 1 }));
      navigate(target.path);
    },
    [activeKey, homeTab, navigate]
  );

  const refreshTab = useCallback((key: string) => {
    setTabDataRefreshKeys((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  }, []);

  const openPageTab = useCallback(
    (targetPath: string, options?: { refresh?: boolean }) => {
      const { pathname, search } = parseTabPath(targetPath);
      const identity = resolveTabIdentity(pathname, search);
      const shouldRefresh = options?.refresh !== false;
      let tabExisted = false;

      setTabs((prev) => {
        let withHome = prev.some((tab) => isHomeTabKey(tab.key)) ? prev : ensureHomeTabFirst(prev, homeTab);
        withHome = removeDuplicateSingletonTabs(withHome, identity.key, pathname, cacheRef);

        tabExisted = withHome.some((tab) => tab.key === identity.key);

        const existing = withHome.find((tab) => tab.key === identity.key);
        if (existing) {
          return ensureHomeTabFirst(
            withHome.map((tab) =>
              tab.key === identity.key ? { ...tab, path: identity.path } : tab
            ),
            homeTab
          );
        }

        const nextTab: PageTab = {
          key: identity.key,
          path: identity.path,
          title: resolvePageTabTitleFromKey(identity.key),
          closable: true
        };

        let next = ensureHomeTabFirst([...withHome, nextTab], homeTab);
        while (next.length > PAGE_TABS_MAX) {
          const removeIndex = next.findIndex((tab) => tab.closable);
          if (removeIndex < 0) break;
          cacheRef.current.delete(next[removeIndex].key);
          next = next.filter((_, index) => index !== removeIndex);
        }
        return ensureHomeTabFirst(next, homeTab);
      });

      if (tabExisted && shouldRefresh) {
        const currentPath = `${location.pathname}${location.search}`;
        if (currentPath !== identity.path) {
          navigate(identity.path);
          if (
            identity.key === VOUCHER_NEW_TAB_KEY ||
            identity.key === PAYROLL_SHEET_DETAIL_TAB_KEY
          ) {
            queueMicrotask(() => refreshTab(identity.key));
          }
          return;
        }
        refreshTab(identity.key);
        return;
      }
      navigate(identity.path);
    },
    [homeTab, location.pathname, location.search, navigate, refreshTab]
  );

  const closeOtherTabs = useCallback(
    (key: string) => {
      setTabs((prev) => {
        const removed = prev.filter((tab) => tab.key !== key && tab.closable);
        removed.forEach((tab) => cacheRef.current.delete(tab.key));
        return ensureHomeTabFirst(
          prev.filter((tab) => tab.key === key || !tab.closable),
          homeTab
        );
      });
      if (activeKey !== key) {
        const tab = tabs.find((item) => item.key === key);
        if (tab) navigate(tab.path);
      }
    },
    [activeKey, homeTab, navigate, tabs]
  );

  const closeAllTabs = useCallback(() => {
    setTabs((prev) => {
      prev.forEach((tab) => {
        if (tab.closable) cacheRef.current.delete(tab.key);
      });
      return ensureHomeTabFirst(
        prev.filter((tab) => !tab.closable),
        homeTab
      );
    });
    navigate('/');
  }, [homeTab, navigate]);

  const value = useMemo(
    () => ({
      tabs,
      activeKey,
      cacheRef,
      tabDataRefreshKeys,
      switchTab,
      closeTab,
      closeTabAndOpen,
      refreshTab,
      closeOtherTabs,
      closeAllTabs,
      openPageTab
    }),
    [tabs, activeKey, tabDataRefreshKeys, switchTab, closeTab, closeTabAndOpen, refreshTab, closeOtherTabs, closeAllTabs, openPageTab]
  );

  return <PageTabsContext.Provider value={value}>{children}</PageTabsContext.Provider>;
}

export function usePageTabs() {
  const ctx = useContext(PageTabsContext);
  if (!ctx) {
    throw new Error('usePageTabs must be used within PageTabsProvider');
  }
  return ctx;
}
