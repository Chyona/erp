import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  App,
  Button,
  Collapse,
  Drawer,
  Dropdown,
  Empty,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import { CheckOutlined, DeleteOutlined, DownOutlined } from '@ant-design/icons';
import { VoucherTemplates } from '../services/voucherTemplates';

const { Text, Paragraph } = Typography;

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
      { summary: '本月住房公积金（单位部分）', accountCode: '5401', debit: 500, credit: 0 },
      { summary: '本月住房公积金（个人部分）', accountCode: '2211', debit: 500, credit: 0 },
      { summary: '公积金系统自动扣款', accountCode: '1002', debit: 0, credit: 1000 }
    ]
  },
  {
    key: 'social-security-pay',
    category: '工资与劳务',
    title: '当月社保自动扣款',
    businessType: '工资薪酬',
    remark: '社保系统当月从对公账户自动划扣。单位部分直接计入 5401 主营业务成本，个人部分冲减发薪时代扣的 2211 应付职工薪酬。',
    entries: [
      { summary: '本月社会保险费（单位部分）', accountCode: '5401', debit: 800, credit: 0 },
      { summary: '本月社会保险费（个人部分）', accountCode: '2211', debit: 400, credit: 0 },
      { summary: '社保系统自动扣款', accountCode: '1002', debit: 0, credit: 1200 }
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
      { summary: '代扣社会保险费（冲减个人部分）', accountCode: '2211', debit: 0, credit: 400 },
      { summary: '代扣住房公积金（冲减个人部分）', accountCode: '2211', debit: 0, credit: 300 },
      { summary: '代扣个人所得税（代缴时冲减）', accountCode: '2221', debit: 0, credit: 200 }
    ]
  },
  {
    key: 'labor-accrual',
    category: '工资与劳务',
    title: '计提当月劳务费',
    businessType: '日常费用',
    remark: '当月月底计提外包劳务费',
    entries: [
      { summary: '计提3月项目劳务费', accountCode: '5401', debit: 10000, credit: 0 },
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
      { summary: '收到XX项目开发款', accountCode: '1002', debit: 100000, credit: 0 },
      { summary: '确认主营业务收入', accountCode: '5001', debit: 0, credit: 100000 }
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
      { summary: '收到XX项目开发款（含税）', accountCode: '1002', debit: 103000, credit: 0 },
      { summary: '确认主营业务收入', accountCode: '5001', debit: 0, credit: 100000 },
      { summary: '销项税额（普票）', accountCode: '2221', debit: 0, credit: 3000 }
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
      { summary: '收到XX项目开发款（专票含税）', accountCode: '1002', debit: 103000, credit: 0 },
      { summary: '确认主营业务收入', accountCode: '5001', debit: 0, credit: 100000 },
      { summary: '销项税额（专票）', accountCode: '2221', debit: 0, credit: 3000 }
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

const CATEGORY_ORDER = ['主营收入', '报销与日常', '工资与劳务', '税务'];
const DRAWER_WIDTH = 720;

function ExampleCard({ example, accounts, onApply, applyLabel = '套用此模板' }) {
  const columns: ColumnsType<{ summary: string; accountCode: string; debit?: number; credit?: number }> = [
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '科目',
      dataIndex: 'accountCode',
      width: 168,
      render: (code) => {
        const acc = accounts.find((a) => a.code === code);
        return (
          <span className="voucher-example-account">
            {acc ? `${acc.code} ${acc.name}` : code}
          </span>
        );
      }
    },
    {
      title: '借方',
      dataIndex: 'debit',
      width: 88,
      align: 'right',
      render: (v) => (v ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '')
    },
    {
      title: '贷方',
      dataIndex: 'credit',
      width: 88,
      align: 'right',
      render: (v) => (v ? v.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '')
    }
  ];

  return (
    <div className="voucher-example-card">
      <div className="voucher-example-card__head">
        <div>
          <div className="voucher-example-card__title">{example.title || example.name}</div>
          {example.remark && (
            <Text type="secondary" className="voucher-example-card__remark">
              {example.remark}
            </Text>
          )}
        </div>
        <Tag color="blue">{example.businessType}</Tag>
      </div>
      <Table
        rowKey={(r) => r.summary + r.accountCode}
        columns={columns}
        dataSource={example.entries}
        pagination={false}
        size="small"
        className="voucher-example-table"
      />
      <Button
        type="primary"
        block
        icon={<CheckOutlined />}
        onClick={() => onApply(example)}
        className="voucher-example-card__apply"
      >
        {applyLabel}
      </Button>
    </div>
  );
}

export default function VoucherExamples({ accounts, onApply, getSnapshot }) {
  const { message, modal } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [saving, setSaving] = useState(false);
  const [userTemplates, setUserTemplates] = useState([]);

  const loadUserTemplates = useCallback(async () => {
    setUserTemplates(await VoucherTemplates.getAll());
  }, []);

  useEffect(() => {
    if (drawerOpen) loadUserTemplates();
  }, [drawerOpen, loadUserTemplates]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const ex of VOUCHER_EXAMPLES) {
      if (!map.has(ex.category)) map.set(ex.category, []);
      map.get(ex.category).push(ex);
    }
    return CATEGORY_ORDER.filter((cat) => map.get(cat)?.length).map((cat) => ({
      category: cat,
      examples: map.get(cat)
    }));
  }, []);

  const handleApply = (example, label) => {
    onApply(example);
    setDrawerOpen(false);
    message.success(`已套用${label}，请按实际金额和摘要修改后再保存`);
  };

  const openSaveModal = () => {
    const snapshot = getSnapshot?.();
    const hasEntries = snapshot?.entries?.some(
      (entry) => entry.summary || entry.accountCode || entry.debit || entry.credit
    );
    if (!hasEntries) {
      message.warning('请先填写分录后再保存为模板');
      return;
    }
    setTemplateName('');
    setSaveOpen(true);
  };

  const handleSaveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      message.warning('请输入模板名称');
      return;
    }

    setSaving(true);
    try {
      const snapshot = getSnapshot();
      await VoucherTemplates.save({ name, ...snapshot });
      message.success(`模板「${name}」已保存`);
      setSaveOpen(false);
      await loadUserTemplates();
    } catch (err) {
      message.error(err.message || '保存模板失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = (template) => {
    modal.confirm({
      title: '删除凭证模板？',
      content: `确定删除「${template.name}」吗？此操作不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        await VoucherTemplates.remove(template.id);
        message.success('模板已删除');
        await loadUserTemplates();
      }
    });
  };

  const menuItems = [
    {
      key: 'save',
      label: '保存为凭证模板',
      onClick: openSaveModal
    },
    {
      key: 'generate',
      label: '从模板生成凭证',
      onClick: () => setDrawerOpen(true)
    }
  ];

  const systemCollapseItems = grouped.map(({ category, examples }) => ({
    key: category,
    label: category,
    children: (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {examples.map((ex) => (
          <ExampleCard
            key={ex.key}
            example={ex}
            accounts={accounts}
            onApply={(item) => handleApply(item, '示例')}
          />
        ))}
      </Space>
    )
  }));

  return (
    <>
      <Dropdown menu={{ items: menuItems }} trigger={['click']}>
        <Button className="voucher-template-btn">
          模板
          <DownOutlined className="voucher-template-btn__arrow" />
        </Button>
      </Dropdown>

      <Modal
        title="保存为凭证模板"
        open={saveOpen}
        onCancel={() => setSaveOpen(false)}
        onOk={handleSaveTemplate}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Paragraph type="secondary" style={{ marginBottom: 12 }}>
          将保存当前业务类型、分录摘要与科目、备注等内容，不含凭证号与日期。
        </Paragraph>
        <Input
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="请输入模板名称"
          maxLength={40}
          onPressEnter={handleSaveTemplate}
        />
      </Modal>

      <Drawer
        title="从模板生成凭证"
        placement="right"
        width={DRAWER_WIDTH}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        className="voucher-examples-drawer"
        destroyOnHidden={false}
      >
        <Paragraph type="secondary" className="voucher-examples-drawer__intro">
          选择下方模板可一键填入业务类型和分录，金额仅供参考，请按实际修改后保存。
        </Paragraph>

        {userTemplates.length > 0 ? (
          <div className="voucher-examples-drawer__section">
            <div className="voucher-examples-drawer__section-title">我的模板</div>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {userTemplates.map((template) => (
                <div key={template.id} className="voucher-user-template">
                  <ExampleCard
                    example={template}
                    accounts={accounts}
                    applyLabel="套用此模板"
                    onApply={(item) => handleApply(item, '模板')}
                  />
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    className="voucher-example-card__delete"
                    onClick={() => handleDeleteTemplate(template)}
                  >
                    删除模板
                  </Button>
                </div>
              ))}
            </Space>
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无自定义模板，可先录入凭证后通过「保存为凭证模板」添加"
            className="voucher-examples-drawer__empty"
          />
        )}

        <div className="voucher-examples-drawer__section">
          <div className="voucher-examples-drawer__section-title">系统示例</div>
          <Collapse
            defaultActiveKey={[CATEGORY_ORDER[0]]}
            ghost
            items={systemCollapseItems}
            className="voucher-examples-drawer__list"
          />
        </div>
      </Drawer>
    </>
  );
}
