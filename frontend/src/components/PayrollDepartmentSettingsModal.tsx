import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { Button, Checkbox, Form, Input, Modal, Select, Space, Switch, Table, App } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  PAYROLL_COMPANY_NAME,
  PAYROLL_COMPANY_ROOT_ID,
  PayrollStaff,
  buildDepartmentTree,
  collectDepartmentTreeKeys,
  flattenDepartmentTree,
  getDepartmentLevelLabel,
  type PayrollDepartment,
  type PayrollDepartmentTreeNode
} from '../services/payrollStaff';
import { confirmDanger } from '../utils/confirmAction';

type SettingsRow = PayrollDepartmentTreeNode & {
  key: string;
  isCompany?: boolean;
};

type PayrollDepartmentSettingsModalProps = {
  open: boolean;
  departments: PayrollDepartment[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

type DeptFormState = {
  id?: string;
  parentId: string;
  name: string;
};

export default function PayrollDepartmentSettingsModal({
  open,
  departments,
  onClose,
  onSaved
}: PayrollDepartmentSettingsModalProps) {
  const { message, modal } = App.useApp();
  const [expandAll, setExpandAll] = useState(true);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [deptFormOpen, setDeptFormOpen] = useState(false);
  const [deptFormState, setDeptFormState] = useState<DeptFormState | null>(null);
  const [deptForm] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const allKeys = useMemo(() => collectDepartmentTreeKeys(tree), [tree]);

  const tableData = useMemo<SettingsRow[]>(() => {
    const companyRow: SettingsRow = {
      id: PAYROLL_COMPANY_ROOT_ID,
      key: PAYROLL_COMPANY_ROOT_ID,
      name: PAYROLL_COMPANY_NAME,
      parentId: PAYROLL_COMPANY_ROOT_ID,
      enabled: true,
      depth: 0,
      isCompany: true,
      children: tree
    };
    return [companyRow];
  }, [tree]);

  useEffect(() => {
    if (!open) return;
    setExpandedRowKeys(expandAll ? allKeys : []);
  }, [open, expandAll, allKeys]);

  const parentOptions = useMemo(() => {
    const rows = flattenDepartmentTree(tree);
    return [
      { value: PAYROLL_COMPANY_ROOT_ID, label: PAYROLL_COMPANY_NAME },
      ...rows.map((item) => ({
        value: item.id,
        label: `${'　'.repeat(Math.max(0, item.depth - 1))}${item.name}`
      }))
    ];
  }, [tree]);

  const openCreate = (parentId: string) => {
    setDeptFormState({ parentId, name: '' });
    deptForm.setFieldsValue({ parentId, name: '' });
    setDeptFormOpen(true);
  };

  const openEdit = (record: SettingsRow) => {
    if (record.isCompany) return;
    setDeptFormState({ id: record.id, parentId: record.parentId || PAYROLL_COMPANY_ROOT_ID, name: record.name });
    deptForm.setFieldsValue({
      parentId: record.parentId || PAYROLL_COMPANY_ROOT_ID,
      name: record.name
    });
    setDeptFormOpen(true);
  };

  const handleSaveDept = async () => {
    const values = await deptForm.validateFields();
    setSaving(true);
    try {
      const existing = deptFormState?.id
        ? departments.find((item) => item.id === deptFormState.id)
        : undefined;
      await PayrollStaff.saveDepartment({
        id: deptFormState?.id || '',
        parentId: values.parentId,
        name: values.name,
        enabled: existing?.enabled !== false
      });
      message.success('部门已保存');
      setDeptFormOpen(false);
      await onSaved();
    } catch (err) {
      message.error((err as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: SettingsRow) => {
    if (record.isCompany) return;
    const ok = await confirmDanger(modal, {
      title: '删除部门？',
      content: `确定删除「${record.name}」吗？`
    });
    if (!ok) return;
    try {
      await PayrollStaff.removeDepartment(record.id);
      message.success('部门已删除');
      await onSaved();
    } catch (err) {
      message.error((err as Error).message || '删除失败');
    }
  };

  const handleToggleEnabled = async (record: SettingsRow, enabled: boolean) => {
    if (record.isCompany) return;
    try {
      await PayrollStaff.saveDepartment({ ...record, enabled });
      await onSaved();
    } catch (err) {
      message.error((err as Error).message || '更新失败');
    }
  };

  const columns: ColumnsType<SettingsRow> = [
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            aria-label="新增下级部门"
            onClick={() => openCreate(record.isCompany ? PAYROLL_COMPANY_ROOT_ID : record.id)}
          />
          {!record.isCompany ? (
            <>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label="编辑部门"
                onClick={() => openEdit(record)}
              />
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label="删除部门"
                onClick={() => handleDelete(record)}
              />
            </>
          ) : null}
        </Space>
      )
    },
    { title: '名称', dataIndex: 'name', ellipsis: true },
    {
      title: '启用',
      key: 'enabled',
      width: 120,
      render: (_, record) =>
        record.isCompany ? null : (
          <Switch
            checked={record.enabled !== false}
            checkedChildren="已启用"
            unCheckedChildren="已禁用"
            onChange={(checked) => void handleToggleEnabled(record, checked)}
          />
        )
    },
    {
      title: '部门层级',
      key: 'level',
      width: 110,
      render: (_, record) => getDepartmentLevelLabel(record.depth)
    }
  ];

  return (
    <>
      <Modal
        title="部门设置"
        open={open}
        onCancel={onClose}
        width={760}
        destroyOnHidden
        footer={
          <Button type="primary" onClick={onClose}>
            关闭
          </Button>
        }
      >
        <Checkbox
          checked={expandAll}
          onChange={(event) => {
            setExpandAll(event.target.checked);
            setExpandedRowKeys(event.target.checked ? allKeys : []);
          }}
        >
          展开所有部门
        </Checkbox>

        <Table
          className="payroll-dept-settings-table"
          style={{ marginTop: 12 }}
          size="small"
          bordered
          rowKey="key"
          columns={columns}
          dataSource={tableData}
          pagination={false}
          expandable={{
            defaultExpandAllRows: true,
            expandedRowKeys,
            onExpandedRowsChange: (keys) => setExpandedRowKeys(keys.map(String)),
            childrenColumnName: 'children'
          }}
        />
      </Modal>

      <Modal
        title={deptFormState?.id ? '编辑部门' : '新增部门'}
        open={deptFormOpen}
        onCancel={() => setDeptFormOpen(false)}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => setDeptFormOpen(false)}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={saving} onClick={() => void handleSaveDept()}>
            保存
          </Button>
        ]}
      >
        <Form form={deptForm} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
          <Form.Item
            name="parentId"
            label="上级部门"
            rules={[{ required: true, message: '请选择上级部门' }]}
          >
            <Select
              options={parentOptions.filter(
                (item) => !deptFormState?.id || item.value !== deptFormState.id
              )}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
