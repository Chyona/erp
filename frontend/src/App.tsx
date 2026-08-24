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
import GeneralLedger from './pages/GeneralLedger';
import Reports from './pages/Reports';
import ClosingPeriodEnd from './pages/ClosingPeriodEnd';
import ClosingReimbursement from './pages/ClosingReimbursement';
import Audit from './pages/Audit';
import Users from './pages/Users';
import Settings from './pages/Settings';
import BackupRestore from './pages/BackupRestore';
import './utils/dayjsSetup';

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1a56db',
          borderRadius: 8,
          fontFamily: '"Microsoft YaHei", "PingFang SC", -apple-system, sans-serif',
          colorBgSpotlight: '#ffffff',
          fontSize: 14,
          fontSizeSM: 12,
          fontSizeLG: 16
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
            rowHoverBg: '#eef6ff',
            cellPaddingBlock: 8,
            cellPaddingInline: 12,
            fontSize: 14
          },
          Form: {
            labelFontSize: 14
          },
          Input: {
            fontSize: 14
          },
          Select: {
            fontSize: 14
          },
          Button: {
            contentFontSize: 14
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
                    <Route path="general-ledger" element={<GeneralLedger />} />
                    <Route path="ledger" element={<Ledger />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="closing/period-end" element={<ClosingPeriodEnd />} />
                    <Route path="closing/reimbursement" element={<ClosingReimbursement />} />
                    <Route path="audit" element={<Audit />} />
                    <Route path="users" element={<Users />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="backup-restore" element={<BackupRestore />} />
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
