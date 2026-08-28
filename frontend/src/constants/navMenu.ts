import type { Permission } from '../utils/permissions';

export type NavLinkItem = {
  key: string;
  label: string;
  path?: string;
  permission?: Permission;
};

export type NavSection = {
  title: string;
  items: NavLinkItem[];
};

export type NavMenuLink = {
  type: 'link';
  key: string;
  label: string;
  path: string;
};

export type NavMenuGroup = {
  type: 'group';
  key: string;
  label: string;
  sections: NavSection[];
};

export type NavMenuEntry = NavMenuLink | NavMenuGroup;

type CanFn = (permission: Permission) => boolean;

function filterSectionItems(items: NavLinkItem[], can: CanFn) {
  return items.filter((item) => !item.permission || can(item.permission));
}

function filterSections(sections: NavSection[], can: CanFn): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: filterSectionItems(section.items, can)
    }))
    .filter((section) => section.items.length > 0);
}

export function buildNavMenu(can: CanFn): NavMenuEntry[] {
  const entries: NavMenuEntry[] = [];

  const voucherItems: NavLinkItem[] = [];
  if (can('voucher.create')) {
    voucherItems.push({ key: '/vouchers/new', label: '录凭证', path: '/vouchers/new' });
  }
  voucherItems.push({ key: '/vouchers', label: '查凭证', path: '/vouchers' });
  if (voucherItems.length) {
    entries.push({
      type: 'group',
      key: 'voucher',
      label: '凭证',
      sections: [{ title: '凭证处理', items: voucherItems }]
    });
  }

  entries.push({
    type: 'group',
    key: 'ledger',
    label: '账簿',
    sections: [
      {
        title: '账簿查询',
        items: [
          { key: '/ledger', label: '明细账', path: '/ledger' },
          { key: '/general-ledger', label: '总账', path: '/general-ledger' },
        ]
      }
    ]
  });

  if (can('closing.view')) {
    entries.push({
      type: 'group',
      key: 'closing',
      label: '结账',
      sections: [
        {
          title: '结账处理',
          items: [
            { key: '/closing/period-end', label: '季末结转', path: '/closing/period-end' },
            { key: '/closing/reimbursement', label: '月底报销', path: '/closing/reimbursement' }
          ]
        }
      ]
    });
  }

  entries.push({ type: 'link', key: 'reports', label: '报表', path: '/reports' });

  if (can('closing.view')) {
    entries.push({
      type: 'group',
      key: 'payroll',
      label: '工资',
      sections: [
        {
          title: '日常业务',
          items: [
            { key: '/payroll/sheet', label: '工资表', path: '/payroll/sheet' },
            { key: '/payroll/stats', label: '人力成本', path: '/payroll/stats' }
          ]
        },
        {
          title: '基础资料',
          items: [{ key: '/payroll/staff', label: '部门职员', path: '/payroll/staff' }]
        }
      ]
    });
  }

  const systemSections: NavSection[] = [
    {
      title: '基础资料',
      items: [{ key: '/accounts', label: '会计科目', path: '/accounts' }]
    },
    {
      title: '操作记录',
      items: [{ key: '/audit', label: '操作日志', path: '/audit', permission: 'audit.view' }]
    }
  ];

  const adminItems: NavLinkItem[] = [];
  if (can('users')) {
    adminItems.push({ key: '/users', label: '用户管理', path: '/users' });
  }
  if (can('settings')) {
    adminItems.push({ key: '/settings', label: '系统设置', path: '/settings' });
  }
  if (can('backup') || can('restore')) {
    adminItems.push({ key: '/backup-restore', label: '备份与恢复', path: '/backup-restore' });
  }
  if (adminItems.length) {
    systemSections.push({ title: '系统管理', items: adminItems });
  }

  const filteredSystemSections = filterSections(systemSections, can);
  if (filteredSystemSections.length) {
    entries.push({
      type: 'group',
      key: 'system',
      label: '设置',
      sections: filteredSystemSections
    });
  }

  return entries;
}

export function resolveNavActiveKey(pathname: string): string {
  if (pathname.includes('/edit') || pathname.startsWith('/vouchers/new')) {
    return '/vouchers/new';
  }
  if (pathname.startsWith('/vouchers')) return '/vouchers';
  if (pathname.startsWith('/general-ledger')) return '/general-ledger';
  if (pathname.startsWith('/ledger')) return '/ledger';
  if (pathname.startsWith('/reports')) return '/reports';
  if (pathname.startsWith('/payroll/staff')) return '/payroll/staff';
  if (pathname.startsWith('/payroll/stats')) return '/payroll/stats';
  if (pathname.startsWith('/payroll/sheet/')) return '/payroll/sheet';
  if (pathname.startsWith('/payroll/sheet') || pathname === '/payroll') return '/payroll/sheet';
  if (pathname.startsWith('/closing/reimbursement')) return '/closing/reimbursement';
  if (pathname.startsWith('/closing/period-end')) return '/closing/period-end';
  if (pathname.startsWith('/closing')) return '/closing/period-end';
  if (pathname.startsWith('/accounts')) return '/accounts';
  if (pathname.startsWith('/audit')) return '/audit';
  if (pathname.startsWith('/users')) return '/users';
  if (pathname.startsWith('/settings')) return '/settings';
  if (pathname.startsWith('/backup-restore')) return '/backup-restore';
  if (pathname === '/') return '/';
  return pathname;
}

export function isNavGroupActive(entry: NavMenuGroup, activeKey: string) {
  return entry.sections.some((section) =>
    section.items.some((item) => item.path === activeKey)
  );
}
