/** 小企业会计准则利润表模板 */

export const INCOME_STATEMENT_LINES = [
  { type: 'item', key: 'revenue', label: '一、营业收入', row: 1, codes: ['5001'], bold: true },
  { type: 'item', key: 'cost', label: '减：营业成本', row: 2, codes: ['5401'], bold: true },
  { type: 'item', key: 'taxSurcharge', label: '税金及附加', row: 3, codes: ['5403'], bold: true },
  { type: 'detail', key: 'consumptionTax', label: '其中：消费税', row: 4, codes: [] },
  { type: 'detail', key: 'businessTax', label: '营业税', row: 5, codes: [] },
  { type: 'detail', key: 'cityTax', label: '城市维护建设税', row: 6, codes: [] },
  { type: 'detail', key: 'resourceTax', label: '资源税', row: 7, codes: [] },
  { type: 'detail', key: 'landTax', label: '土地增值税', row: 8, codes: [] },
  {
    type: 'detail',
    key: 'propertyTax',
    label: '城镇土地使用税、房产税、车船税、印花税',
    row: 9,
    codes: []
  },
  {
    type: 'detail',
    key: 'educationSurcharge',
    label: '教育费附加、矿产资源补偿费、排污费',
    row: 10,
    codes: []
  },
  { type: 'item', key: 'sellingExpense', label: '销售费用', row: 11, codes: [], bold: true },
  { type: 'detail', key: 'repairExpense', label: '其中：商品维修费', row: 12, codes: [] },
  { type: 'detail', key: 'advertisingExpense', label: '广告费和业务宣传费', row: 13, codes: [] },
  { type: 'item', key: 'adminExpense', label: '管理费用', row: 14, codes: ['5602'], bold: true },
  { type: 'detail', key: 'startupExpense', label: '其中：开办费', row: 15, codes: [] },
  { type: 'detail', key: 'entertainmentExpense', label: '业务招待费', row: 16, codes: [] },
  { type: 'detail', key: 'researchExpense', label: '研究费用', row: 17, codes: ['4301'] },
  { type: 'item', key: 'financeExpense', label: '财务费用', row: 18, codes: ['5603'], bold: true },
  {
    type: 'detail',
    key: 'interestExpense',
    label: '其中：利息费用（收入以“-”号填列）',
    row: 19,
    codes: []
  },
  {
    type: 'item',
    key: 'investmentIncome',
    label: '加：投资收益（损失以“-”号填列）',
    row: 20,
    codes: [],
    bold: true
  },
  {
    type: 'calc',
    key: 'operatingProfit',
    label: '二、营业利润（亏损以“-”号填列）',
    row: 21,
    bold: true,
    calc: (v) =>
      roundVal(v.revenue) -
      roundVal(v.cost) -
      roundVal(v.taxSurcharge) -
      roundVal(v.sellingExpense) -
      roundVal(v.adminExpense) -
      roundVal(v.financeExpense) +
      roundVal(v.investmentIncome)
  },
  { type: 'item', key: 'otherIncome', label: '加：营业外收入', row: 22, codes: ['5301'], bold: true },
  { type: 'detail', key: 'govSubsidy', label: '其中：政府补助', row: 23, codes: [] },
  {
    type: 'item',
    key: 'otherExpense',
    label: '减：营业外支出',
    row: 24,
    codes: ['5711'],
    bold: true
  },
  { type: 'detail', key: 'penaltyExpense', label: '其中：罚款支出', row: 25, codes: [] },
  {
    type: 'detail',
    key: 'equityInvestLoss',
    label: '无法收回的长期股权投资损失',
    row: 26,
    codes: []
  },
  {
    type: 'detail',
    key: 'bondInvestLoss',
    label: '无法收回的长期债券投资损失',
    row: 27,
    codes: []
  },
  {
    type: 'detail',
    key: 'naturalDisasterLoss',
    label: '自然灾害等不可抗力因素造成的损失',
    row: 28,
    codes: []
  },
  { type: 'detail', key: 'taxPenalty', label: '税收滞纳金', row: 29, codes: [] },
  {
    type: 'calc',
    key: 'totalProfit',
    label: '三、利润总额（亏损总额以“-”号填列）',
    row: 30,
    bold: true,
    calc: (v) => roundVal(v.operatingProfit) + roundVal(v.otherIncome) - roundVal(v.otherExpense)
  },
  { type: 'item', key: 'incomeTax', label: '减：所得税费用', row: 31, codes: ['5801'], bold: true },
  {
    type: 'calc',
    key: 'netProfit',
    label: '四、净利润（净亏损以“-”号填列）',
    row: 32,
    bold: true,
    calc: (v) => roundVal(v.totalProfit) - roundVal(v.incomeTax)
  }
];

function roundVal(n) {
  return Math.round((parseFloat(n) || 0) * 100) / 100;
}
