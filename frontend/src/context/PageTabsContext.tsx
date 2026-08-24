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
  switchTab: (key: string) => void;
  closeTab: (key: string) => void;
  closeOtherTabs: (key: string) => void;
  closeAllTabs: () => void;
  updateTabTitle: (key: string, title: string) => void;
};

const PageTabsContext = createContext<PageTabsContextValue | null>(null);

export function PageTabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const cacheRef = useRef<Map<string, ReactElement>>(new Map());
  const [tabs, setTabs] = useState<PageTab[]>(() => {
    const key = getTabKey(location.pathname, location.search);
    return [
      {
        key,
        path: `${location.pathname}${location.search}`,
        title: resolvePageTabTitle(location.pathname),
        closable: !isHomeTabKey(key)
      }
    ];
  });

  const activeKey = getTabKey(location.pathname, location.search);

  useEffect(() => {
    const key = getTabKey(location.pathname, location.search);
    const path = `${location.pathname}${location.search}`;

    setTabs((prev) => {
      const existing = prev.find((tab) => tab.key === key);
      if (existing) {
        if (existing.path === path) return prev;
        return prev.map((tab) => (tab.key === key ? { ...tab, path } : tab));
      }

      const nextTab: PageTab = {
        key,
        path,
        title: resolvePageTabTitle(location.pathname),
        closable: !isHomeTabKey(key)
      };

      let next = [...prev, nextTab];
      while (next.length > PAGE_TABS_MAX) {
        const removeIndex = next.findIndex((tab) => tab.closable);
        if (removeIndex < 0) break;
        cacheRef.current.delete(next[removeIndex].key);
        next = next.filter((_, index) => index !== removeIndex);
      }
      return next;
    });
  }, [location.pathname, location.search]);

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

  const closeOtherTabs = useCallback(
    (key: string) => {
      setTabs((prev) => {
        const removed = prev.filter((tab) => tab.key !== key && tab.closable);
        removed.forEach((tab) => cacheRef.current.delete(tab.key));
        return prev.filter((tab) => tab.key === key || !tab.closable);
      });
      if (activeKey !== key) {
        const tab = tabs.find((item) => item.key === key);
        if (tab) navigate(tab.path);
      }
    },
    [activeKey, navigate, tabs]
  );

  const closeAllTabs = useCallback(() => {
    setTabs((prev) => {
      prev.forEach((tab) => {
        if (tab.closable) cacheRef.current.delete(tab.key);
      });
      return prev.filter((tab) => !tab.closable);
    });
    navigate('/');
  }, [navigate]);

  const updateTabTitle = useCallback((key: string, title: string) => {
    setTabs((prev) => prev.map((tab) => (tab.key === key ? { ...tab, title } : tab)));
  }, []);

  const value = useMemo(
    () => ({
      tabs,
      activeKey,
      cacheRef,
      switchTab,
      closeTab,
      closeOtherTabs,
      closeAllTabs,
      updateTabTitle
    }),
    [tabs, activeKey, switchTab, closeTab, closeOtherTabs, closeAllTabs, updateTabTitle]
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
