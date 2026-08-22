import { ApiError } from './apiClient';
import { sanitizeUserMessage, toUserMessage } from '../utils/userMessage';

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
      throw new ApiError('登录服务暂不可用，请确认后端已启动且为最新版本', 404);
    }
    throw new ApiError(
      res.ok ? '服务器返回了无法识别的内容' : `请求失败（${res.status}）`
    );
  }

  if (!res.ok || !json || json.code !== 0) {
    throw new ApiError(
      sanitizeUserMessage(json?.message || fallbackMessage),
      json?.code ?? res.status
    );
  }

  return json.data;
}

function networkErrorMessage(err: unknown): never {
  throw new ApiError(toUserMessage(err, '无法连接服务器，请确认网络或后端服务是否正常'));
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

export async function skipPasswordSetupRequest(): Promise<LoginResult> {
  const token = localStorage.getItem('erp_auth_token');
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/skip-password-setup'), {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  } catch (err) {
    networkErrorMessage(err);
  }

  return parseAuthResponse<LoginResult>(res, '操作失败');
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

export async function changePasswordRequest(
  oldPassword: string,
  newPassword: string
): Promise<void> {
  const token = localStorage.getItem('erp_auth_token');
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/change-password'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });
  } catch (err) {
    networkErrorMessage(err);
  }

  await parseAuthResponse<null>(res, '修改密码失败');
}
