import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Pagination,
  Radio,
  Select,
  Space,
  Switch,
  App
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import ScrollTable from './ScrollTable';
import PayrollDepartmentSidebar from './PayrollDepartmentSidebar';
import PayrollDepartmentSettingsModal from './PayrollDepartmentSettingsModal';
import { useTabDataRefresh } from '../context/PageTabsContext';
import { useApp } from '../context/AppContext';
import {
  PAYROLL_COMPANY_ROOT_ID,
  PAYROLL_STAFF_TYPE_LABELS,
  PayrollStaff,
  getDepartmentDescendantIds,
  type PayrollDepartment,
  type PayrollStaffMember,
  type PayrollStaffType
} from '../services/payrollStaff';
import { confirmDanger } from '../utils/confirmAction';

const GENDER_LABELS = {
  male: '男',
  female: '女'
} as const;

type StaffFormValues = {
  name: string;
  departmentId: string;
  staffType: PayrollStaffType;
  gender?: 'male' | 'female';
  idNumber?: string;
  phone?: string;
  remark?: string;
};

export default function PayrollStaffPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { message, modal } = App.useApp();
  const { refreshKey, refresh } = useApp();
  const tabDataRefresh = useTabDataRefresh();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<PayrollDepartment[]>([]);
  const [staff, setStaff] = useState<PayrollStaffMember[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState(PAYROLL_COMPANY_ROOT_ID);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [deptSettingsOpen, setDeptSettingsOpen] = useState(false);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<PayrollStaffMember | null>(null);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffForm] = Form.useForm<StaffFormValues>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(500);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const org = await PayrollStaff.getAll();
      setDepartments(org.departments);
      setStaff(org.staff);
    } catch (err) {
      message.error((err as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey, tabDataRefresh]);

  useEffect(() => {
    setPage(1);
  }, [keyword, showDisabled, selectedDeptId]);

  const deptMap = useMemo(
    () => new Map(departments.map((item) => [item.id, item.name])),
    [departments]
  );

  const enabledDepartments = useMemo(
    () => departments.filter((item) => item.enabled !== false),
    [departments]
  );

  const filteredStaff = useMemo(() => {
    const deptIds = getDepartmentDescendantIds(departments, selectedDeptId);
    const text = keyword.trim().toLowerCase();

    return staff.filter((item) => {
      if (!showDisabled && item.enabled === false) return false;
      if (!deptIds.has(item.departmentId)) return false;
      if (!text) return true;
      const haystack = [item.name, item.idNumber, item.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(text);
    });
  }, [departments, keyword, selectedDeptId, showDisabled, staff]);

  const pagedStaff = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStaff.slice(start, start + pageSize);
  }, [filteredStaff, page, pageSize]);

  const openStaffModal = (record: PayrollStaffMember | null = null) => {
    if (!enabledDepartments.length) {
      message.warning('请先维护部门');
      return;
    }
    setEditingStaff(record);
    staffForm.setFieldsValue(
      record
        ? {
            name: record.name,
            departmentId: record.departmentId,
            staffType: record.staffType || 'employee',
            gender: record.gender,
            idNumber: record.idNumber || '',
            phone: record.phone || '',
            remark: record.remark || ''
          }
        : {
            name: '',
            departmentId:
              selectedDeptId !== PAYROLL_COMPANY_ROOT_ID
                ? selectedDeptId
                : enabledDepartments[0]?.id,
            staffType: 'employee',
            gender: 'male',
            idNumber: '',
            phone: '',
            remark: ''
          }
    );
    setStaffModalOpen(true);
  };

  const saveStaff = async (values: StaffFormValues, keepOpen: boolean) => {
    setStaffSaving(true);
    try {
      await PayrollStaff.saveStaff({
        id: editingStaff?.id || '',
        name: values.name,
        departmentId: values.departmentId,
        staffType: values.staffType,
        gender: values.gender,
        idNumber: values.idNumber,
        phone: values.phone,
        remark: values.remark,
        enabled: editingStaff?.enabled !== false
      });
      message.success('职员已保存');
      refresh();
      await loadData();
      if (keepOpen) {
        setEditingStaff(null);
        staffForm.setFieldsValue({
          name: '',
          departmentId: values.departmentId,
          staffType: values.staffType || 'employee',
          gender: values.gender || 'male',
          idNumber: '',
          phone: '',
          remark: ''
        });
      } else {
        setStaffModalOpen(false);
      }
    } catch (err) {
      message.error((err as Error).message || '保存失败');
    } finally {
      setStaffSaving(false);
    }
  };

  const handleDeleteStaff = async (record: PayrollStaffMember) => {
    const ok = await confirmDanger(modal, {
      title: '删除职员？',
      content: `确定删除「${record.name}」吗？`
    });
    if (!ok) return;
    try {
      await PayrollStaff.removeStaff(record.id);
      message.success('职员已删除');
      setSelectedRowKeys((keys) => keys.filter((key) => key !== record.id));
      refresh();
      await loadData();
    } catch (err) {
      message.error((err as Error).message || '删除失败');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedRowKeys.length) {
      message.warning('请先选择职员');
      return;
    }
    const ok = await confirmDanger(modal, {
      title: '删除职员？',
      content: `确定删除选中的 ${selectedRowKeys.length} 名职员吗？`
    });
    if (!ok) return;
    try {
      await PayrollStaff.removeStaffMany(selectedRowKeys);
      message.success('已删除选中职员');
      setSelectedRowKeys([]);
      refresh();
      await loadData();
    } catch (err) {
      message.error((err as Error).message || '删除失败');
    }
  };

  const handleToggleEnabled = async (record: PayrollStaffMember, enabled: boolean) => {
    try {
      await PayrollStaff.saveStaff({ ...record, enabled });
      refresh();
      await loadData();
    } catch (err) {
      message.error((err as Error).message || '更新失败');
    }
  };

  const columns: ColumnsType<PayrollStaffMember> = [
    {
      title: '操作',
      key: 'actions',
      width: 72,
      render: (_, record) =>
        readOnly ? null : (
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label="编辑"
              onClick={() => openStaffModal(record)}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="删除"
              onClick={() => void handleDeleteStaff(record)}
            />
          </Space>
        )
    },
    { title: '姓名', dataIndex: 'name', width: 100, ellipsis: true },
    {
      title: '类型',
      dataIndex: 'staffType',
      width: 72,
      render: (value: PayrollStaffType | undefined) =>
        PAYROLL_STAFF_TYPE_LABELS[value || 'employee']
    },
    {
      title: '性别',
      dataIndex: 'gender',
      width: 72,
      render: (value: keyof typeof GENDER_LABELS | undefined) =>
        value ? GENDER_LABELS[value] : '—'
    },
    {
      title: '部门',
      dataIndex: 'departmentId',
      width: 120,
      ellipsis: true,
      render: (value) => deptMap.get(value) || '—'
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      width: 120,
      render: (value) => value || '—'
    },
    {
      title: '证件号码',
      dataIndex: 'idNumber',
      width: 160,
      ellipsis: true,
      render: (value) => value || '—'
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (value) => value || '—'
    },
    {
      title: '启用状态',
      key: 'enabled',
      width: 120,
      render: (_, record) =>
        readOnly ? (
          record.enabled === false ? '已禁用' : '已启用'
        ) : (
          <Switch
            checked={record.enabled !== false}
            checkedChildren="已启用"
            unCheckedChildren="已禁用"
            onChange={(checked) => void handleToggleEnabled(record, checked)}
          />
        )
    }
  ];

  return (
    <div className="payroll-staff-panel">
      <div className="payroll-staff-panel__toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="姓名/证件号码/手机号"
          value={keyword}
          className="payroll-staff-panel__search"
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Checkbox checked={showDisabled} onChange={(event) => setShowDisabled(event.target.checked)}>
          显示已禁用职员
        </Checkbox>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
          刷新
        </Button>
        {!readOnly ? (
          <Space className="payroll-staff-panel__toolbar-actions" size={8}>
            <Button type="primary" onClick={() => openStaffModal()}>
              新增
            </Button>
            <Button danger onClick={() => void handleBulkDelete()}>
              删除
            </Button>
          </Space>
        ) : null}
      </div>

      <div className="payroll-staff-panel__body">
        <PayrollDepartmentSidebar
          departments={departments}
          selectedId={selectedDeptId}
          onSelect={setSelectedDeptId}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
          onEditDepartments={() => setDeptSettingsOpen(true)}
          readOnly={readOnly}
        />

        <div className="payroll-staff-panel__main">
          <ScrollTable
            fillPage
            autoHeight
            size="small"
            bordered
            loading={loading}
            rowKey="id"
            columns={columns}
            dataSource={pagedStaff}
            pagination={false}
            rowSelection={
              readOnly
                ? undefined
                : {
                    selectedRowKeys,
                    onChange: (keys) => setSelectedRowKeys(keys.map(String))
                  }
            }
            locale={{ emptyText: '暂无数据' }}
            footer={
              <div className="table-scroll-footer payroll-staff-panel__pagination">
                <Pagination
                  size="small"
                  current={page}
                  pageSize={pageSize}
                  total={filteredStaff.length}
                  showSizeChanger
                  pageSizeOptions={[20, 50, 100, 500]}
                  showTotal={(total) => `共 ${total} 条`}
                  onChange={(nextPage, nextSize) => {
                    setPage(nextPage);
                    if (nextSize !== pageSize) setPageSize(nextSize);
                  }}
                />
              </div>
            }
          />
        </div>
      </div>

      <PayrollDepartmentSettingsModal
        open={deptSettingsOpen}
        departments={departments}
        onClose={() => setDeptSettingsOpen(false)}
        onSaved={loadData}
      />

      <Modal
        title={editingStaff ? '编辑职员' : '新增职员'}
        open={staffModalOpen}
        onCancel={() => setStaffModalOpen(false)}
        destroyOnHidden
        width={520}
        footer={
          <>
            <Button onClick={() => setStaffModalOpen(false)}>取消</Button>
            {!editingStaff ? (
              <Button
                loading={staffSaving}
                onClick={() =>
                  staffForm
                    .validateFields()
                    .then((values) => saveStaff(values, true))
                    .catch(() => undefined)
                }
              >
                保存并新增
              </Button>
            ) : null}
            <Button
              type="primary"
              loading={staffSaving}
              onClick={() =>
                staffForm
                  .validateFields()
                  .then((values) => saveStaff(values, false))
                  .catch(() => undefined)
              }
            >
              保存
            </Button>
          </>
        }
      >
        <Form form={staffForm} labelCol={{ span: 6 }} wrapperCol={{ span: 16 }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="departmentId"
            label="部门"
            rules={[{ required: true, message: '请选择部门' }]}
          >
            <Select
              placeholder="请选择部门"
              options={enabledDepartments.map((item) => ({ value: item.id, label: item.name }))}
            />
          </Form.Item>
          <Form.Item
            name="staffType"
            label="类型"
            rules={[{ required: true, message: '请选择类型' }]}
          >
            <Radio.Group>
              <Radio value="employee">雇员</Radio>
              <Radio value="temporary">临时</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <Radio.Group>
              <Radio value="male">男</Radio>
              <Radio value="female">女</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="idNumber" label="证件号码">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
