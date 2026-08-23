import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { can, canMutateVoucher, canPrintVoucher, canAccessOwnVoucher, normalizeRole, type Permission, type Role } from '../utils/permissions';

const TOKEN_KEY = 'erp_auth_token';
const USER_KEY = 'erp_auth_user';

export type AuthUser = {
  accountId: number;
  username: string;
  nickname: string;
  role: Role;
  mustChangePassword?: boolean;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  can: (permission: Permission) => boolean;
  canMutateVoucher: (voucher: { createdByAccountId?: number; status?: string } | null | undefined) => boolean;
  canPrintVoucher: (voucher: { createdByAccountId?: number } | null | undefined) => boolean;
  canAccessOwnVoucher: (voucher: { createdByAccountId?: number } | null | undefined) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    return {
      ...parsed,
      role: normalizeRole(parsed.role),
      mustChangePassword: Boolean(parsed.mustChangePassword)
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const login = useCallback((nextToken: string, nextUser: AuthUser) => {
    const normalized = {
      ...nextUser,
      role: normalizeRole(nextUser.role),
      mustChangePassword: Boolean(nextUser.mustChangePassword)
    };
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(normalized));
    setToken(nextToken);
    setUser(normalized);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      role: user ? normalizeRole(user.role) : null,
      isAuthenticated: Boolean(token),
      mustChangePassword: Boolean(user?.mustChangePassword),
      login,
      logout,
      can: (permission) => can(user?.role, permission),
      canMutateVoucher: (voucher) => canMutateVoucher(user?.role, user?.accountId, voucher),
      canPrintVoucher: (voucher) => canPrintVoucher(user?.role, user?.accountId, voucher),
      canAccessOwnVoucher: (voucher) => canAccessOwnVoucher(user?.role, user?.accountId, voucher)
    }),
    [token, user, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** 当前登录操作人展示名（昵称优先，否则用户名） */
export function getCurrentOperatorName(): string {
  return getCurrentOperatorNickname();
}

/** 当前登录用户昵称（无昵称时回退用户名），用于审核人等字段 */
export function getCurrentOperatorNickname(): string {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { nickname?: string; username?: string };
    const nickname = String(parsed.nickname || '').trim();
    if (nickname) return nickname;
    return String(parsed.username || '').trim();
  } catch {
    return '';
  }
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
