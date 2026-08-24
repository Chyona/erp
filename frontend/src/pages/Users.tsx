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
import { toUserMessage } from '../utils/userMessage';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

/** 邮箱选填：有内容时才校验格式，空值/纯空格不校验 */
const optionalEmailRules = [
  {
    validator: (_: unknown, value: unknown) => {
      const email = String(value ?? '').trim();
      if (!email) return Promise.resolve();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Promise.reject(new Error('请填写有效邮箱'));
      }
      return Promise.resolve();
    }
  }
];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: ROLE_LABEL.admin },
  { value: 'user', label: ROLE_LABEL.user },
  { value: 'readonly', label: ROLE_LABEL.readonly }
];

/** 仅用户名为 admin 的内置账号不可在此管理（不可改角色/禁用/删除）。 */
function isBuiltinAdminAccount(record: SystemAccount): boolean {
  return record.username === 'admin';
}

export default function Users() {
  const { message, modal } = App.useApp();
  const { can, user, patchUser } = useAuth();
  const [rows, setRows] = useState<SystemAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SystemAccount | null>(null);
  const [resetTarget, setResetTarget] = useState<SystemAccount | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const allowed = can('users');

  const load = async () => {
    setLoading(true);
    try {
      const data = await listSystemAccounts(1, 200);
      const list = [...(data.list || [])].sort((a, b) => {
        if (a.username === 'admin') return -1;
        if (b.username === 'admin') return 1;
        return b.id - a.id;
      });
      setRows(list);
    } catch (err) {
      message.error(toUserMessage(err, '加载失败'));
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
    try {
      const values = await form.validateFields();
      const email = String(values.email ?? '').trim();
      await createSystemAccount({
        username: values.username.trim(),
        ...(email ? { email } : {}),
        password: values.password,
        nickname: (values.nickname || '').trim(),
        role: values.role
      });
      message.success('账号已创建，用户首次登录需设置自己的密码');
      setCreateOpen(false);
      form.resetFields();
      await load();
    } catch (err) {
      if ((err as { errorFields?: unknown[] })?.errorFields) return;
      message.error(toUserMessage(err, '创建失败'));
    }
  };

  const handleEditProfile = async () => {
    if (!editTarget) return;
    try {
      const values = await editForm.validateFields();
      const email = String(values.email ?? '').trim();
      await updateSystemAccount(editTarget.id, {
        nickname: (values.nickname || '').trim(),
        email,
        phone: (values.phone || '').trim(),
        remark: (values.remark || '').trim()
      });
      if (editTarget.id === user?.accountId) {
        patchUser({ nickname: (values.nickname || '').trim() });
      }
      message.success('资料已更新');
      setEditTarget(null);
      editForm.resetFields();
      await load();
    } catch (err) {
      if ((err as { errorFields?: unknown[] })?.errorFields) return;
      message.error(toUserMessage(err, '更新失败'));
    }
  };

  const openEditProfile = (record: SystemAccount) => {
    editForm.setFieldsValue({
      nickname: record.nickname || '',
      email: record.email || '',
      phone: record.phone || '',
      remark: record.remark || ''
    });
    setEditTarget(record);
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    const values = await resetForm.validateFields();
    try {
      await resetSystemAccountPassword(resetTarget.id, values.password);
      const isSelf = user?.accountId === resetTarget.id;
      message.success(
        isSelf ? '密码已修改' : '密码已重置，用户下次登录需重新设置密码'
      );
      setResetTarget(null);
      resetForm.resetFields();
      await load();
    } catch (err) {
      message.error(toUserMessage(err, '重置失败'));
    }
  };

  return (
    <div>
      <div className="page-header page-header--actions-only">
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          新建账号
        </Button>
      </div>

      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        新建账号时填写初始密码；用户首次登录后需自行设置密码。之后可在右上角「修改密码」，或由管理员「重置密码」。管理员可编辑各账号的昵称、邮箱等资料；内置
        admin 仅可改资料与密码，不可删除或降权。
      </Typography.Paragraph>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={false}
        columns={[
          {
            title: '用户名',
            dataIndex: 'username',
            render: (username: string) => (
              <Space size={4}>
                {username}
                {username === 'admin' ? <Tag color="blue">内置</Tag> : null}
              </Space>
            )
          },
          { title: '昵称', dataIndex: 'nickname' },
          { title: '邮箱', dataIndex: 'email' },
          {
            title: '手机',
            dataIndex: 'phone',
            render: (phone: string) => phone || '—'
          },
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
              if (isBuiltinAdminAccount(record)) {
                return (
                  <Space wrap>
                    <Button size="small" onClick={() => openEditProfile(record)}>
                      编辑资料
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        resetForm.resetFields();
                        setResetTarget(record);
                      }}
                    >
                      修改密码
                    </Button>
                  </Space>
                );
              }
              return (
                <Space wrap>
                  <Button size="small" onClick={() => openEditProfile(record)}>
                    编辑资料
                  </Button>
                  <Select
                    size="small"
                    style={{ width: 120 }}
                    value={(record.role as Role) || 'user'}
                    options={ROLE_OPTIONS}
                    onChange={async (role) => {
                      try {
                        await updateSystemAccount(record.id, { role });
                        message.success('角色已更新');
                        await load();
                      } catch (err) {
                        message.error(toUserMessage(err, '更新失败'));
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
                        message.error(toUserMessage(err, '操作失败'));
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
                            message.error(toUserMessage(err, '删除失败'));
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
          <Form.Item name="email" label="邮箱" rules={optionalEmailRules}>
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
        title={editTarget ? `编辑资料：${editTarget.username}` : '编辑资料'}
        open={Boolean(editTarget)}
        onCancel={() => setEditTarget(null)}
        onOk={handleEditProfile}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="nickname" label="昵称">
            <Input placeholder="显示名称" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={optionalEmailRules}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          resetTarget
            ? user?.accountId === resetTarget.id
              ? `修改密码：${resetTarget.username}`
              : `重置密码：${resetTarget.username}`
            : '重置密码'
        }
        open={Boolean(resetTarget)}
        onCancel={() => setResetTarget(null)}
        onOk={handleResetPassword}
        destroyOnHidden
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="password"
            label={user?.accountId === resetTarget?.id ? '新密码' : '新的初始密码'}
            extra={
              user?.accountId === resetTarget?.id
                ? '修改后立即生效'
                : '用户下次登录后需再次设置自己的密码'
            }
            rules={[{ required: true, min: 6, message: '至少 6 位' }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
