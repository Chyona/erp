import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { can, canMutateVoucher, canPrintVoucher, canAccessOwnVoucher, normalizeRole, type Permission, type Role } from '../utils/permissions';

const TOKEN_KEY = 'erp_auth_token';
const USER_KEY = 'erp_auth_user';

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function readStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return null;
  }
  return token;
}

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
  patchUser: (patch: Partial<Pick<AuthUser, 'nickname' | 'username'>>) => void;
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
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<AuthUser | null>(() => (readStoredToken() ? readStoredUser() : null));

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

  const patchUser = useCallback((patch: Partial<Pick<AuthUser, 'nickname' | 'username'>>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      role: user ? normalizeRole(user.role) : null,
      isAuthenticated: Boolean(token),
      mustChangePassword: Boolean(user?.mustChangePassword),
      login,
      patchUser,
      logout,
      can: (permission) => can(user?.role, permission),
      canMutateVoucher: (voucher) => canMutateVoucher(user?.role, user?.accountId, voucher),
      canPrintVoucher: (voucher) => canPrintVoucher(user?.role, user?.accountId, voucher),
      canAccessOwnVoucher: (voucher) => canAccessOwnVoucher(user?.role, user?.accountId, voucher)
    }),
    [token, user, login, patchUser, logout]
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

/** 当前登录用户昵称（无昵称时回退用户名），用于审核人/制表人等展示字段 */
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

/** 当前登录操作人展示名（与 getCurrentOperatorNickname 相同） */
export function getCurrentOperatorName(): string {
  return getCurrentOperatorNickname();
}

/** 当前登录操作人展示名（与 getCurrentOperatorNickname 相同） */
export function getCurrentOperatorDisplay(): string {
  return getCurrentOperatorNickname();
}

/** 当前登录用户名 */
export function getCurrentOperatorUsername(): string {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { username?: string };
    return String(parsed.username || '').trim();
  } catch {
    return '';
  }
}

export function clearStoredAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
