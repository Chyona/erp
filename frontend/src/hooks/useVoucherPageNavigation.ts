import { useCallback } from 'react';
import { usePageTabs } from '../context/PageTabsContext';

export function useVoucherPageNavigation() {
  const { openPageTab } = usePageTabs();

  const openNewVoucher = useCallback(
    (path = '/vouchers/new') => {
      openPageTab(path);
    },
    [openPageTab]
  );

  const openVoucherEdit = useCallback(
    (id: string | number) => {
      openPageTab(`/vouchers/${id}/edit`);
    },
    [openPageTab]
  );

  return { openNewVoucher, openVoucherEdit };
}
