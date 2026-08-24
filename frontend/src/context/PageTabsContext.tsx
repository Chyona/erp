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
  resolvePageTabTitle
} from '../utils/pageTabs';

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
  closeTab: (key: string) => void;
  refreshTab: (key: string) => void;
  closeOtherTabs: (key: string) => void;
  closeAllTabs: () => void;
  updateTabTitle: (key: string, title: string) => void;
};

const PageTabsContext = createContext<PageTabsContextValue | null>(null);
const TabPaneContext = createContext<string | null>(null);

export function TabPaneProvider({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return <TabPaneContext.Provider value={tabKey}>{children}</TabPaneContext.Provider>;
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
    const key = getTabKey(location.pathname, location.search);
    if (isHomeTabKey(key)) {
      return [homeTab];
    }
    return ensureHomeTabFirst(
      [
        {
          key,
          path: `${location.pathname}${location.search}`,
          title: resolvePageTabTitle(location.pathname),
          closable: true
        }
      ],
      homeTab
    );
  });

  const activeKey = getTabKey(location.pathname, location.search);

  useEffect(() => {
    const key = getTabKey(location.pathname, location.search);
    const path = `${location.pathname}${location.search}`;

    setTabs((prev) => {
      const withHome = prev.some((tab) => isHomeTabKey(tab.key)) ? prev : ensureHomeTabFirst(prev, homeTab);
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
        title: resolvePageTabTitle(location.pathname),
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
    (key: string) => {
      if (isHomeTabKey(key)) return;

      let nextPath: string | null = null;
      setTabs((prev) => {
        const index = prev.findIndex((tab) => tab.key === key);
        if (index < 0 || !prev[index].closable) return prev;

        cacheRef.current.delete(key);
        const next = prev.filter((tab) => tab.key !== key);

        if (key === activeKey) {
          const fallback = next[Math.min(index, next.length - 1)] ?? next[next.length - 1];
          nextPath = fallback?.path ?? '/';
        }

        return next;
      });

      if (nextPath) navigate(nextPath);
    },
    [activeKey, navigate]
  );

  const refreshTab = useCallback((key: string) => {
    setTabDataRefreshKeys((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  }, []);

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

  const updateTabTitle = useCallback((key: string, title: string) => {
    setTabs((prev) => prev.map((tab) => (tab.key === key ? { ...tab, title } : tab)));
  }, []);

  const value = useMemo(
    () => ({
      tabs,
      activeKey,
      cacheRef,
      tabDataRefreshKeys,
      switchTab,
      closeTab,
      refreshTab,
      closeOtherTabs,
      closeAllTabs,
      updateTabTitle
    }),
    [tabs, activeKey, tabDataRefreshKeys, switchTab, closeTab, refreshTab, closeOtherTabs, closeAllTabs, updateTabTitle]
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
