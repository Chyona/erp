/** 小企业会计准则资产负债表模板（图例 1:1） */

export const BALANCE_SHEET_ASSETS = [
  { type: 'section', label: '流动资产：' },
  { type: 'item', key: 'cash', label: '货币资金', row: 1, codes: ['1002'] },
  { type: 'item', key: 'shortInvest', label: '短期投资', row: 2, codes: [] },
  { type: 'item', key: 'notesReceivable', label: '应收票据', row: 3, codes: [] },
  { type: 'item', key: 'accountsReceivable', label: '应收账款', row: 4, codes: ['1122'] },
  { type: 'item', key: 'prepayments', label: '预付款项', row: 5, codes: [] },
  { type: 'item', key: 'dividendsReceivable', label: '应收股利', row: 6, codes: [] },
  { type: 'item', key: 'interestReceivable', label: '应收利息', row: 7, codes: [] },
  { type: 'item', key: 'otherReceivables', label: '其他应收款', row: 8, codes: ['1221'] },
  { type: 'item', key: 'inventory', label: '存货', row: 9, codes: [] },
  { type: 'detail', key: 'rawMaterials', label: '其中：原材料', row: 10, codes: [] },
  { type: 'detail', key: 'workInProgress', label: '在产品', row: 11, codes: [] },
  { type: 'detail', key: 'finishedGoods', label: '库存商品', row: 12, codes: [] },
  { type: 'detail', key: 'turnoverMaterials', label: '周转材料', row: 13, codes: [] },
  { type: 'item', key: 'otherCurrentAssets', label: '其他流动资产', row: 14, codes: [] },
  {
    type: 'subtotal',
    key: 'currentAssetsTotal',
    label: '流动资产合计',
    row: 15,
    sumKeys: [
      'cash',
      'shortInvest',
      'notesReceivable',
      'accountsReceivable',
      'prepayments',
      'dividendsReceivable',
      'interestReceivable',
      'otherReceivables',
      'inventory',
      'rawMaterials',
      'workInProgress',
      'finishedGoods',
      'turnoverMaterials',
      'otherCurrentAssets'
    ]
  },
  { type: 'section', label: '非流动资产：' },
  { type: 'item', key: 'longEquityInvest', label: '长期股权投资', row: 16, codes: [] },
  { type: 'item', key: 'longTermReceivable', label: '长期应收款', row: 17, codes: [] },
  { type: 'item', key: 'fixedOriginal', label: '固定资产原价', row: 18, codes: ['1601'] },
  {
    type: 'item',
    key: 'accumDepreciation',
    label: '减：累计折旧',
    row: 19,
    codes: ['1602'],
    negateDisplay: true
  },
  {
    type: 'calc',
    key: 'fixedNet',
    label: '固定资产净值',
    row: 20,
    calc: (v) => roundVal(v.fixedOriginal) - roundVal(v.accumDepreciation)
  },
  { type: 'item', key: 'construction', label: '在建工程', row: 21, codes: [] },
  { type: 'item', key: 'engineeringMaterials', label: '工程物资', row: 22, codes: [] },
  { type: 'item', key: 'fixedDisposal', label: '固定资产清理', row: 23, codes: [] },
  { type: 'item', key: 'productiveBiological', label: '生产性生物资产', row: 24, codes: [] },
  { type: 'item', key: 'intangible', label: '无形资产', row: 25, codes: [] },
  { type: 'item', key: 'devExpense', label: '开发支出', row: 26, codes: ['4301'] },
  { type: 'item', key: 'deferredExpense', label: '长期待摊费用', row: 27, codes: [] },
  { type: 'item', key: 'otherNonCurrentAssets', label: '其他非流动资产', row: 28, codes: [] },
  {
    type: 'subtotal',
    key: 'nonCurrentAssetsTotal',
    label: '非流动资产合计',
    row: 29,
    sumKeys: [
      'longEquityInvest',
      'longTermReceivable',
      'fixedNet',
      'construction',
      'engineeringMaterials',
      'fixedDisposal',
      'productiveBiological',
      'intangible',
      'devExpense',
      'deferredExpense',
      'otherNonCurrentAssets'
    ]
  },
  {
    type: 'total',
    key: 'assetsTotal',
    label: '资产总计',
    row: 30,
    sumKeys: ['currentAssetsTotal', 'nonCurrentAssetsTotal']
  }
];

