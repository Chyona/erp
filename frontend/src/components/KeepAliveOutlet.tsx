import { useOutlet } from 'react-router-dom';
import { TabPaneProvider, usePageTabs } from '../context/PageTabsContext';

export default function KeepAliveOutlet() {
  const outlet = useOutlet();
  const { tabs, activeKey, cacheRef } = usePageTabs();

  return (
    <div className="page-tabs-content">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        if (isActive && outlet) {
          cacheRef.current.set(tab.key, outlet);
        }
        const content = isActive ? outlet ?? cacheRef.current.get(tab.key) : cacheRef.current.get(tab.key);
        if (!content) return null;
        return (
          <div
            key={tab.key}
            className={`page-tab-pane${isActive ? ' page-tab-pane--active' : ''}`}
            aria-hidden={!isActive}
          >
            <TabPaneProvider tabKey={tab.key}>{content}</TabPaneProvider>
          </div>
        );
      })}
    </div>
  );
}
