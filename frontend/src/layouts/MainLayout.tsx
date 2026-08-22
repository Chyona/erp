import { Layout, Menu, Button, Typography, App, Space, Modal, Form, Input } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  PlusOutlined,
  BookOutlined,
  ReadOutlined,
  FundOutlined,
  AuditOutlined,
  SettingOutlined,
  LogoutOutlined,
  TeamOutlined,
  LockOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { ErpApi } from '../services/erpApi';
import { ExportUtil } from '../services/export';
import { changePasswordRequest } from '../services/auth';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { confirmWarning } from '../utils/confirmAction';
import { APP_CONFIG } from '../config/app';
import { ROLE_LABEL } from '../utils/permissions';
import { toUserMessage } from '../utils/userMessage';

const { Sider, Header, Content } = Layout;

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message, modal } = App.useApp();
  const { companyName, refresh } = useApp();
  const { user, logout, can } = useAuth();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [pwdSaving, setPwdSaving] = useState(false);

  const navItems = useMemo(() => {
    const items = [
      { key: '/', icon: <DashboardOutlined />, label: '工作台' },
    ];
    if (can('voucher.create')) {
      items.push({ key: '/vouchers/new', icon: <PlusOutlined />, label: '新建凭证' });
    }
    items.push(
      { key: '/vouchers', icon: <FileTextOutlined />, label: '凭证管理' },
      { key: '/accounts', icon: <BookOutlined />, label: '会计科目' },
      { key: '/ledger', icon: <ReadOutlined />, label: '明细账' },
      { key: '/reports', icon: <FundOutlined />, label: '财务报表' },
      { key: '/audit', icon: <AuditOutlined />, label: '审计日志' }
    );
    if (can('users')) {
      items.push({ key: '/users', icon: <TeamOutlined />, label: '用户管理' });
    }
    if (can('settings')) {
      items.push({ key: '/settings', icon: <SettingOutlined />, label: '系统设置' });
    }
    return items;
  }, [can]);

  const menuKey = location.pathname.includes('/edit') || location.pathname.startsWith('/vouchers/new')
    ? '/vouchers/new'
    : navItems.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key ||
    (location.pathname === '/' ? '/' : location.pathname);

  const handleBackup = async () => {
    if (!can('backup')) {
      message.warning('当前账号无权备份');
      return;
    }
    const data = await ErpApi.exportAll();
    const json = JSON.stringify(data, null, 2);
    ExportUtil.downloadBlob(
      json,
      `凭证系统备份_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    await ErpApi.addAuditLog('备份', '全库', `${data.vouchers.length} 条凭证`);
    message.success('备份文件已下载');
  };

  const handleRestore = async () => {
    if (!can('restore')) {
      message.warning('当前账号无权恢复数据');
      return;
    }
    const ok = await confirmWarning(modal, {
      title: '确定恢复数据？',
      content: '恢复备份将覆盖现有全部数据（凭证、科目、设置等），此操作不可撤销。',
      okText: '选择备份文件'
    });
    if (!ok) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.vouchers) throw new Error('无效的备份文件');
        await ErpApi.importAll(data);
        await ErpApi.addAuditLog('恢复', '全库', `从备份恢复 ${data.vouchers.length} 条凭证`);
        message.success('数据恢复成功');
        refresh();
        navigate('/');
      } catch (err) {
        message.error('恢复失败：' + toUserMessage(err));
      }
    };
    input.click();
  };

  const handleChangePassword = async () => {
    const values = await pwdForm.validateFields();
    setPwdSaving(true);
    try {
      await changePasswordRequest(values.oldPassword, values.newPassword);
      message.success('密码已修改');
      setPwdOpen(false);
      pwdForm.resetFields();
    } catch (err) {
      message.error(toUserMessage(err, '修改密码失败'));
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <Layout className="app-layout">
      <Sider width={220} theme="dark" className="app-sider">
        <div className="sidebar-logo">
          <span className="logo-icon">📒</span>
          <Typography.Title level={5} style={{ color: '#fff', margin: 0 }} title={APP_CONFIG.name}>
            {APP_CONFIG.shortName}
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuKey]}
          items={navItems}
          onClick={({ key }) => navigate(key)}
          className="sidebar-menu"
        />
        <div className="sidebar-footer">
          <small>{APP_CONFIG.footer}</small>
        </div>
      </Sider>
      <Layout className="app-main">
        <Header className="topbar">
          <Typography.Text strong>
            {companyName || '请先在设置中填写企业信息'}
          </Typography.Text>
          <Space>
            <Typography.Text type="secondary">
              {user?.nickname || user?.username || ''}
              {user?.role ? `（${ROLE_LABEL[user.role] || user.role}）` : ''}
            </Typography.Text>
            <Button
              icon={<LockOutlined />}
              onClick={() => {
                pwdForm.resetFields();
                setPwdOpen(true);
              }}
            >
              修改密码
            </Button>
            {can('backup') ? <Button onClick={handleBackup}>备份数据</Button> : null}
            {can('restore') ? <Button onClick={handleRestore}>恢复数据</Button> : null}
            <Button
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="main-content">
          <Outlet />
        </Content>
      </Layout>

      <Modal
        title="修改密码"
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        onOk={handleChangePassword}
        confirmLoading={pwdSaving}
        destroyOnHidden
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item
            name="oldPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, min: 6, message: '新密码至少 6 位' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的新密码不一致'));
                }
              })
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
