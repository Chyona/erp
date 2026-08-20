import { useEffect, useState, type ReactNode } from 'react';
import { Spin } from 'antd';
import { DB } from '../services/db';
import { Accounts } from '../services/accounts';
import { repairFinanceInterestEntries } from '../services/financeExpenseRepair';
import { TaxDeclaration } from '../services/taxDeclaration';
import { useApp } from '../context/AppContext';

export default function AppInit({ children }: { children: ReactNode }) {
  const { setCompanyName, setAccounts, refresh, refreshKey } = useApp();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await DB.open();
      await Accounts.init();
      const repaired = await repairFinanceInterestEntries();
      const syncedLocks = await TaxDeclaration.syncDeclaredQuarterVoucherLocks();
      const name = await DB.getSetting('companyName');
      const accs = await Accounts.getAll();
      if (!cancelled) {
        setCompanyName(typeof name === 'string' ? name : '');
        setAccounts(accs);
        setReady(true);
        if (repaired > 0 || syncedLocks > 0) {
          refresh();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, setCompanyName, setAccounts, refresh]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中...">
          <div style={{ minHeight: 48, minWidth: 48 }} />
        </Spin>
      </div>
    );
  }

  return children;
}
