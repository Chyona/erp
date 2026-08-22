import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';
import {
  createSystemAccount,
  deleteSystemAccount,
  listSystemAccounts,
  resetSystemAccountPassword,
  updateSystemAccount,
  type SystemAccount
} from '../services/systemAccounts';
import { ROLE_LABEL, type Role } from '../utils/permissions';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const { Title } = Typography;

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: ROLE_LABEL.admin },
  { value: 'user', label: ROLE_LABEL.user },
  { value: 'readonly', label: ROLE_LABEL.readonly }
];

export default function Users() {
  const { message, modal } = App.useApp();
  const { can } = useAuth();
  const [rows, setRows] = useState<SystemAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<SystemAccount | null>(null);
  const [form] = Form.useForm();
  const [resetForm] = Form.useForm();
  const allowed = can('users');

  const load = async () => {
    setLoading(true);
    try {
      const data = await listSystemAccounts(1, 200);
      setRows(data.list || []);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await createSystemAccount({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
        nickname: (values.nickname || '').trim(),
        role: values.role
      });
      message.success('账号已创建，用户首次登录需设置自己的密码');
      setCreateOpen(false);
      form.resetFields();
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建失败');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    const values = await resetForm.validateFields();
    try {
      await resetSystemAccountPassword(resetTarget.id, values.password);
      message.success('密码已重置，用户下次登录需重新设置密码');
      setResetTarget(null);
      resetForm.resetFields();
      await load();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '重置失败');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          用户管理
        </Title>
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新建账号
        </Button>
      </div>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        新建账号时填写初始密码；用户首次登录后需自行设置密码。之后改密请使用「重置密码」。
      </Typography.Paragraph>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: '用户名', dataIndex: 'username' },
          { title: '昵称', dataIndex: 'nickname' },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '角色',
            dataIndex: 'role',
            render: (role: string) => ROLE_LABEL[role as Role] || role
          },
          {
            title: '状态',
            dataIndex: 'status',
            render: (status: number, record) => (
              <Space size={4}>
                {status === 1 ? <Tag color="green">正常</Tag> : <Tag>禁用</Tag>}
                {record.must_change_password ? <Tag color="orange">待设密</Tag> : null}
              </Space>
            )
          },
          {
            title: '操作',
            render: (_, record) => {
              if (record.role === 'admin') {
                return <Typography.Text type="secondary">—</Typography.Text>;
              }
              return (
                <Space wrap>
                  <Select
                    size="small"
                    style={{ width: 120 }}
                    value={(record.role as Role) || 'user'}
                    options={ROLE_OPTIONS.filter((o) => o.value !== 'admin')}
                    onChange={async (role) => {
                      try {
                        await updateSystemAccount(record.id, { role });
                        message.success('角色已更新');
                        await load();
                      } catch (err) {
                        message.error(err instanceof Error ? err.message : '更新失败');
                      }
                    }}
                  />
                  <Button
                    size="small"
                    onClick={() => {
                      resetForm.resetFields();
                      setResetTarget(record);
                    }}
                  >
                    重置密码
                  </Button>
                  <Button
                    size="small"
                    onClick={async () => {
                      const next = record.status === 1 ? 0 : 1;
                      try {
                        await updateSystemAccount(record.id, { status: next });
                        message.success(next === 1 ? '已启用' : '已禁用');
                        await load();
                      } catch (err) {
                        message.error(err instanceof Error ? err.message : '操作失败');
                      }
                    }}
                  >
                    {record.status === 1 ? '禁用' : '启用'}
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      modal.confirm({
                        title: '删除账号',
                        content: `确定删除账号 ${record.username}？`,
                        okButtonProps: { danger: true },
                        onOk: async () => {
                          try {
                            await deleteSystemAccount(record.id);
                            message.success('已删除');
                            await load();
                          } catch (err) {
                            message.error(err instanceof Error ? err.message : '删除失败');
                          }
                        }
                      });
                    }}
                  >
                    删除
                  </Button>
                </Space>
              );
            }
          }
        ]}
      />

      <Modal
        title="新建账号"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ role: 'user' }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            extra="用户首次登录后需自行设置新密码"
            rules={[{ required: true, min: 6, message: '至少 6 位' }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="nickname" label="昵称">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={resetTarget ? `重置密码：${resetTarget.username}` : '重置密码'}
        open={Boolean(resetTarget)}
        onCancel={() => setResetTarget(null)}
        onOk={handleResetPassword}
        destroyOnHidden
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="password"
            label="新的初始密码"
            extra="用户下次登录后需再次设置自己的密码"
            rules={[{ required: true, min: 6, message: '至少 6 位' }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
