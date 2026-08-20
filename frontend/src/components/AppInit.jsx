import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { DB } from '../services/db.js';
import { Accounts } from '../services/accounts.js';
import { useApp } from '../context/AppContext.jsx';

export default function AppInit({ children }) {
  const { setCompanyName, setAccounts, refreshKey } = useApp();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await DB.open();
      await Accounts.init();
      const name = await DB.getSetting('companyName');
      const accs = await Accounts.getAll();
      if (!cancelled) {
        setCompanyName(name || '');
        setAccounts(accs);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, setCompanyName, setAccounts]);

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
