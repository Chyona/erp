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
  Tag,
  Typography
} from 'antd';
import AppTable from './AppTable';
import { CheckOutlined, DeleteOutlined, DownOutlined } from '@ant-design/icons';
import { VoucherTemplates } from '../services/voucherTemplates';
import { VOUCHER_EXAMPLES } from '../constants/voucherExamples';

const { Text, Paragraph } = Typography;

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
      <AppTable
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
            description="暂无自定义模板，可先录凭证后通过「保存为凭证模板」添加"
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
