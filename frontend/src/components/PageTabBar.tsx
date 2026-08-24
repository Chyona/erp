import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import { usePageTabs } from '../context/PageTabsContext';

export default function PageTabBar() {
  const { tabs, activeKey, switchTab, closeTab, closeOtherTabs, closeAllTabs } = usePageTabs();

  if (tabs.length === 0) return null;

  const closableCount = tabs.filter((tab) => tab.closable).length;

  const menuItems: MenuProps['items'] = [
    {
      key: 'close-others',
      label: '关闭其他',
      disabled: closableCount <= 1,
      onClick: () => closeOtherTabs(activeKey)
    },
    {
      key: 'close-all',
      label: '关闭全部',
      disabled: closableCount === 0,
      onClick: () => closeAllTabs()
    }
  ];

  return (
    <div className="page-tab-bar">
      <div className="page-tab-bar__list" role="tablist">
        {tabs.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <div
              key={tab.key}
              role="tab"
              aria-selected={active}
              className={`page-tab-bar__item${active ? ' page-tab-bar__item--active' : ''}`}
              onClick={() => switchTab(tab.key)}
            >
              <span className="page-tab-bar__label" title={tab.title}>
                {tab.title}
              </span>
              {tab.closable ? (
                <button
                  type="button"
                  className="page-tab-bar__close"
                  aria-label={`关闭 ${tab.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.key);
                  }}
                >
                  <CloseOutlined />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
        <button type="button" className="page-tab-bar__more" aria-label="标签页操作">
          <MoreOutlined />
        </button>
      </Dropdown>
    </div>
  );
}
