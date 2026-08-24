import { useEffect, useState } from 'react';
import { Button, Modal, Form, Input, Select, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Accounts } from '../services/accounts';
import { useApp } from '../context/AppContext';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useAuth } from '../context/AuthContext';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import ScrollTable from '../components/ScrollTable';
import { confirmDanger } from '../utils/confirmAction';

const CATEGORIES = ['资产', '负债', '所有者权益', '成本', '损益'];

export default function AccountsPage() {
  const { message, modal } = App.useApp();
  const { accounts, setAccounts, refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const { can } = useAuth();
  const canWrite = can('accounts.write');
  const [list, setList] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const { loading: listLoading, run: runListLoad } = useAsyncLoading(true);
  const { loading: saving, run: runSave } = useAsyncLoading();

  useEffect(() => {
    void runListLoad(async () => {
      const accs = await Accounts.getAll();
      setAccounts(accs);
      setList(categoryFilter ? accs.filter((a) => a.category === categoryFilter) : accs);
    });
  }, [refreshKey, tabDataRefresh, categoryFilter, setAccounts, runListLoad]);

  const openModal = (account = null) => {
    setEditing(account);
    form.setFieldsValue(
      account || { category: '资产', direction: 'debit' }
    );
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      await runSave(async () => {
        await Accounts.save({
          id: editing?.id || null,
          code: values.code.trim(),
          name: values.name.trim(),
          category: values.category,
          direction: values.direction
        });
        message.success('科目保存成功');
        setModalOpen(false);
        refresh();
      });
    } catch (err) {
      if (err instanceof Error && err.message) {
        message.error(err.message || '保存失败');
      }
    }
  };

  const handleDelete = async (record) => {
    const ok = await confirmDanger(modal, {
      title: '确定删除该科目？',
      content: `科目「${record.code} ${record.name}」删除后不可恢复。若已有凭证引用该科目，请勿删除。`
    });
    if (!ok) return;
    const hide = message.loading('正在删除…', 0);
    try {
      await Accounts.remove(record.id);
      message.success('科目已删除');
      refresh();
    } catch (err) {
      message.error(err.message || '删除失败');
    } finally {
      hide();
    }
  };

  const columns = [
    { title: '编码', dataIndex: 'code', width: 100 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '类别', dataIndex: 'category', width: 160 },
    {
      title: '余额方向',
      dataIndex: 'direction',
      width: 160,
      render: (d) => (d === 'debit' ? '借方' : '贷方')
    },
    ...(canWrite
      ? [
        {
          title: '操作',
          key: 'actions',
          width: 160,
          render: (_, record) => (
            <>
              <Button size="small" onClick={() => openModal(record)} style={{ marginRight: 8 }}>
                编辑
              </Button>
              <Button size="small" danger onClick={() => handleDelete(record)}>
                删除
              </Button>
            </>
          )
        }
      ]
      : [])
  ];

  return (
    <div className="page-table-layout">
      <div className="page-table-toolbar page-table-toolbar--split">
        <Select
          placeholder="全部类别"
          allowClear
          style={{ width: 160 }}
          value={categoryFilter || undefined}
          onChange={(v) => setCategoryFilter(v || '')}
          options={CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        {canWrite ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
            新增科目
          </Button>
        ) : null}
      </div>

      <ScrollTable
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={listLoading}
        pagination={{
          pageSize: 100,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (total) => `共 ${total} 条`
        }}
        locale={{ emptyText: '暂无科目' }}
      />

      <Modal
        title={editing ? '编辑科目' : '新增科目'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="科目编码"
            rules={[{ required: true, message: '请输入科目编码' }, { pattern: /^[0-9]+$/, message: '只能输入数字' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="name" label="科目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="类别" rules={[{ required: true }]}>
            <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item name="direction" label="余额方向">
            <Select
              options={[
                { value: 'debit', label: '借方' },
                { value: 'credit', label: '贷方' }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
