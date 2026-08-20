import { Layout, Menu, Button, Typography, App } from 'antd';
import {
  DashboardOutlined,
  FileTextOutlined,
  PlusOutlined,
  BookOutlined,
  ReadOutlined,
  FundOutlined,
  AuditOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { DB } from '../services/db.js';
import { ExportUtil } from '../services/export.js';
import { useApp } from '../context/AppContext.jsx';
import { confirmWarning } from '../utils/confirmAction.js';

const { Sider, Header, Content } = Layout;

const NAV_ITEMS = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台' },
  { key: '/vouchers', icon: <FileTextOutlined />, label: '凭证管理' },
  { key: '/vouchers/new', icon: <PlusOutlined />, label: '新建凭证' },
  { key: '/accounts', icon: <BookOutlined />, label: '会计科目' },
  { key: '/ledger', icon: <ReadOutlined />, label: '明细账' },
  { key: '/reports', icon: <FundOutlined />, label: '财务报表' },
  { key: '/audit', icon: <AuditOutlined />, label: '审计日志' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' }
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { message, modal } = App.useApp();
  const { companyName, refresh } = useApp();

  const menuKey = location.pathname.includes('/edit') || location.pathname.startsWith('/vouchers/new')
    ? '/vouchers/new'
    : NAV_ITEMS.find((item) => item.key !== '/' && location.pathname.startsWith(item.key))?.key ||
      (location.pathname === '/' ? '/' : location.pathname);

  const handleBackup = async () => {
    const data = await DB.exportAll();
    const json = JSON.stringify(data, null, 2);
    ExportUtil.downloadBlob(
      json,
      `凭证系统备份_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json'
    );
    await DB.addAuditLog('备份', '全库', `${data.vouchers.length} 条凭证`);
    message.success('备份文件已下载');
  };

  const handleRestore = async () => {
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
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.vouchers) throw new Error('无效的备份文件');
        await DB.importAll(data);
        await DB.addAuditLog('恢复', '全库', `从备份恢复 ${data.vouchers.length} 条凭证`);
        message.success('数据恢复成功');
        refresh();
        navigate('/');
      } catch (err) {
        message.error('恢复失败：' + err.message);
      }
    };
    input.click();
  };

  return (
    <Layout className="app-layout">
      <Sider width={220} theme="dark" className="app-sider">
        <div className="sidebar-logo">
          <span className="logo-icon">📒</span>
          <Typography.Title level={5} style={{ color: '#fff', margin: 0 }}>
            电子凭证
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[menuKey]}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
          className="sidebar-menu"
        />
        <div className="sidebar-footer">
          <small>数据本地存储 · 不上传云端</small>
        </div>
      </Sider>
      <Layout className="app-main">
        <Header className="topbar">
          <Typography.Text strong>
            {companyName || '请先在设置中填写企业信息'}
          </Typography.Text>
          <div>
            <Button onClick={handleBackup} style={{ marginRight: 8 }}>
              备份数据
            </Button>
            <Button onClick={handleRestore}>恢复数据</Button>
          </div>
        </Header>
        <Content className="main-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
