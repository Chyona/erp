/**
 * 默认会计科目（深圳市逗趣科技有限责任公司科目表）
 */
export const DEFAULT_ACCOUNTS = [
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
