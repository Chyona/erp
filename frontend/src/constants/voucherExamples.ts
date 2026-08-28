/** 记账示例（金额仅为演示，套用后请按实际修改） */
export const VOUCHER_EXAMPLES = [
  {
    key: 'advance-payment',
    category: '报销与日常',
    title: '个人垫付（成本类）',
    businessType: '日常费用',
    remark:
      '摘要末尾标注垫付人姓名，格式如“（姓名垫付）”，便于月底按垫付人汇总统计。',
    entries: [
      { summary: '【办公费】腾讯云代码助手（thm垫付）', accountCode: '5401', debit: 140, credit: 0 },
      { summary: '【办公费】腾讯云代码助手（thm垫付）', accountCode: '2241', debit: 0, credit: 140 }
    ]
  },
  {
    key: 'advance-payment-other-person',
    category: '报销与日常',
    title: '个人垫付（费用类）',
    businessType: '日常费用',
    remark: '替换括号内姓名即可，其余字段与格式保持不变。',
    entries: [
      { summary: '【福利费】加班聚餐（zqn垫付）', accountCode: '5602', debit: 259, credit: 0 },
      { summary: '【福利费】加班聚餐（zqn垫付）', accountCode: '2241', debit: 0, credit: 259 }
    ]
  },
  {
    key: 'housing-fund-pay',
    category: '工资与劳务',
    title: '当月公积金自动扣款',
    businessType: '工资薪酬',
    remark: '公积金系统当月从对公账户自动划扣。单位部分直接计入 5401 主营业务成本，个人部分冲减发薪时代扣的 2211 应付职工薪酬。',
    entries: [
      { summary: '缴纳本月住房公积金（单位部分）', accountCode: '5401', debit: 500, credit: 0 },
      { summary: '缴纳本月住房公积金（代垫员工部分）', accountCode: '2211', debit: 500, credit: 0 },
      { summary: '银行转账（缴纳住房公积金）', accountCode: '1002', debit: 0, credit: 1000 }
    ]
  },
  {
    key: 'social-security-pay',
    category: '工资与劳务',
    title: '当月社保自动扣款',
    businessType: '工资薪酬',
    remark: '社保系统当月从对公账户自动划扣。单位部分直接计入 5401 主营业务成本，个人部分冲减发薪时代扣的 2211 应付职工薪酬。',
    entries: [
      { summary: '缴纳本月社保费（单位部分）', accountCode: '5401', debit: 800, credit: 0 },
      { summary: '缴纳本月社保费（代垫员工部分）', accountCode: '2211', debit: 400, credit: 0 },
      { summary: '银行转账（缴纳社保费）', accountCode: '1002', debit: 0, credit: 1200 }
    ]
  },
  {
    key: 'salary-accrual',
    category: '工资与劳务',
    title: '计提当月工资',
    businessType: '工资薪酬',
    remark: '当月月底计提，次月5日前发放',
    entries: [
      { summary: '计提当月工资', accountCode: '5401', debit: 5000, credit: 0 },
      { summary: '应付职工薪酬', accountCode: '2211', debit: 0, credit: 5000 }
    ]
  },
  {
    key: 'salary-pay-with-ss-hf',
    category: '工资与劳务',
    title: '次月发放工资（代扣社保、公积金、个税）',
    businessType: '工资薪酬',
    remark: '发放上月计提工资，其中个人社保及公积金贷记 2211 应付职工薪酬，冲减系统自动扣款时已确认的负债；个税贷记 2221 应交税费，待缴纳时冲减。',
    entries: [
      { summary: '发放张三上月工资', accountCode: '2211', debit: 5000, credit: 0 },
      { summary: '银行转账（实发工资）', accountCode: '1002', debit: 0, credit: 4100 },
      { summary: '代扣社保费（冲减个人部分）', accountCode: '2211', debit: 0, credit: 400 },
      { summary: '代扣住房公积金（冲减个人部分）', accountCode: '2211', debit: 0, credit: 300 },
      { summary: '代扣个人所得税（代缴时冲减）', accountCode: '2221', debit: 0, credit: 200 }
    ]
  },
  {
    key: 'labor-accrual',
    category: '工资与劳务',
    title: '计提当月劳务费',
    businessType: '日常费用',
    remark: '当月月底计提本月项目劳务费',
    entries: [
      { summary: '计提本月项目劳务费', accountCode: '5401', debit: 10000, credit: 0 },
      { summary: '应付劳务费', accountCode: '2241', debit: 0, credit: 10000 }
    ]
  },
  {
    key: 'labor-pay',
    category: '工资与劳务',
    title: '次月支付劳务费（代扣个税）',
    businessType: '日常费用',
    remark: '支付上月计提劳务费及代扣个税',
    entries: [
      { summary: '支付陶工上月劳务费', accountCode: '2241', debit: 10000, credit: 0 },
      { summary: '银行转账（实付劳务费）', accountCode: '1002', debit: 0, credit: 9200 },
      { summary: '代扣劳务报酬个人所得税（代缴时冲减）', accountCode: '2221', debit: 0, credit: 800 }
    ]
  },
  {
    key: 'income',
    category: '主营收入',
    title: '收到项目款（不开票）',
    businessType: '销售收入',
    remark: '未开票收款，价税合一记收入',
    entries: [
      { summary: '收到XX项目开发款', accountCode: '1002', debit: 1000, credit: 0 },
      { summary: '确认主营业务收入', accountCode: '5001', debit: 0, credit: 1000 }
    ]
  },
  {
    key: 'income-ordinary',
    category: '主营收入',
    title: '收到项目款（开具普票）',
    businessType: '销售收入',
    invoiceType: 'ordinary',
    taxAmount: 3000,
    remark: '价税分离；普票税额月底可参与减免结转',
    entries: [
      { summary: '收到XX项目开发款（含税）', accountCode: '1002', debit: 1030, credit: 0 },
      { summary: '确认主营业务收入', accountCode: '5001', debit: 0, credit: 1000 },
      { summary: '销项税额（普票）', accountCode: '2221', debit: 0, credit: 30 }
    ]
  },
  {
    key: 'income-special',
    category: '主营收入',
    title: '收到项目款（开具专票）',
    businessType: '销售收入',
    invoiceType: 'special',
    taxAmount: 3000,
    remark: '专票不参与减免结转，需正常申报缴纳',
    entries: [
      { summary: '收到XX项目开发款（专票含税）', accountCode: '1002', debit: 1030, credit: 0 },
      { summary: '确认主营业务收入', accountCode: '5001', debit: 0, credit: 1000 },
      { summary: '销项税额（专票）', accountCode: '2221', debit: 0, credit: 30 }
    ]
  },
  {
    key: 'wecom-withdraw',
    category: '主营收入',
    title: '企业微信提现到公账',
    businessType: '销售收入',
    invoiceType: 'ordinary',
    taxAmount: 9.11,
    remark:
      '企业微信提现至对公账户。提现总额中，对已知客户开票的部分按发票金额拆分确认主营业务收入并计提销项税额；未知客户（匿名充值）的部分全额确认主营业务收入，不计提销项税。',
    entries: [
      { summary: '【提现】企业微信提现到公账', accountCode: '1002', debit: 2994, credit: 0 },
      { summary: '确认主营业务收入（企业微信提现）', accountCode: '5001', debit: 0, credit: 2984.89 },
      { summary: '销项税额（普票，发票号xxx，金额20）', accountCode: '2221', debit: 0, credit: 0.2 },
      { summary: '销项税额（普票，发票号xxx，金额900）', accountCode: '2221', debit: 0, credit: 8.91 }
    ]
  },
  {
    key: 'wechat-pay-withdraw',
    category: '主营收入',
    title: '微信商户平台提现到公账',
    businessType: '销售收入',
    invoiceType: 'ordinary',
    taxAmount: 1.16,
    remark:
      '微信商户平台提现至对公账户。提现总额中，对已知客户开票的部分按发票金额拆分确认主营业务收入并计提销项税额；未知客户（匿名充值）的部分全额确认主营业务收入，不计提销项税。',
    entries: [
      { summary: '【提现】微信商户平台提现到公账', accountCode: '1002', debit: 1558, credit: 0 },
      { summary: '确认主营业务收入（微信商户平台提现）', accountCode: '5001', debit: 0, credit: 1556.84 },
      { summary: '销项税额（普票，发票号xxx，金额58）', accountCode: '2221', debit: 0, credit: 0.58 },
      { summary: '销项税额（普票，发票号xxx，金额58）', accountCode: '2221', debit: 0, credit: 0.58 }
    ]
  },
  {
    key: 'iit-pay',
    category: '税务',
    title: '缴纳代扣个人所得税',
    businessType: '税费缴纳',
    remark: '汇总缴纳上一期间发放工资/劳务费时代扣的个人所得税',
    entries: [
      { summary: '缴纳上月代扣个人所得税', accountCode: '2221', debit: 800, credit: 0 },
      { summary: '银行转账（缴纳税款）', accountCode: '1002', debit: 0, credit: 800 }
    ]
  },
  {
    key: 'surcharge-accrual',
    category: '税务',
    title: '计提附加税（季度）',
    businessType: '税费缴纳',
    remark: '根据季度末申报表计算的当期应纳附加税额进行计提。建议在企业所得税计提前完成，以使当期利润更为准确。',
    entries: [
      { summary: '计提2026年Q1附加税（预估数）', accountCode: '5403', debit: 36, credit: 0 },
      { summary: '应交附加税（预估数）', accountCode: '2221', debit: 0, credit: 36 }
    ]
  },
  {
    key: 'vat-surcharge-pay',
    category: '税务',
    title: '缴纳增值税及附加税（季度）',
    businessType: '税费缴纳',
    remark: '附加税已于季末计提；申报缴纳时冲减计提的 2221 应交税费，与增值税一并从银行账户划扣',
    entries: [
      { summary: '缴纳2026年Q1增值税', accountCode: '2221', debit: 300, credit: 0 },
      { summary: '缴纳2026年Q1附加税', accountCode: '2221', debit: 36, credit: 0 },
      { summary: '银行转账（增值税及附加税合计）', accountCode: '1002', debit: 0, credit: 336 }
    ]
  },
  {
    key: 'cit-accrual',
    category: '税务',
    title: '计提企业所得税（季度）',
    businessType: '税费缴纳',
    remark: '按季预缴或年终汇算补提前计提企业所得税',
    entries: [
      { summary: '计提本期应交企业所得税（预估数）', accountCode: '5801', debit: 500, credit: 0 },
      { summary: '应交企业所得税（预估数）', accountCode: '2221', debit: 0, credit: 500 }
    ]
  },
  {
    key: 'cit-pay',
    category: '税务',
    title: '缴纳企业所得税',
    businessType: '税费缴纳',
    remark: '公账缴纳已计提的企业所得税',
    entries: [
      { summary: '缴纳2026年Q1企业所得税', accountCode: '2221', debit: 5000, credit: 0 },
      { summary: '银行转账（缴纳企业所得税）', accountCode: '1002', debit: 0, credit: 5000 }
    ]
  },
];

export type VoucherExample = (typeof VOUCHER_EXAMPLES)[number];
