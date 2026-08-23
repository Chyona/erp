import { Layout, Menu, Button, Typography, App, Space, Modal, Form, Input, Dropdown, Avatar } from 'antd';
import type { MenuProps } from 'antd';
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
  LockOutlined,
  UserOutlined,
  DownOutlined,
  SunOutlined,
  MoonOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
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
import { toUserMessage } from '../utils/userMessage';

const { Sider, Header, Content } = Layout;
const SIDER_COLLAPSED_KEY = 'erp_sider_collapsed';
const SIDER_THEME_KEY = 'erp_sider_theme';
type SiderTheme = 'dark' | 'light';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message, modal } = App.useApp();
  const { companyName, reinitApp } = useApp();
  const { user, logout, can } = useAuth();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm] = Form.useForm();
  const [pwdSaving, setPwdSaving] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDER_COLLAPSED_KEY) === '1'
  );
  const [siderTheme, setSiderTheme] = useState<SiderTheme>(() => {
    const stored = localStorage.getItem(SIDER_THEME_KEY);
    return stored === 'light' ? 'light' : 'dark';
  });

  const handleSiderCollapse = (value: boolean) => {
    setCollapsed(value);
    localStorage.setItem(SIDER_COLLAPSED_KEY, value ? '1' : '0');
  };

  const toggleSiderTheme = () => {
    setSiderTheme((prev) => {
      const next: SiderTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(SIDER_THEME_KEY, next);
      return next;
    });
  };

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
        await reinitApp();
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

  const displayName = user?.nickname || user?.username || '';
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'password',
      icon: <LockOutlined />,
      label: '修改密码',
      onClick: () => {
        pwdForm.resetFields();
        setPwdOpen(true);
      }
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出',
      danger: true,
      onClick: () => {
        logout();
        navigate('/login', { replace: true });
      }
    }
  ];

  return (
    <Layout className="app-layout">
      <Sider
        width={160}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        onCollapse={handleSiderCollapse}
        trigger={null}
        theme={siderTheme}
        className={`app-sider app-sider--${siderTheme}`}
      >
        <div className="sidebar-logo">
          <span className="logo-icon">📒</span>
          <span className="sidebar-logo__title" title={APP_CONFIG.name}>
            {APP_CONFIG.shortName}
          </span>
        </div>
        <Menu
          theme={siderTheme}
          mode="inline"
          selectedKeys={[menuKey]}
          items={navItems}
          onClick={({ key }) => navigate(key)}
          className="sidebar-menu"
        />
        <div className="sidebar-toolbar">
          <button
            type="button"
            className="sidebar-toolbar__btn"
            aria-label={siderTheme === 'dark' ? '切换为浅色导航' : '切换为深色导航'}
            onClick={toggleSiderTheme}
          >
            {siderTheme === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          </button>
          <span className="sidebar-toolbar__divider" aria-hidden="true" />
          <button
            type="button"
            className="sidebar-toolbar__btn"
            aria-label={collapsed ? '展开导航' : '折叠导航'}
            onClick={() => handleSiderCollapse(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>
      </Sider>
      <Layout className="app-main">
        <Header className="topbar">
          <Typography.Text strong>
            {companyName || '请先在设置中填写企业信息'}
          </Typography.Text>
          <Space size={12} className="topbar__actions">
            {can('backup') ? <Button onClick={handleBackup}>备份数据</Button> : null}
            {can('restore') ? <Button onClick={handleRestore}>恢复数据</Button> : null}
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['hover']}
              placement="bottomRight"
              overlayClassName="topbar-user-menu"
            >
              <button
                type="button"
                className="topbar-user"
                title={`${displayName} · 账户菜单`}
                aria-label={`${displayName}，打开账户菜单`}
                aria-haspopup="menu"
              >
                <Avatar size={28} icon={<UserOutlined />} className="topbar-user__avatar" />
                <span className="topbar-user__name">{displayName}</span>
                <DownOutlined className="topbar-user__caret" aria-hidden="true" />
              </button>
            </Dropdown>
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
