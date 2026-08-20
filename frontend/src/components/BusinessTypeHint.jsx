import { Popover, Tabs } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

/** 软件企业最常用 — 速查 */
const QUICK_GUIDE = [
  {
    scene: '收到开发款 / 技术服务费 / SaaS 订阅',
    type: '销售收入',
    account: '5001 主营业务收入'
  },
  {
    scene: '收到开发款（开具普票）',
    type: '销售收入',
    account: '借 1002 / 贷 5001 + 2221',
    tip: '填写增值税额，月底工作台可减免结转'
  },
  {
    scene: '收到开发款（开具专票）',
    type: '销售收入',
    account: '借 1002 / 贷 5001 + 2221',
    tip: '专票不参与减免结转，需正常申报缴纳'
  },
  {
    scene: '个人垫付采购（法人 / 同事）',
    type: '日常费用',
    account: '借 5602 / 贷 2241 其他应付款',
    tip: '摘要格式：【采购】或【餐饮】+ 说明 +（垫付人）'
  },
  {
    scene: '月底汇总还垫付（按人分别打款）',
    type: '日常费用',
    account: '借 2241（分行）/ 贷 1002',
    tip: '每人 1 张凭证，采购、餐饮各一行借方，贷方一笔总额'
  },
  {
    scene: '外包劳务 / 临时用工（非员工工资）',
    type: '日常费用',
    account: '5602 管理费用'
  },
  {
    scene: '电脑等设备 ＜5000 元（个人垫付）',
    type: '日常费用',
    account: '借 5602 / 贷 2241 其他应付款'
  },
  {
    scene: '电脑等设备 ≥5000 元',
    type: '固定资产',
    account: '1601 固定资产'
  },
  {
    scene: '员工工资 / 社保 / 公积金',
    type: '工资薪酬',
    account: '2211 应付职工薪酬'
  },
  {
    scene: '缴纳增值税及附加税（季度）',
    type: '税费缴纳',
    account: '借 2221 + 5403 / 贷 1002',
    tip: '增值税与附加税一般一并打款，一笔贷银行存款'
  },
  {
    scene: '计提 / 缴纳企业所得税',
    type: '税费缴纳',
    account: '计提：借 5801 贷 2221；缴纳：借 2221 贷 1002'
  },
  {
    scene: '缴纳代扣个税',
    type: '税费缴纳',
    account: '借 2221 / 贷 1002 银行存款'
  }
];

const REIMBURSE_FLOW = {
  title: '月底怎么汇总报销',
  steps: [
    '发生时统一摘要：【采购】×月××（法人垫付）或【餐饮】×月××（张三垫付）',
    '月底打开明细账 → 科目选 2241 其他应付款 → 日期选当月 → 查询',
    '按垫付人加总贷方：搜「法人垫付」得法人总额；搜「张三垫付」得张三总额',
    '再按【采购】【餐饮】细分各类金额（看摘要前缀或导出 CSV 汇总）',
    '每人记 1 张还垫付凭证：借 2241 分行（采购一行、餐饮一行），贷 1002 一笔总额'
  ],
  advanced:
    '示例：法人 3 月采购 3800 + 餐饮 860 → 借 2241 3800「归还3月采购垫付-法人」、借 2241 860「归还3月餐饮垫付-法人」、贷 1002 4660'
};

const TAX_EXEMPTION_FLOW = {
  title: '普票 / 专票 · 减免结转',
  steps: [
    '销售凭证选「销售收入」，并选择开票类型：普票或专票',
    '价税分离记账：借 1002 银行存款，贷 5001 主营业务收入 + 2221 应交税费',
    '「增值税额」字段填本笔发票税额；普票参与月底结转，专票不结转',
    '月底在工作台「普票减免结转」选月份 → 系统自动汇总普票税额',
    '一键生成：借 2221 应交税费，贷 5301 营业外收入（免税收入）'
  ],
  advanced:
    '专票税额保留在 2221，随季度增值税申报一并缴纳；普票结转后不再重复缴纳该部分税额'
};

/** 完整分类说明 */
const TYPE_ITEMS = [
  { type: '销售收入', desc: '软件开发、技术服务、产品/SaaS 销售等主营收入' },
  { type: '日常费用', desc: '报销、办公、差旅、劳务外包、低值设备采购等' },
  { type: '采购支出', desc: '软件授权、云服务等经营性采购付款' },
  { type: '工资薪酬', desc: '正式员工工资、社保、公积金、奖金' },
  { type: '固定资产', desc: '5000 元及以上电脑、服务器等长期资产' },
  { type: '税费缴纳', desc: '增值税、所得税、附加税等税款缴纳' },
  { type: '银行往来', desc: '银行存取款、贷款、利息收支' },
  { type: '其他', desc: '不属于以上类别的偶发业务' }
];

function QuickGuidePanel() {
  return (
    <div className="business-type-hint__quick">
      {QUICK_GUIDE.map((item) => (
        <div key={item.scene} className="business-type-hint__quick-row">
          <div className="business-type-hint__quick-scene">{item.scene}</div>
          <div className="business-type-hint__quick-result">
            <span className="business-type-hint__tag">{item.type}</span>
            <span className="business-type-hint__account">{item.account}</span>
          </div>
          {item.tip && <div className="business-type-hint__quick-tip">{item.tip}</div>}
        </div>
      ))}
    </div>
  );
}

function FlowPanel({ flow, variant }) {
  return (
    <div className={`business-type-hint__flow${variant ? ` business-type-hint__flow--${variant}` : ''}`}>
      <ol className="business-type-hint__steps">
        {flow.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="business-type-hint__flow-advanced">{flow.advanced}</div>
    </div>
  );
}

function TypesPanel() {
  return (
    <div className="business-type-hint__list">
      {TYPE_ITEMS.map((item) => (
        <div key={item.type} className="business-type-hint__item">
          <span className="business-type-hint__tag">{item.type}</span>
          <span className="business-type-hint__desc">{item.desc}</span>
        </div>
      ))}
    </div>
  );
}

function HintContent() {
  const tabItems = [
    {
      key: 'types',
      label: '全部分类',
      children: <TypesPanel />
    },
    {
      key: 'quick',
      label: '软件企业速查',
      children: <QuickGuidePanel />
    },
    {
      key: 'reimburse',
      label: '报销汇总',
      children: <FlowPanel flow={REIMBURSE_FLOW} />
    },
    {
      key: 'tax',
      label: '减免结转',
      children: <FlowPanel flow={TAX_EXEMPTION_FLOW} variant="tax" />
    }
  ];

  return (
    <div className="business-type-hint">
      <Tabs
        size="small"
        className="business-type-hint__tabs"
        items={tabItems}
        destroyInactiveTabPane={false}
      />
      <div className="business-type-hint__footer">
        5000 元固定资产门槛以公司财务制度为准；研发项目相关支出也可记入 4301 研发支出。
      </div>
    </div>
  );
}

export default function BusinessTypeHint() {
  return (
    <Popover
      content={<HintContent />}
      title="业务类型说明"
      trigger="click"
      placement="rightTop"
      overlayClassName="business-type-popover"
    >
      <InfoCircleOutlined className="field-hint-icon" aria-label="业务类型说明" />
    </Popover>
  );
}
