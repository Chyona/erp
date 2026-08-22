import { clearStoredAuth, getStoredToken } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/openapi/erp/v1';

type ApiBody<T> = {
  code: number;
  message: string;
  data: T;
};

export class ApiError extends Error {
  code: number;

  constructor(message: string, code = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function getApiBase(): string {
  return API_BASE.replace(/\/$/, '');
}

function authHeaders(extra?: HeadersInit): HeadersInit {
  const headers: Record<string, string> = {};
  if (extra) {
    const h = new Headers(extra);
    h.forEach((value, key) => {
      headers[key] = value;
    });
  }
  const token = getStoredToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function handleUnauthorized(status: number, code: number): void {
  if (status === 401 || code === 401) {
    clearStoredAuth();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?from=${encodeURIComponent(window.location.pathname)}`);
    }
  }
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: authHeaders(body !== undefined ? { 'Content-Type': 'application/json' } : undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let json: ApiBody<T>;
  try {
    json = (await res.json()) as ApiBody<T>;
  } catch {
    handleUnauthorized(res.status, res.status);
    throw new ApiError(res.ok ? '响应解析失败' : `HTTP ${res.status}: ${res.statusText}`);
  }

  if (!res.ok || json.code !== 0) {
    handleUnauthorized(res.status, json.code ?? res.status);
    throw new ApiError(json.message || `HTTP ${res.status}`, json.code ?? res.status);
  }

  return json.data;
}

/** multipart 上传（不要手动设 Content-Type，由浏览器带 boundary） */
export async function apiUploadForm<T>(path: string, form: FormData): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: form });

  let json: ApiBody<T>;
  try {
    json = (await res.json()) as ApiBody<T>;
  } catch {
    handleUnauthorized(res.status, res.status);
    throw new ApiError(res.ok ? '响应解析失败' : `HTTP ${res.status}: ${res.statusText}`);
  }

  if (!res.ok || json.code !== 0) {
    handleUnauthorized(res.status, json.code ?? res.status);
    throw new ApiError(json.message || `HTTP ${res.status}`, json.code ?? res.status);
  }

  return json.data;
}
