import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AppProvider } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import './utils/dayjsSetup';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const VoucherList = lazy(() => import('./pages/VoucherList'));
const VoucherForm = lazy(() => import('./pages/VoucherForm'));
const Accounts = lazy(() => import('./pages/Accounts'));
const Ledger = lazy(() => import('./pages/Ledger'));
const GeneralLedger = lazy(() => import('./pages/GeneralLedger'));
const Reports = lazy(() => import('./pages/Reports'));
const ClosingPeriodEnd = lazy(() => import('./pages/ClosingPeriodEnd'));
const ClosingReimbursement = lazy(() => import('./pages/ClosingReimbursement'));
const Payroll = lazy(() => import('./pages/Payroll'));
const PayrollSheet = lazy(() => import('./pages/PayrollSheet'));
const PayrollSheetDetail = lazy(() => import('./pages/PayrollSheetDetail'));
const PayrollStats = lazy(() => import('./pages/PayrollStats'));
const PayrollStaff = lazy(() => import('./pages/PayrollStaff'));
const Audit = lazy(() => import('./pages/Audit'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const BackupRestore = lazy(() => import('./pages/BackupRestore'));

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
                    <Route path="closing/salary" element={<Navigate to="/payroll/sheet" replace />} />
                    <Route path="payroll" element={<Payroll />} />
                    <Route path="payroll/sheet" element={<PayrollSheet />} />
                    <Route path="payroll/sheet/:periodKey" element={<PayrollSheetDetail />} />
                    <Route path="payroll/stats" element={<PayrollStats />} />
                    <Route path="payroll/staff" element={<PayrollStaff />} />
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
