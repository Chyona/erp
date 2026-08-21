/**
 * ERP Mock 内存仓库：模拟后端五个 store + init/export/import。
 * 仅用于 Vite 开发服务器，进程内有效，刷新页面数据仍在（直到重启 vite）。
 */

export type MockAccount = {
  id: string;
  code: string;
  name: string;
  category: string;
  direction: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MockVoucher = Record<string, unknown> & { id: string };

export type MockAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  uploadedAt: string;
};

export type MockAuditLog = {
  id: string;
  timestamp: string;
  action: string;
  target: string;
  details: string;
  userAgent: string;
};

export type MockSetting = {
  key: string;
  value: unknown;
};

/** 与后端 default_accounts.json / 前端 DEFAULT_ACCOUNTS 保持一致的默认科目。 */
const DEFAULT_ACCOUNTS: Omit<MockAccount, 'id' | 'createdAt'>[] = [
  { code: '1002', name: '银行存款', category: '资产', direction: 'debit' },
  { code: '1122', name: '应收账款', category: '资产', direction: 'debit' },
  { code: '1221', name: '其他应收款', category: '资产', direction: 'debit' },
  { code: '1601', name: '固定资产', category: '资产', direction: 'debit' },
  { code: '1602', name: '累计折旧', category: '资产', direction: 'credit' },
  { code: '2202', name: '应付账款', category: '负债', direction: 'credit' },
  { code: '2211', name: '应付职工薪酬', category: '负债', direction: 'credit' },
  { code: '2221', name: '应交税费', category: '负债', direction: 'credit' },
  { code: '2241', name: '其他应付款', category: '负债', direction: 'credit' },
  { code: '3001', name: '实收资本', category: '所有者权益', direction: 'credit' },
  { code: '3103', name: '本年利润', category: '所有者权益', direction: 'credit' },
  { code: '3104', name: '利润分配', category: '所有者权益', direction: 'credit' },
  { code: '4301', name: '研发支出', category: '成本', direction: 'debit' },
  { code: '5001', name: '主营业务收入', category: '损益', direction: 'credit' },
  { code: '5301', name: '营业外收入', category: '损益', direction: 'credit' },
  { code: '5401', name: '主营业务成本', category: '损益', direction: 'debit' },
  { code: '5403', name: '税金及附加', category: '损益', direction: 'debit' },
  { code: '5602', name: '管理费用', category: '损益', direction: 'debit' },
  { code: '5603', name: '财务费用', category: '损益', direction: 'debit' },
  { code: '5711', name: '营业外支出', category: '损益', direction: 'debit' },
  { code: '5801', name: '所得税费用', category: '损益', direction: 'debit' }
];

function nowISO(): string {
  return new Date().toISOString();
}

/** 生成业务主键（UUID v4），与后端 / 前端 DB.generateId 一致。 */
export function mockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class ErpMockStore {
  accounts = new Map<string, MockAccount>();
  vouchers = new Map<string, MockVoucher>();
  attachments = new Map<string, MockAttachment>();
  auditLogs = new Map<string, MockAuditLog>();
  settings = new Map<string, MockSetting>();

  constructor() {
    this.seedDefaultAccounts();
    this.settings.set('companyName', { key: 'companyName', value: 'Mock 演示公司' });
  }

  /** 写入默认会计科目（若编码已存在则跳过）。 */
  seedDefaultAccounts(): void {
    const byCode = new Map([...this.accounts.values()].map((a) => [a.code, a]));
    const ts = nowISO();
    for (const def of DEFAULT_ACCOUNTS) {
      if (byCode.has(def.code)) continue;
      const id = mockId();
      this.accounts.set(id, { id, ...def, createdAt: ts });
    }
  }

  /** 应用启动初始化：补齐科目并返回前端 AppInit 期望结构。 */
  appInit(): {
    companyName: string;
    accounts: MockAccount[];
    repaired: number;
    syncedLocks: number;
  } {
    this.seedDefaultAccounts();
    const company = this.settings.get('companyName');
    return {
      companyName: typeof company?.value === 'string' ? company.value : '',
      accounts: [...this.accounts.values()].sort((a, b) => a.code.localeCompare(b.code)),
      repaired: 0,
      syncedLocks: 0
    };
  }

  exportAll() {
    return {
      version: 1,
      exportedAt: nowISO(),
      vouchers: [...this.vouchers.values()],
      accounts: [...this.accounts.values()],
      auditLogs: [...this.auditLogs.values()],
      settings: [...this.settings.values()],
      attachments: [...this.attachments.values()]
    };
  }

  importAll(data: {
    vouchers?: MockVoucher[];
    accounts?: MockAccount[];
    auditLogs?: MockAuditLog[];
    settings?: MockSetting[];
    attachments?: MockAttachment[];
  }): void {
    this.vouchers.clear();
    this.accounts.clear();
    this.auditLogs.clear();
    this.settings.clear();
    this.attachments.clear();
    for (const v of data.vouchers ?? []) this.vouchers.set(v.id, v);
    for (const a of data.accounts ?? []) this.accounts.set(a.id, a);
    for (const l of data.auditLogs ?? []) this.auditLogs.set(l.id, l);
    for (const s of data.settings ?? []) this.settings.set(s.key, s);
    for (const f of data.attachments ?? []) this.attachments.set(f.id, f);
  }
}

/** 进程级单例，保证热更新中间件复用同一份数据。 */
export const erpMockStore = new ErpMockStore();
