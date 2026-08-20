import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Account, AppContextValue } from '../types';

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [companyName, setCompanyName] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <AppContext.Provider
      value={{ companyName, setCompanyName, accounts, setAccounts, refreshKey, refresh }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
