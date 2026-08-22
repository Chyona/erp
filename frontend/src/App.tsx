import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import Dashboard from './pages/Dashboard';
import VoucherList from './pages/VoucherList';
import VoucherForm from './pages/VoucherForm';
import Accounts from './pages/Accounts';
import Ledger from './pages/Ledger';
import Reports from './pages/Reports';
import Audit from './pages/Audit';
import Users from './pages/Users';
import Settings from './pages/Settings';
import 'dayjs/locale/zh-cn';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import weekday from 'dayjs/plugin/weekday';
import localeData from 'dayjs/plugin/localeData';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import weekYear from 'dayjs/plugin/weekYear';

dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(weekday);
dayjs.extend(localeData);
dayjs.extend(weekOfYear);
dayjs.extend(weekYear);
dayjs.locale('zh-cn');

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1a56db',
          borderRadius: 8,
          fontFamily: '"Microsoft YaHei", "PingFang SC", -apple-system, sans-serif',
          colorBgSpotlight: '#ffffff'
        },
        components: {
          Tooltip: {
            colorBgSpotlight: '#ffffff'
          },
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
        <AuthProvider>
          <AppProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/setup-password" element={<SetupPassword />} />
                <Route element={<RequireAuth />}>
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="vouchers" element={<VoucherList />} />
                    <Route path="vouchers/new" element={<VoucherForm />} />
                    <Route path="vouchers/:id/edit" element={<VoucherForm />} />
                    <Route path="accounts" element={<Accounts />} />
                    <Route path="ledger" element={<Ledger />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="audit" element={<Audit />} />
                    <Route path="users" element={<Users />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </AppProvider>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
