import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { listSystemAccounts } from '../services/systemAccounts';
import {
  buildOperatorDisplayLookup,
  type OperatorDisplayLookup
} from '../utils/operatorDisplayName';

function lookupFromAuthUser(user: {
  accountId?: number;
  username?: string;
  nickname?: string;
} | null): OperatorDisplayLookup {
  if (!user) {
    return { byId: new Map(), byUsername: new Map(), byLabel: new Map() };
  }
  return buildOperatorDisplayLookup([
    {
      id: user.accountId,
      username: user.username,
      nickname: user.nickname
    }
  ]);
}

/** 系统用户展示名映射（昵称优先，否则用户名），用于制单人/审核人等列展示。 */
export function useOperatorDisplayLookup(): OperatorDisplayLookup {
  const { user, role } = useAuth();
  const [lookup, setLookup] = useState<OperatorDisplayLookup>(() => lookupFromAuthUser(user));

  useEffect(() => {
    let cancelled = false;

    const apply = (next: OperatorDisplayLookup) => {
      if (!cancelled) setLookup(next);
    };

    if (role !== 'admin') {
      apply(lookupFromAuthUser(user));
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const { list } = await listSystemAccounts(1, 500);
        if (cancelled) return;
        apply(buildOperatorDisplayLookup(list));
      } catch {
        apply(lookupFromAuthUser(user));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [role, user?.accountId, user?.username, user?.nickname]);

  return lookup;
}
