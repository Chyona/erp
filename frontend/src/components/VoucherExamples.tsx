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
    key: 'purchase-advance-owner',
    category: '报销与日常',
    title: '个人垫付采购（法人）',
    businessType: '日常费用',
    remark: '法人个人支付，贷方摘要写清垫付人',
    entries: [
      { summary: '【采购】3月办公用品（法人垫付）', accountCode: '5602', debit: 3800, credit: 0 },
      { summary: '法人垫付待报销', accountCode: '2241', debit: 0, credit: 3800 }
    ]
  },
  {
    key: 'meal-advance-owner',
    category: '报销与日常',
    title: '个人垫付餐饮（法人）',
    businessType: '日常费用',
    remark: '摘要前加【餐饮】，与采购区分，便于月底汇总',
    entries: [
      { summary: '【餐饮】3月客户接待（法人垫付）', accountCode: '5602', debit: 860, credit: 0 },
      { summary: '法人垫付待报销', accountCode: '2241', debit: 0, credit: 860 }
    ]
  },
  {
    key: 'purchase-advance-staff',
    category: '报销与日常',
    title: '个人垫付采购（同事）',
    businessType: '日常费用',
    remark: '同事个人支付，摘要注明垫付人姓名便于月底核对',
    entries: [
      { summary: '【采购】3月项目耗材（张三垫付）', accountCode: '5602', debit: 1200, credit: 0 },
      { summary: '张三垫付待报销', accountCode: '2241', debit: 0, credit: 1200 }
    ]
  },
  {
    key: 'meal-advance-staff',
    category: '报销与日常',
    title: '个人垫付餐饮（同事）',
    businessType: '日常费用',
    remark: '同事垫付餐饮，摘要写清姓名',
    entries: [
      { summary: '【餐饮】3月团队聚餐（张三垫付）', accountCode: '5602', debit: 420, credit: 0 },
      { summary: '张三垫付待报销', accountCode: '2241', debit: 0, credit: 420 }
    ]
  },
  {
    key: 'reimburse-owner-summary',
    category: '报销与日常',
    title: '月底汇总还垫付（法人·采购+餐饮）',
    businessType: '日常费用',
    remark: '按费用类型分行冲销 2241，贷方一笔打款；金额从明细账核对后填入',
    entries: [
      { summary: '归还3月采购垫付-法人', accountCode: '2241', debit: 3800, credit: 0 },
      { summary: '归还3月餐饮垫付-法人', accountCode: '2241', debit: 860, credit: 0 },
      { summary: '公账转法人（3月报销汇总）', accountCode: '1002', debit: 0, credit: 4660 }
    ]
  },
  {
    key: 'reimburse-staff-summary',
    category: '报销与日常',
    title: '月底汇总还垫付（同事·采购+餐饮）',
    businessType: '日常费用',
    remark: '同事同理：采购、餐饮分行借 2241，再一笔贷银行存款',
    entries: [
      { summary: '归还3月采购垫付-张三', accountCode: '2241', debit: 1200, credit: 0 },
      { summary: '归还3月餐饮垫付-张三', accountCode: '2241', debit: 420, credit: 0 },
      { summary: '公账转张三（3月报销汇总）', accountCode: '1002', debit: 0, credit: 1620 }
    ]
  },
  {
    key: 'salary-accrual',
    category: '工资与劳务',
    title: '计提当月工资（次月发放）',
    businessType: '工资薪酬',
    remark: '当月月底计提，次月5日发放',
    entries: [
      { summary: '计提3月工资', accountCode: '5602', debit: 50000, credit: 0 },
      { summary: '应付职工薪酬', accountCode: '2211', debit: 0, credit: 50000 }
    ]
  },
  {
    key: 'salary-pay',
    category: '工资与劳务',
    title: '次月发放工资（代扣个税）',
    businessType: '工资薪酬',
    remark: '发放上月已计提工资，代扣个税2000元',
    entries: [
      { summary: '发放3月工资', accountCode: '2211', debit: 50000, credit: 0 },
      { summary: '银行转账（实发）', accountCode: '1002', debit: 0, credit: 48000 },
      { summary: '代扣个人所得税', accountCode: '2221', debit: 0, credit: 2000 }
    ]
  },
  {
    key: 'labor-accrual',
    category: '工资与劳务',
    title: '计提当月劳务费（次月支付）',
    businessType: '日常费用',
    remark: '当月月底计提外包劳务费',
    entries: [
      { summary: '计提3月项目劳务费', accountCode: '5602', debit: 10000, credit: 0 },
      { summary: '应付劳务费', accountCode: '2241', debit: 0, credit: 10000 }
    ]
  },
  {
    key: 'labor-pay',
    category: '工资与劳务',
    title: '次月支付劳务费（代扣个税）',
    businessType: '日常费用',
    remark: '支付上月计提劳务费，代扣个税800元',
    entries: [
      { summary: '支付3月劳务费', accountCode: '2241', debit: 10000, credit: 0 },
      { summary: '银行转账（实付）', accountCode: '1002', debit: 0, credit: 9200 },
      { summary: '代扣代缴个人所得税', accountCode: '2221', debit: 0, credit: 800 }
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
    remark: '价税分离；普票税额月底可减免结转',
    entries: [
      { summary: '收到XX项目开发款（含税）', accountCode: '1002', debit: 103000, credit: 0 },
      { summary: '确认主营业务收入', accountCode: '5001', debit: 0, credit: 100000 },
      { summary: '销项税额', accountCode: '2221', debit: 0, credit: 3000 }
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
      { summary: '销项税额', accountCode: '2221', debit: 0, credit: 3000 }
    ]
  },
  {
    key: 'tax-exemption-carry',
    category: '税务',
    title: '月底普票增值税减免结转',
    businessType: '税费缴纳',
    remark: '也可在工作台一键生成；专票不参与此项结转',
    entries: [
      { summary: '2026年3月普票增值税减免结转', accountCode: '2221', debit: 3000, credit: 0 },
      { summary: '2026年3月免税收入', accountCode: '5301', debit: 0, credit: 3000 }
    ]
  },
  {
    key: 'vat-surcharge-pay',
    category: '税务',
    title: '缴纳增值税及附加税（季度）',
    businessType: '税费缴纳',
    remark: '增值税与城建税、教育费附加等通常一并缴纳，金额以申报表为准',
    entries: [
      { summary: '缴纳2026年Q1增值税', accountCode: '2221', debit: 3000, credit: 0 },
      { summary: '缴纳2026年Q1附加税', accountCode: '5403', debit: 360, credit: 0 },
      { summary: '银行转账（税合计）', accountCode: '1002', debit: 0, credit: 3360 }
    ]
  },
  {
    key: 'cit-accrual',
    category: '税务',
    title: '计提企业所得税',
    businessType: '税费缴纳',
    remark: '按季预缴或年终汇算补提前计提',
    entries: [
      { summary: '计提2026年Q1企业所得税', accountCode: '5801', debit: 5000, credit: 0 },
      { summary: '应交企业所得税', accountCode: '2221', debit: 0, credit: 5000 }
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
      { summary: '银行转账', accountCode: '1002', debit: 0, credit: 5000 }
    ]
  },
  {
    key: 'iit-pay',
    category: '税务',
    title: '缴纳代扣个人所得税',
    businessType: '税费缴纳',
    remark: '工资/劳务代扣个税汇总缴至税务局',
    entries: [
      { summary: '缴纳代扣个人所得税', accountCode: '2221', debit: 2800, credit: 0 },
      { summary: '银行转账', accountCode: '1002', debit: 0, credit: 2800 }
    ]
  }
];

const CATEGORY_ORDER = ['主营收入', '报销与日常', '工资与劳务', '税务'];
const DRAWER_WIDTH = 620;

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
            defaultActiveKey={CATEGORY_ORDER}
            ghost
            items={systemCollapseItems}
            className="voucher-examples-drawer__list"
          />
        </div>
      </Drawer>
    </>
  );
}
