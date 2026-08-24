import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AuditOutlined,
  BookOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FundOutlined,
  ReadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  buildNavMenu,
  isNavGroupActive,
  resolveNavActiveKey,
  type NavAction,
  type NavMenuEntry,
  type NavMenuGroup
} from '../constants/navMenu';
import { useAuth } from '../context/AuthContext';

const GROUP_ICONS: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  voucher: <FileTextOutlined />,
  ledger: <ReadOutlined />,
  reports: <FundOutlined />,
  system: <SettingOutlined />
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  凭证处理: <FileTextOutlined />,
  账簿查询: <ReadOutlined />,
  基础资料: <BookOutlined />,
  操作记录: <AuditOutlined />,
  系统管理: <SettingOutlined />
};

const ACTION_ICONS: Partial<Record<NavAction, React.ReactNode>> = {
  backup: <CloudDownloadOutlined />,
  restore: <CloudUploadOutlined />
};

type AppSidebarProps = {
  collapsed: boolean;
  theme: 'dark' | 'light';
  onBackup: () => void;
  onRestore: () => void;
};

export default function AppSidebar({ collapsed, theme, onBackup, onRestore }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuth();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [flyoutTop, setFlyoutTop] = useState(0);
  const hideTimerRef = useRef<number | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const menuEntries = useMemo(() => buildNavMenu(can), [can]);
  const activeKey = resolveNavActiveKey(location.pathname);

  const activeGroupKey = useMemo(() => {
    const group = menuEntries.find(
      (entry): entry is NavMenuGroup => entry.type === 'group' && isNavGroupActive(entry, activeKey)
    );
    return group?.key ?? null;
  }, [menuEntries, activeKey]);

  const hoveredGroup = useMemo(() => {
    if (!hoverKey) return null;
    const entry = menuEntries.find((item) => item.key === hoverKey);
    return entry?.type === 'group' ? entry : null;
  }, [hoverKey, menuEntries]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setHoverKey(null), 160);
  }, [clearHideTimer]);

  const openFlyout = useCallback(
    (key: string) => {
      clearHideTimer();
      const el = itemRefs.current.get(key);
      if (el) {
        const rect = el.getBoundingClientRect();
        setFlyoutTop(Math.max(72, Math.min(rect.top, window.innerHeight - 280)));
      }
      setHoverKey(key);
    },
    [clearHideTimer]
  );

  const handleLeafClick = (path?: string, action?: NavAction) => {
    if (action === 'backup') {
      onBackup();
      setHoverKey(null);
      return;
    }
    if (action === 'restore') {
      onRestore();
      setHoverKey(null);
      return;
    }
    if (path) {
      navigate(path);
      setHoverKey(null);
    }
  };

  const renderNavButton = (entry: NavMenuEntry) => {
    const icon = GROUP_ICONS[entry.key] ?? <SettingOutlined />;
    const isLink = entry.type === 'link';
    const isActive = isLink
      ? activeKey === entry.path
      : entry.key === activeGroupKey || entry.key === hoverKey;

    return (
      <button
        key={entry.key}
        type="button"
        ref={(node) => {
          if (node) itemRefs.current.set(entry.key, node);
          else itemRefs.current.delete(entry.key);
        }}
        className={`sidebar-nav__item${isActive ? ' sidebar-nav__item--active' : ''}`}
        title={entry.label}
        onMouseEnter={() => {
          if (entry.type === 'group') openFlyout(entry.key);
          else clearHideTimer();
        }}
        onMouseLeave={() => {
          if (entry.type === 'group') scheduleHide();
        }}
        onClick={() => {
          if (entry.type === 'link') {
            navigate(entry.path);
            setHoverKey(null);
          } else {
            openFlyout(entry.key);
          }
        }}
      >
        <span className="sidebar-nav__icon">{icon}</span>
        {!collapsed ? <span className="sidebar-nav__label">{entry.label}</span> : null}
      </button>
    );
  };

  const flyoutLeft = collapsed ? 'var(--app-sider-collapsed-width)' : 'var(--app-sider-width)';

  const flyout =
    hoveredGroup && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="sidebar-nav-flyout"
            style={{ top: flyoutTop, left: flyoutLeft }}
            onMouseEnter={clearHideTimer}
            onMouseLeave={scheduleHide}
          >
            {hoveredGroup.sections.map((section) => (
              <div key={section.title} className="sidebar-nav-flyout__column">
                <div className="sidebar-nav-flyout__title">
                  <span className="sidebar-nav-flyout__title-icon">
                    {SECTION_ICONS[section.title] ?? <SettingOutlined />}
                  </span>
                  {section.title}
                </div>
                <div className="sidebar-nav-flyout__links">
                  {section.items.map((item) => {
                    const isItemActive = item.path === activeKey;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`sidebar-nav-flyout__link${isItemActive ? ' sidebar-nav-flyout__link--active' : ''}`}
                        onClick={() => handleLeafClick(item.path, item.action)}
                      >
                        {item.action ? (
                          <span className="sidebar-nav-flyout__link-icon">
                            {ACTION_ICONS[item.action]}
                          </span>
                        ) : null}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <nav className={`sidebar-nav sidebar-nav--${theme}`} aria-label="主导航">
      {menuEntries.map(renderNavButton)}
      {flyout}
    </nav>
  );
}