export const BALANCE_SHEET_LIABILITIES = [
  { type: 'section', label: '流动负债：' },
  { type: 'item', key: 'shortBorrow', label: '短期借款', row: 31, codes: [] },
  { type: 'item', key: 'notesPayable', label: '应付票据', row: 32, codes: [] },
  { type: 'item', key: 'accountsPayable', label: '应付账款', row: 33, codes: ['2202'] },
  { type: 'item', key: 'advances', label: '预收款项', row: 34, codes: [] },
  { type: 'item', key: 'payrollPayable', label: '应付职工薪酬', row: 35, codes: ['2211'] },
  { type: 'item', key: 'taxPayable', label: '应交税费', row: 36, codes: ['2221'] },
  { type: 'item', key: 'interestPayable', label: '应付利息', row: 37, codes: [] },
  { type: 'item', key: 'dividendPayable', label: '应付股利', row: 38, codes: [] },
  { type: 'item', key: 'otherPayables', label: '其他应付款', row: 39, codes: ['2241'] },
  { type: 'item', key: 'otherCurrentLiabilities', label: '其他流动负债', row: 40, codes: [] },
  {
    type: 'subtotal',
    key: 'currentLiabilitiesTotal',
    label: '流动负债合计',
    row: 41,
    sumKeys: [
      'shortBorrow',
      'notesPayable',
      'accountsPayable',
      'advances',
      'payrollPayable',
      'taxPayable',
      'interestPayable',
      'dividendPayable',
      'otherPayables',
      'otherCurrentLiabilities'
    ]
  },
  { type: 'section', label: '非流动负债：' },
  { type: 'item', key: 'longBorrow', label: '长期借款', row: 42, codes: [] },
  { type: 'item', key: 'longPayables', label: '长期应付款', row: 43, codes: [] },
  { type: 'item', key: 'deferredIncome', label: '递延收益', row: 44, codes: [] },
  { type: 'item', key: 'otherNonCurrentLiabilities', label: '其他非流动负债', row: 45, codes: [] },
  {
    type: 'subtotal',
    key: 'nonCurrentLiabilitiesTotal',
    label: '非流动负债合计',
    row: 46,
    sumKeys: ['longBorrow', 'longPayables', 'deferredIncome', 'otherNonCurrentLiabilities']
  },
  {
    type: 'subtotal',
    key: 'liabilitiesTotal',
    label: '负债合计',
    row: 47,
    sumKeys: ['currentLiabilitiesTotal', 'nonCurrentLiabilitiesTotal']
  },
  { type: 'spacer', key: 'equitySpacer' },
  { type: 'section', label: '所有者权益（或股东权益）：' },
  { type: 'item', key: 'paidInCapital', label: '实收资本（或股本）', row: 48, codes: ['3001'] },
  { type: 'item', key: 'capitalReserve', label: '资本公积', row: 49, codes: [] },
  { type: 'item', key: 'surplusReserve', label: '盈余公积', row: 50, codes: [] },
  {
    type: 'item',
    key: 'retainedEarnings',
    label: '未分配利润',
    row: 51,
    codes: ['3103', '3104'],
    includeUnreclosedProfit: true
  },
  {
    type: 'subtotal',
    key: 'equityTotal',
    label: '所有者权益（或股东权益）合计',
    row: 52,
    sumKeys: ['paidInCapital', 'capitalReserve', 'surplusReserve', 'retainedEarnings']
  },
  {
    type: 'total',
    key: 'liabilitiesEquityTotal',
    label: '负债和所有者权益（或股东权益）总计',
    row: 53,
    sumKeys: ['liabilitiesTotal', 'equityTotal']
  }
];

function roundVal(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}
