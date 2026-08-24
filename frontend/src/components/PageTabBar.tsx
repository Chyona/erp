import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { CloseOutlined, DownOutlined, HomeOutlined } from '@ant-design/icons';
import { usePageTabs } from '../context/PageTabsContext';
import { isHomeTabKey } from '../utils/pageTabs';

export default function PageTabBar() {
  const { tabs, activeKey, switchTab, closeTab, refreshTab, closeOtherTabs, closeAllTabs } =
    usePageTabs();

  if (tabs.length === 0) return null;

  const activeTab = tabs.find((tab) => tab.key === activeKey);
  const closableCount = tabs.filter((tab) => tab.closable).length;

  const menuItems: MenuProps['items'] = [
    {
      key: 'refresh-current',
      label: '刷新当前页',
      onClick: () => refreshTab(activeKey)
    },
    {
      key: 'close-current',
      label: '关闭当前页',
      disabled: !activeTab?.closable,
      onClick: () => closeTab(activeKey)
    },
    { type: 'divider' },
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
      <div className="page-tab-bar__scroll">
        <div className="page-tab-bar__list" role="tablist">
          {tabs.map((tab) => {
            const active = tab.key === activeKey;
            const isHome = isHomeTabKey(tab.key);
            return (
              <div
                key={tab.key}
                role="tab"
                aria-selected={active}
                aria-label={isHome ? tab.title : undefined}
                className={`page-tab-bar__item${active ? ' page-tab-bar__item--active' : ''}${
                  isHome ? ' page-tab-bar__item--home' : ''
                }`}
                onClick={() => switchTab(tab.key)}
              >
                {isHome ? (
                  <span className="page-tab-bar__home-icon" aria-hidden>
                    <HomeOutlined />
                  </span>
                ) : (
                  <span className="page-tab-bar__label">{tab.title}</span>
                )}
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
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomLeft">
          <button type="button" className="page-tab-bar__more" aria-label="标签页操作">
            <DownOutlined />
          </button>
        </Dropdown>
      </div>
    </div>
  );
}
