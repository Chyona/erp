import { useCallback, useMemo, useRef, useState } from 'react';
import ClosingNavIcon from './icons/ClosingNavIcon';
import {
  AccountBookFilled,
  AccountBookOutlined,
  AuditOutlined,
  BookOutlined,
  FileTextFilled,
  FileTextOutlined,
  FundFilled,
  FundOutlined,
  SettingFilled,
  SettingOutlined
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  buildNavMenu,
  isNavGroupActive,
  resolveNavActiveKey,
  type NavMenuEntry,
  type NavMenuGroup
} from '../constants/navMenu';
import { useAuth } from '../context/AuthContext';
import EllipsisText from './EllipsisText';

type NavIconSet = {
  outline: React.ReactNode;
  filled: React.ReactNode;
};

const GROUP_ICONS: Record<string, NavIconSet> = {
  voucher: { outline: <FileTextOutlined />, filled: <FileTextFilled /> },
  ledger: { outline: <AccountBookOutlined />, filled: <AccountBookFilled /> },
  reports: { outline: <FundOutlined />, filled: <FundFilled /> },
  closing: { outline: <ClosingNavIcon />, filled: <ClosingNavIcon filled /> },
  system: { outline: <SettingOutlined />, filled: <SettingFilled /> }
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  凭证处理: <FileTextOutlined />,
  账簿查询: <AccountBookOutlined />,
  结项处理: <ClosingNavIcon />,
  基础资料: <BookOutlined />,
  操作记录: <AuditOutlined />,
  系统管理: <SettingOutlined />
};

function NavIcon({ icons, active }: { icons: NavIconSet; active: boolean }) {
  return (
    <span className={`sidebar-nav__icon${active ? ' sidebar-nav__icon--filled' : ''}`}>
      {active ? icons.filled : icons.outline}
    </span>
  );
}

type AppSidebarProps = {
  collapsed: boolean;
  theme: 'dark' | 'light';
};

export default function AppSidebar({ collapsed, theme }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = useAuth();
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
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
    if (!highlightKey) return null;
    const entry = menuEntries.find((item) => item.key === highlightKey);
    return entry?.type === 'group' ? entry : null;
  }, [highlightKey, menuEntries]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => setHighlightKey(null), 160);
  }, [clearHideTimer]);

  const openFlyout = useCallback(
    (key: string) => {
      clearHideTimer();
      const el = itemRefs.current.get(key);
      if (el) {
        const rect = el.getBoundingClientRect();
        setFlyoutTop(Math.max(72, Math.min(rect.top, window.innerHeight - 280)));
      }
      setHighlightKey(key);
    },
    [clearHideTimer]
  );

  const handleLeafClick = (path?: string) => {
    if (path) {
      navigate(path);
      setHighlightKey(null);
    }
  };

  const renderNavButton = (entry: NavMenuEntry) => {
    const icons = GROUP_ICONS[entry.key] ?? GROUP_ICONS.system;
    const isLink = entry.type === 'link';
    const isActive = isLink
      ? activeKey === entry.path
      : entry.key === activeGroupKey || entry.key === highlightKey;
    const isHighlighted = isActive || highlightKey === entry.key;

    return (
      <button
        key={entry.key}
        type="button"
        ref={(node) => {
          if (node) itemRefs.current.set(entry.key, node);
          else itemRefs.current.delete(entry.key);
        }}
        className={`sidebar-nav__item${isHighlighted ? ' sidebar-nav__item--highlight' : ''}${
          isActive ? ' sidebar-nav__item--active' : ''
        }`}
        onMouseEnter={() => {
          if (entry.type === 'group') openFlyout(entry.key);
          else {
            clearHideTimer();
            setHighlightKey(entry.key);
          }
        }}
        onMouseLeave={() => {
          if (entry.type === 'group') scheduleHide();
          else setHighlightKey(null);
        }}
        onClick={() => {
          if (entry.type === 'link') {
            navigate(entry.path);
            setHighlightKey(null);
          } else {
            openFlyout(entry.key);
          }
        }}
      >
        <NavIcon icons={icons} active={isHighlighted} />
        {!collapsed ? (
          <EllipsisText className="sidebar-nav__label" tooltip={entry.label}>
            {entry.label}
          </EllipsisText>
        ) : null}
      </button>
    );
  };

  const flyoutLeft = collapsed ? 'var(--app-sider-collapsed-width)' : 'var(--app-sider-width)';

  const flyout =
    hoveredGroup && typeof document !== 'undefined'
      ? createPortal(
          <div
            className={`sidebar-nav-flyout${
              hoveredGroup.sections.length > 1 ? ' sidebar-nav-flyout--multi' : ''
            }`}
            style={{ top: flyoutTop, left: `calc(${flyoutLeft} + 8px)` }}
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
                        onClick={() => handleLeafClick(item.path)}
                      >
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
      <div className="sidebar-nav__main">{menuEntries.map(renderNavButton)}</div>
      {flyout}
    </nav>
  );
}
