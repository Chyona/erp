import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Space, App } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useLocation, useParams } from 'react-router-dom';
import SalaryPayrollTable from './SalaryPayrollTable';
import {
  Salary,
  calcSalaryRow,
  calcSalaryTotals,
  createSalaryRow,
  type PayrollPeriodData,
  type PayrollPeriodView
} from '../services/salary';
import { PayrollStaff } from '../services/payrollStaff';
import { useApp } from '../context/AppContext';
import { usePageTabs, useTabDataRefresh, useTabPaneKey } from '../context/PageTabsContext';
import { useAuth } from '../context/AuthContext';
import { confirmDanger } from '../utils/confirmAction';
import { resolveTabIdentity } from '../utils/pageTabs';

const PAYROLL_SHEET_LIST_PATH = '/payroll/sheet';

export default function PayrollSheetDetailPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { message, modal } = App.useApp();
  const { periodKey = '' } = useParams();
  const location = useLocation();
  const paneKey = useTabPaneKey();
  const { closeTabAndOpen } = usePageTabs();
  const { refreshKey, refresh } = useApp();
  const { user } = useAuth();
  const tabDataRefresh = useTabDataRefresh();
  const [data, setData] = useState<PayrollPeriodView | null>(null);
  const [staffMembers, setStaffMembers] = useState<Awaited<ReturnType<typeof PayrollStaff.getAll>>['staff']>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [keyword, setKeyword] = useState('');

  const periodLabel = Salary.formatPeriodLabel(periodKey);

  const exitToPayrollSheetList = useCallback(() => {
    const closingKey =
      paneKey ?? resolveTabIdentity(location.pathname, location.search).key;
    closeTabAndOpen(closingKey, PAYROLL_SHEET_LIST_PATH);
  }, [paneKey, location.pathname, location.search, closeTabAndOpen]);

  const deletePeriodAndExit = useCallback(
    async (options: { successMessage?: string } = {}) => {
      try {
        await Salary.deletePeriod(periodKey);
        refresh();
        if (options.successMessage) message.success(options.successMessage);
        exitToPayrollSheetList();
      } catch (err) {
        message.error((err as Error).message || '删除失败');
      }
    },
    [periodKey, refresh, exitToPayrollSheetList, message]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sheet, org] = await Promise.all([
        Salary.getPeriod(periodKey),
        PayrollStaff.getAll()
      ]);
      setData(sheet);
      setStaffMembers(org.staff);
    } catch (err) {
      message.error((err as Error).message || '加载失败');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodKey, message]);

  useEffect(() => {
    void loadData();
  }, [loadData, refreshKey, tabDataRefresh]);

  const filteredRows = useMemo(() => {
    const rows = data?.salaryRowsCalculated ?? [];
    const text = keyword.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(text));
  }, [data, keyword]);

  const persist = useCallback(
    async (nextData: PayrollPeriodData, options: { silent?: boolean } = {}) => {
      setSaving(true);
      try {
        await Salary.savePeriod({
          ...nextData,
          createdBy: nextData.createdBy || user?.nickname || user?.username,
          creationMethod: nextData.creationMethod || data?.creationMethod || 'manual'
        });
        const refreshed = await Salary.getPeriod(periodKey);
        setData(refreshed);
        refresh();
        if (!options.silent) message.success('已保存');
      } catch (err) {
        message.error((err as Error).message || '保存失败');
      } finally {
        setSaving(false);
      }
    },
    [periodKey, data?.creationMethod, message, refresh, user?.nickname, user?.username]
  );

  const updateRows = (salaryRows: PayrollPeriodData['salaryRows']) => {
    if (!data) return;
    const salaryRowsCalculated = salaryRows.map(calcSalaryRow);
    setData((prev) =>
      prev
        ? {
            ...prev,
            salaryRows,
            salaryRowsCalculated,
            salaryTotals: calcSalaryTotals(salaryRows)
          }
        : prev
    );
  };

  const handleSave = async () => {
    if (!data) return;
    await persist({
      periodKey,
      salaryCategory: data.salaryCategory,
      creationMethod: data.creationMethod,
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      voucherLinks: data.voucherLinks,
      salaryRows: data.salaryRows,
      laborRows: data.laborRows
    });
  };

  const handleDeleteSheet = async () => {
    const ok = await confirmDanger(modal, {
      title: '删除工资表？',
      content: `确定删除「${periodLabel}」工资表吗？`
    });
    if (!ok) return;
    await deletePeriodAndExit({ successMessage: '已删除' });
  };

  return (
    <div className="payroll-sheet-detail-panel">
      <div className="payroll-sheet-detail-panel__toolbar">
        <Space wrap size={12} align="center">
          <span className="payroll-sheet-detail-panel__period">{periodLabel}</span>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="姓名"
            value={keyword}
            className="payroll-sheet-detail-panel__search"
            onChange={(event) => setKeyword(event.target.value)}
          />
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void loadData()}>
            刷新
          </Button>
        </Space>
        {!readOnly ? (
          <Space wrap size={8} className="payroll-sheet-detail-panel__actions">
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>
              保存
            </Button>
            <Button icon={<DownloadOutlined />} disabled>
              导出
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={() => void handleDeleteSheet()}>
              删除
            </Button>
          </Space>
        ) : null}
      </div>

      <div className="payroll-sheet-detail-panel__table">
        <SalaryPayrollTable
          periodKey={periodKey}
          rows={filteredRows}
          totals={
            data?.salaryTotals ?? {
              baseSalary: 0,
              allowance: 0,
              performanceBonus: 0,
              subsidy: 0,
              absenceDeduction: 0,
              preTaxSalary: 0,
              pension: 0,
              medical: 0,
              unemployment: 0,
              criticalIllness: 0,
              housingFund: 0,
              socialSecurityTotal: 0,
              otherDeduction: 0,
              cumulativeIncome: 0,
              cumulativeSpecialDeduction: 0,
              childEducation: 0,
              housingLoan: 0,
              housingRent: 0,
              elderlySupport: 0,
              continuingEducation: 0,
              infantCare: 0,
              cumulativeSpecialAdditionalTotal: 0,
              cumulativeOtherDeduction: 0,
              cumulativeTaxPayable: 0,
              cumulativeTaxPaid: 0,
              withheldTax: 0,
              netSalary: 0
            }
          }
          staffMembers={staffMembers}
          readOnly={readOnly}
          loading={loading || saving}
          onChange={(rows) => updateRows(rows)}
          onAddRow={() => {
            if (!data) return;
            updateRows([...data.salaryRows, createSalaryRow(periodKey)]);
          }}
          onRemoveRow={(id) => {
            if (!data || readOnly) return;
            const nextRows = data.salaryRows.filter((row) => row.id !== id);
            if (nextRows.length === 0) {
              void deletePeriodAndExit({ successMessage: '工资表已删除' });
              return;
            }
            updateRows(nextRows);
          }}
        />
      </div>
    </div>
  );
}
