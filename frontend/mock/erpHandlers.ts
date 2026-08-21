/**
 * 将 Connect/Vite 请求路由到 ErpMockStore，响应格式与后端 { code, message, data } 一致。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { erpMockStore, mockId, type MockAttachment, type MockVoucher } from './erpStore';

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

function send(res: ServerResponse, status: number, body: { code: number; message: string; data?: Json }): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(payload);
}

function ok(res: ServerResponse, data: Json = null, message = 'success'): void {
  send(res, 200, { code: 0, message, data });
}

function fail(res: ServerResponse, status: number, message: string): void {
  send(res, status, { code: status, message });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function parseJSON<T>(req: IncomingMessage): Promise<T | undefined> {
  const raw = await readBody(req);
  if (!raw) return undefined;
  return JSON.parse(raw) as T;
}

function stripBase(urlPath: string): string {
  const base = '/openapi/erp/v1';
  if (urlPath.startsWith(base)) {
    return urlPath.slice(base.length) || '/';
  }
  return urlPath;
}

/**
 * 处理单次 Mock 请求；返回 true 表示已处理，false 表示交给后续中间件。
 */
export async function handleErpMockRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const method = (req.method || 'GET').toUpperCase();
  const rawUrl = req.url || '/';
  const u = new URL(rawUrl, 'http://127.0.0.1');
  const pathname = u.pathname;

  if (pathname === '/health') {
    ok(res, { status: 'ok', mock: true });
    return true;
  }

  if (!pathname.startsWith('/openapi/erp/v1')) {
    return false;
  }

  const path = stripBase(pathname);
  const store = erpMockStore;

  try {
    // POST /app/init
    if (method === 'POST' && path === '/app/init') {
      ok(res, store.appInit());
      return true;
    }

    // GET|POST /data/export|import
    if (method === 'GET' && path === '/data/export') {
      res.setHeader('Content-Disposition', 'attachment; filename=erp-backup.json');
      ok(res, store.exportAll());
      return true;
    }
    if (method === 'POST' && path === '/data/import') {
      const body = await parseJSON<{
        vouchers?: MockVoucher[];
        accounts?: Parameters<typeof store.importAll>[0]['accounts'];
        auditLogs?: Parameters<typeof store.importAll>[0]['auditLogs'];
        settings?: Parameters<typeof store.importAll>[0]['settings'];
        attachments?: MockAttachment[];
      }>(req);
      store.importAll(body ?? {});
      ok(res, null, '导入成功');
      return true;
    }

    // accounts
    if (path === '/accounts') {
      if (method === 'GET') {
        ok(res, [...store.accounts.values()].sort((a, b) => a.code.localeCompare(b.code)));
        return true;
      }
      if (method === 'DELETE') {
        store.accounts.clear();
        ok(res, null, '已清空科目');
        return true;
      }
    }
    const accountMatch = path.match(/^\/accounts\/([^/]+)$/);
    if (accountMatch) {
      const id = decodeURIComponent(accountMatch[1]);
      if (method === 'GET') {
        const item = store.accounts.get(id);
        if (!item) {
          fail(res, 404, '科目不存在');
          return true;
        }
        ok(res, item);
        return true;
      }
      if (method === 'PUT') {
        const body = (await parseJSON<Record<string, unknown>>(req)) ?? {};
        const item = { ...body, id } as import('./erpStore').MockAccount;
        store.accounts.set(id, item);
        ok(res, item);
        return true;
      }
      if (method === 'DELETE') {
        store.accounts.delete(id);
        ok(res, null, '删除成功');
        return true;
      }
    }

    // vouchers
    if (path === '/vouchers') {
      if (method === 'GET') {
        ok(res, [...store.vouchers.values()]);
        return true;
      }
      if (method === 'DELETE') {
        store.vouchers.clear();
        ok(res, null, '已清空凭证');
        return true;
      }
    }
    const voucherMatch = path.match(/^\/vouchers\/([^/]+)$/);
    if (voucherMatch) {
      const id = decodeURIComponent(voucherMatch[1]);
      if (method === 'GET') {
        const item = store.vouchers.get(id);
        if (!item) {
          fail(res, 404, '凭证不存在');
          return true;
        }
        ok(res, item);
        return true;
      }
      if (method === 'PUT') {
        const body = (await parseJSON<Record<string, unknown>>(req)) ?? {};
        const item = { ...body, id, entries: body.entries ?? [] } as MockVoucher;
        store.vouchers.set(id, item);
        ok(res, item);
        return true;
      }
      if (method === 'DELETE') {
        store.vouchers.delete(id);
        ok(res, null, '删除成功');
        return true;
      }
    }

    // attachments
    if (path === '/attachments') {
      if (method === 'GET') {
        ok(res, [...store.attachments.values()]);
        return true;
      }
      if (method === 'DELETE') {
        store.attachments.clear();
        ok(res, null, '已清空附件');
        return true;
      }
    }
    const attMatch = path.match(/^\/attachments\/([^/]+)$/);
    if (attMatch) {
      const id = decodeURIComponent(attMatch[1]);
      if (method === 'GET') {
        const item = store.attachments.get(id);
        if (!item) {
          fail(res, 404, '附件不存在');
          return true;
        }
        ok(res, item);
        return true;
      }
      if (method === 'PUT') {
        const body = (await parseJSON<Partial<MockAttachment>>(req)) ?? {};
        const item: MockAttachment = {
          id,
          name: body.name ?? '',
          type: body.type ?? '',
          size: body.size ?? 0,
          data: body.data ?? '',
          uploadedAt: body.uploadedAt ?? new Date().toISOString()
        };
        store.attachments.set(id, item);
        ok(res, item);
        return true;
      }
      if (method === 'DELETE') {
        store.attachments.delete(id);
        ok(res, null, '删除成功');
        return true;
      }
    }

    // audit-logs
    if (path === '/audit-logs') {
      if (method === 'GET') {
        const limit = Number(u.searchParams.get('limit') || '0');
        let list = [...store.auditLogs.values()].sort((a, b) =>
          b.timestamp.localeCompare(a.timestamp)
        );
        if (limit > 0) list = list.slice(0, limit);
        ok(res, list);
        return true;
      }
      if (method === 'POST') {
        const body = (await parseJSON<{ action?: string; target?: string; details?: string }>(req)) ?? {};
        if (!body.action) {
          fail(res, 400, 'action 不能为空');
          return true;
        }
        let ua = String(req.headers['user-agent'] || '');
        if (ua.length > 100) ua = ua.slice(0, 100);
        const log = {
          id: mockId(),
          timestamp: new Date().toISOString(),
          action: body.action,
          target: body.target ?? '',
          details: body.details ?? '',
          userAgent: ua
        };
        store.auditLogs.set(log.id, log);
        ok(res, log);
        return true;
      }
      if (method === 'DELETE') {
        store.auditLogs.clear();
        ok(res, null, '已清空审计日志');
        return true;
      }
    }
    const logMatch = path.match(/^\/audit-logs\/([^/]+)$/);
    if (logMatch && method === 'GET') {
      const id = decodeURIComponent(logMatch[1]);
      const item = store.auditLogs.get(id);
      if (!item) {
        fail(res, 404, '审计日志不存在');
        return true;
      }
      ok(res, item);
      return true;
    }

    // settings
    if (path === '/settings') {
      if (method === 'GET') {
        ok(res, [...store.settings.values()]);
        return true;
      }
      if (method === 'DELETE') {
        store.settings.clear();
        ok(res, null, '已清空设置');
        return true;
      }
    }
    const settingMatch = path.match(/^\/settings\/([^/]+)$/);
    if (settingMatch) {
      const key = decodeURIComponent(settingMatch[1]);
      if (method === 'GET') {
        const item = store.settings.get(key);
        ok(res, { key, value: item ? item.value : null });
        return true;
      }
      if (method === 'PUT') {
        const body = (await parseJSON<{ value?: unknown }>(req)) ?? {};
        const item = { key, value: body.value ?? null };
        store.settings.set(key, item);
        ok(res, item);
        return true;
      }
      if (method === 'DELETE') {
        store.settings.delete(key);
        ok(res, null, '删除成功');
        return true;
      }
    }

    fail(res, 404, `Mock 未实现: ${method} ${pathname}`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    fail(res, 500, message);
    return true;
  }
}
