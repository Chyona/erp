import { ApiError } from './apiClient';

const AUTH_API_BASE = '/openapi/base/v1';

export type LoginResult = {
  token: string;
  expires_at: string;
  account_id: number;
  username: string;
  nickname: string;
  role: string;
  must_change_password: boolean;
};

type ApiBody<T> = {
  code: number;
  message: string;
  data: T;
};

function authUrl(path: string): string {
  return `${AUTH_API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseAuthResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const text = await res.text();
  let json: ApiBody<T> | undefined;
  try {
    json = text ? (JSON.parse(text) as ApiBody<T>) : undefined;
  } catch {
    if (res.status === 404) {
      throw new ApiError(
        '登录接口不存在（404）。远程环境可能尚未部署含鉴权的后端，或未关闭 Mock（VITE_USE_MOCK 须为 false 才会走代理）',
        404
      );
    }
    throw new ApiError(
      res.ok ? '响应解析失败' : `HTTP ${res.status}: ${res.statusText || text.slice(0, 80)}`
    );
  }

  if (!res.ok || !json || json.code !== 0) {
    throw new ApiError(json?.message || fallbackMessage, json?.code ?? res.status);
  }

  return json.data;
}

function networkErrorMessage(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed|econnrefused/i.test(msg)) {
    throw new ApiError(
      '无法连接后端。请确认：1) VITE_USE_MOCK=false 并重启 pnpm dev；2) VITE_PROXY_TARGET 可访问；3) 远程已部署登录接口'
    );
  }
  throw err instanceof ApiError ? err : new ApiError(msg || '请求失败');
}

export async function loginRequest(username: string, password: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
  } catch (err) {
    networkErrorMessage(err);
  }

  return parseAuthResponse<LoginResult>(res, '登录失败');
}

export async function setupPasswordRequest(password: string): Promise<LoginResult> {
  const token = localStorage.getItem('erp_auth_token');
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/setup-password'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ password })
    });
  } catch (err) {
    networkErrorMessage(err);
  }

  return parseAuthResponse<LoginResult>(res, '设置密码失败');
}

export async function confirmPasswordRequest(password: string): Promise<void> {
  const token = localStorage.getItem('erp_auth_token');
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/confirm-password'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ password })
    });
  } catch (err) {
    networkErrorMessage(err);
  }

  await parseAuthResponse<null>(res, '密码校验失败');
}
