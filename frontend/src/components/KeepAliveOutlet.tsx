import { useOutlet } from 'react-router-dom';
import { usePageTabs } from '../context/PageTabsContext';

export default function KeepAliveOutlet() {
  const outlet = useOutlet();
  const { tabs, activeKey, cacheRef } = usePageTabs();

  if (outlet) {
    cacheRef.current.set(activeKey, outlet);
  }

  return (
    <div className="page-tabs-content">
      {tabs.map((tab) => {
        const cached = cacheRef.current.get(tab.key);
        if (!cached) return null;
        const active = tab.key === activeKey;
        return (
          <div
            key={tab.key}
            className={`page-tab-pane${active ? ' page-tab-pane--active' : ''}`}
            aria-hidden={!active}
          >
            {cached}
          </div>
        );
      })}
    </div>
  );
}
