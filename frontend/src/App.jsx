import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from './context/AppContext.jsx';
import AppInit from './components/AppInit.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import VoucherList from './pages/VoucherList.jsx';
import VoucherForm from './pages/VoucherForm.jsx';
import Accounts from './pages/Accounts.jsx';
import Ledger from './pages/Ledger.jsx';
import Reports from './pages/Reports.jsx';
import Audit from './pages/Audit.jsx';
import Settings from './pages/Settings.jsx';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';

dayjs.locale('zh-cn');

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1a56db',
          borderRadius: 8,
          fontFamily: '"Microsoft YaHei", "PingFang SC", -apple-system, sans-serif'
        },
        components: {
          Table: {
            headerBg: '#f0f2f5',
            headerColor: '#374151',
            headerSplitColor: '#e5e7eb',
            borderColor: '#e5e7eb',
            rowHoverBg: '#f8fafc',
            cellPaddingBlock: 8,
            cellPaddingInline: 12,
            fontSize: 13
          }
        }
      }}
    >
      <AntApp>
        <AppProvider>
          <AppInit>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="vouchers" element={<VoucherList />} />
                  <Route path="vouchers/new" element={<VoucherForm />} />
                  <Route path="vouchers/:id/edit" element={<VoucherForm />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="ledger" element={<Ledger />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="audit" element={<Audit />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AppInit>
        </AppProvider>
      </AntApp>
    </ConfigProvider>
  );
}
