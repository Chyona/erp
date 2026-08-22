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

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  let json: ApiBody<T>;
  try {
    json = (await res.json()) as ApiBody<T>;
  } catch {
    throw new ApiError(res.ok ? '响应解析失败' : `HTTP ${res.status}: ${res.statusText}`);
  }

  if (!res.ok || json.code !== 0) {
    throw new ApiError(json.message || `HTTP ${res.status}`, json.code ?? res.status);
  }

  return json.data;
}

/** multipart 上传（不要手动设 Content-Type，由浏览器带 boundary） */
export async function apiUploadForm<T>(path: string, form: FormData): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { method: 'POST', body: form });

  let json: ApiBody<T>;
  try {
    json = (await res.json()) as ApiBody<T>;
  } catch {
    throw new ApiError(res.ok ? '响应解析失败' : `HTTP ${res.status}: ${res.statusText}`);
  }

  if (!res.ok || json.code !== 0) {
    throw new ApiError(json.message || `HTTP ${res.status}`, json.code ?? res.status);
  }

  return json.data;
}
