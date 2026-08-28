import { Layout, Typography, App, Space, Modal, Form, Input, Dropdown, Avatar } from 'antd';
import type { MenuProps } from 'antd';
import {
  LogoutOutlined,
  LockOutlined,
  UserOutlined,
  DownOutlined,
  SunOutlined,
  MoonOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Suspense, useState } from 'react';
import { PageTabsProvider } from '../context/PageTabsContext';
import PageTabBar from '../components/PageTabBar';
import EllipsisText from '../components/EllipsisText';
import KeepAliveOutlet from '../components/KeepAliveOutlet';
import AppSidebar from '../components/AppSidebar';
import AppSpin from '../components/AppSpin';
import { changePasswordRequest } from '../services/auth';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { APP_CONFIG } from '../config/app';
import { toUserMessage } from '../utils/userMessage';

const { Sider, Header, Content } = Layout;
const SIDER_COLLAPSED_KEY = 'erp_sider_collapsed';
const SIDER_THEME_KEY = 'erp_sider_theme';
type SiderTheme = 'dark' | 'light';

export default function MainLayout() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { companyName } = useApp();
  const { user, logout } = useAuth();
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
    <PageTabsProvider>
      <Layout className="app-layout">
        <Sider
          width={120}
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
            <span className="sidebar-logo__title">{APP_CONFIG.shortName}</span>
          </div>
          <AppSidebar collapsed={collapsed} theme={siderTheme} />
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
              <Dropdown
                menu={{ items: userMenuItems }}
                trigger={['hover']}
                placement="bottomRight"
                overlayClassName="topbar-user-menu"
              >
                <button
                  type="button"
                  className="topbar-user"
                  aria-label={`${displayName}，打开账户菜单`}
                  aria-haspopup="menu"
                >
                  <Avatar size={28} icon={<UserOutlined />} className="topbar-user__avatar" />
                  <EllipsisText className="topbar-user__name" tooltip={displayName}>
                    {displayName}
                  </EllipsisText>
                  <DownOutlined className="topbar-user__caret" aria-hidden="true" />
                </button>
              </Dropdown>
            </Space>
          </Header>
          <Content className="main-content">
            <PageTabBar />
            <Suspense
              fallback={
                <AppSpin size="large" tip="加载页面…">
                  <div style={{ minHeight: 160 }} />
                </AppSpin>
              }
            >
              <KeepAliveOutlet />
            </Suspense>
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
              rules={[{ required: true, min: 8, message: '新密码至少 8 位' }]}
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
    </PageTabsProvider>
  );
}
