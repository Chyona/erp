import { useOutlet } from 'react-router-dom';
import { TabPaneProvider, usePageTabs } from '../context/PageTabsContext';

export default function KeepAliveOutlet() {
  const outlet = useOutlet();
  const { tabs, activeKey, cacheRef } = usePageTabs();

  if (outlet) {
    cacheRef.current.set(activeKey, outlet);
  }

  return (
    <div className="page-tabs-content">
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        let content = cacheRef.current.get(tab.key);
        if (!content && isActive) content = outlet;
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
