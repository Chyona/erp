import { clearStoredAuth, getStoredToken } from '../context/AuthContext';
import { sanitizeUserMessage, toUserMessage } from '../utils/userMessage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/openapi/erp/v1';

type ApiBody<T> = {
  code: number;
  message: string;
  data: T;
};

export class ApiError extends Error {
  code: number;
  httpStatus: number;

  constructor(message: string, code = 500, httpStatus = code) {
    super(sanitizeUserMessage(message));
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type ApiRequestOptions = {
  /** 不带 Authorization（如登录） */
  skipAuth?: boolean;
  /** 401 时不跳转登录页（如登录失败） */
  skipUnauthorizedRedirect?: boolean;
};

export function getApiBase(): string {
  return API_BASE.replace(/\/$/, '');
}

function authHeaders(extra?: HeadersInit, skipAuth = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (extra) {
    const h = new Headers(extra);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }
  if (!skipAuth) {
    const token = getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

function handleUnauthorized(
  status: number,
  code: number,
  skipRedirect = false
): void {
  if (skipRedirect) return;
  if (status === 401 || code === 401) {
    clearStoredAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?from=${encodeURIComponent(window.location.pathname)}`);
    }
  }
}

async function parseApiResponse<T>(
  res: Response,
  options: ApiRequestOptions = {},
  fallbackMessage = '请求失败'
): Promise<T> {
  let json: ApiBody<T>;
  try {
    json = (await res.json()) as ApiBody<T>;
  } catch {
    handleUnauthorized(res.status, res.status, options.skipUnauthorizedRedirect);
    throw new ApiError(
      res.ok ? '服务器返回了无法识别的内容' : `请求失败（${res.status}）`,
      res.status,
      res.status
    );
  }

  if (!res.ok || json.code !== 0) {
    handleUnauthorized(res.status, json.code ?? res.status, options.skipUnauthorizedRedirect);
    throw new ApiError(
      json.message || fallbackMessage || `请求失败（${res.status}）`,
      json.code ?? res.status,
      res.status
    );
  }

  return json.data;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: authHeaders(
        body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        options.skipAuth
      ),
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    throw new ApiError(toUserMessage(err, '无法连接服务器，请确认网络或后端服务是否正常'), 0, 0);
  }

  return parseApiResponse<T>(res, options);
}

/** multipart 上传（不要手动设 Content-Type，由浏览器带 boundary） */
export async function apiUploadForm<T>(
  path: string,
  form: FormData,
  options: ApiRequestOptions = {}
): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(undefined, options.skipAuth),
      body: form
    });
  } catch (err) {
    throw new ApiError(toUserMessage(err, '无法连接服务器，请确认网络或后端服务是否正常'), 0, 0);
  }

  return parseApiResponse<T>(res, options);
}
