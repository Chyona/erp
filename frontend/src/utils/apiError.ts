import { ApiError } from '../services/apiClient';

/** 401/403：登录失效或无权限，应回登录页。 */
export function isAuthError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return (
    err.httpStatus === 401 ||
    err.httpStatus === 403 ||
    err.code === 401 ||
    err.code === 403
  );
}

/** 502/503/504 或网络错误：服务端不可用，可降级进入系统。 */
export function isServerUnavailableError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return (
      err.httpStatus === 502 ||
      err.httpStatus === 503 ||
      err.httpStatus === 504 ||
      err.httpStatus === 0 ||
      err.httpStatus >= 500
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /无法连接服务器|failed to fetch|networkerror|net::|econnrefused/i.test(msg);
}
