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

function readBodyBuffer(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** 简易 multipart 解析（仅 Mock：取 file 字段与可选 text 字段）。 */
function parseMockMultipart(
  buf: Buffer,
  contentType: string
): { fields: Record<string, string>; file?: { filename: string; mime: string; data: Buffer } } {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] || boundaryMatch?.[2];
  if (!boundary) return { fields: {} };
  const parts = buf.toString('binary').split(`--${boundary}`);
  const fields: Record<string, string> = {};
  let file: { filename: string; mime: string; data: Buffer } | undefined;
  for (const part of parts) {
    if (!part || part === '--\r\n' || part === '--') continue;
    const sep = part.indexOf('\r\n\r\n');
    if (sep < 0) continue;
    const header = part.slice(0, sep);
    let body = part.slice(sep + 4);
    if (body.endsWith('\r\n')) body = body.slice(0, -2);
    const nameMatch = /name="([^"]+)"/i.exec(header);
    const filenameMatch = /filename="([^"]*)"/i.exec(header);
    const mimeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(header);
    const name = nameMatch?.[1];
    if (!name) continue;
    if (filenameMatch) {
      file = {
        filename: filenameMatch[1] || 'file',
        mime: (mimeMatch?.[1] || 'application/octet-stream').trim(),
        data: Buffer.from(body, 'binary')
      };
    } else {
      fields[name] = Buffer.from(body, 'binary').toString('utf8');
    }
  }
  return { fields, file };
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
    if (method === 'PUT' && path === '/accounts/batch') {
      const body =
        (await parseJSON<{ action?: string; items?: import('./erpStore').MockAccount[]; ids?: string[] }>(
          req
        )) ?? {};
      const action = body.action || (body.items?.length ? 'upsert' : body.ids?.length ? 'delete' : '');
      if (action === 'upsert') {
        const items = body.items ?? [];
        for (const item of items) {
          if (!item?.id) {
            fail(res, 400, '科目 ID 不能为空');
            return true;
          }
          store.accounts.set(item.id, item);
        }
        ok(res, { action: 'upsert', count: items.length, items });
        return true;
      }
      if (action === 'delete') {
        for (const id of body.ids ?? []) store.accounts.delete(id);
        ok(res, { action: 'delete', count: (body.ids ?? []).length, ids: body.ids ?? [] });
        return true;
      }
      fail(res, 400, 'action 仅支持 upsert 或 delete');
      return true;
    }
    if (method === 'POST' && path === '/accounts/batch') {
      const body =
        (await parseJSON<{ action?: string; items?: import('./erpStore').MockAccount[]; ids?: string[] }>(
          req
        )) ?? {};
      const action = body.action || (body.items?.length ? 'upsert' : body.ids?.length ? 'delete' : '');
      if (action === 'upsert') {
        const items = body.items ?? [];
        for (const item of items) {
          if (!item?.id) {
            fail(res, 400, '科目 ID 不能为空');
            return true;
          }
          store.accounts.set(item.id, item);
        }
        ok(res, { action: 'upsert', count: items.length, items });
        return true;
      }
      if (action === 'delete') {
        for (const id of body.ids ?? []) store.accounts.delete(id);
        ok(res, { action: 'delete', count: (body.ids ?? []).length, ids: body.ids ?? [] });
        return true;
      }
      fail(res, 400, 'action 仅支持 upsert 或 delete');
      return true;
    }
    if (method === 'DELETE' && path === '/accounts/batch') {
      const body = (await parseJSON<{ ids?: string[] }>(req)) ?? {};
      for (const id of body.ids ?? []) store.accounts.delete(id);
      ok(res, { action: 'delete', count: (body.ids ?? []).length, ids: body.ids ?? [] });
      return true;
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
    if (method === 'GET' && path === '/vouchers/import-llm-status') {
      ok(res, { enabled: false, model: '' });
      return true;
    }
    if (method === 'POST' && path === '/vouchers/parse-import-image') {
      fail(res, 503, 'Mock 模式未接入大模型，请关闭 Mock 或改用 Excel/CSV');
      return true;
    }
    if (method === 'PUT' && path === '/vouchers/batch') {
      const body = (await parseJSON<{ items?: MockVoucher[] }>(req)) ?? {};
      const items = body.items ?? [];
      for (const item of items) {
        if (!item?.id) {
          fail(res, 400, '凭证 ID 不能为空');
          return true;
        }
        store.vouchers.set(item.id, { ...item, entries: item.entries ?? [] });
      }
      ok(res, items);
      return true;
    }
    if (method === 'POST' && path === '/vouchers/batch') {
      const body =
        (await parseJSON<{ action?: string; ids?: string[]; items?: MockVoucher[] }>(req)) ?? {};
      const failed: Array<{ id: string; voucherNo?: string; message: string }> = [];
      const now = new Date().toISOString();

      if (body.action === 'upsert') {
        const items = body.items ?? [];
        for (const item of items) {
          if (!item?.id) {
            fail(res, 400, '凭证 ID 不能为空');
            return true;
          }
          store.vouchers.set(item.id, { ...item, entries: item.entries ?? [] });
        }
        ok(res, { action: 'upsert', count: items.length, items });
        return true;
      }

      const ids = [...new Set((body.ids ?? []).filter(Boolean))];
      if (body.action === 'approve') {
        let approved = 0;
        let skipped = 0;
        for (const id of ids) {
          const item = store.vouchers.get(id);
          if (!item || item.status !== 'draft') {
            skipped++;
            continue;
          }
          item.status = 'approved';
          item.approvedAt = now;
          item.updatedAt = now;
          store.vouchers.set(id, item);
          approved++;
        }
        ok(res, { action: 'approve', approved, skipped, failed });
        return true;
      }
      if (body.action === 'unapprove') {
        let unapproved = 0;
        let skipped = 0;
        for (const id of ids) {
          const item = store.vouchers.get(id);
          if (!item) {
            skipped++;
            continue;
          }
          if (item.status === 'locked') {
            failed.push({ id, voucherNo: String(item.voucherNo || ''), message: '已结项，不可反审核' });
            continue;
          }
          if (item.status !== 'approved') {
            skipped++;
            continue;
          }
          if (item.isTaxExemptionCarryForward || item.isProfitLossClosing) {
            failed.push({
              id,
              voucherNo: String(item.voucherNo || ''),
              message: '系统结转凭证不可反审核'
            });
            continue;
          }
          item.status = 'draft';
          delete item.approvedAt;
          item.updatedAt = now;
          store.vouchers.set(id, item);
          unapproved++;
        }
        ok(res, { action: 'unapprove', unapproved, skipped, failed });
        return true;
      }
      if (body.action === 'delete') {
        let deleted = 0;
        let skipped = 0;
        for (const id of ids) {
          const item = store.vouchers.get(id);
          if (!item) {
            skipped++;
            continue;
          }
          if (item.status === 'locked') {
            failed.push({ id, voucherNo: String(item.voucherNo || ''), message: '已结项，不可删除' });
            continue;
          }
          if (item.isTaxExemptionCarryForward || item.isProfitLossClosing) {
            failed.push({
              id,
              voucherNo: String(item.voucherNo || ''),
              message: '系统结转凭证不可删除'
            });
            continue;
          }
          const attIds = Array.isArray(item.attachmentIds) ? (item.attachmentIds as string[]) : [];
          for (const attId of attIds) store.attachments.delete(attId);
          store.vouchers.delete(id);
          deleted++;
        }
        ok(res, { action: 'delete', deleted, skipped, failed });
        return true;
      }
      fail(res, 400, 'action 仅支持 upsert、approve、unapprove、delete');
      return true;
    }
    if (method === 'DELETE' && path === '/vouchers/batch') {
      const body = (await parseJSON<{ ids?: string[] }>(req)) ?? {};
      const ids = [...new Set((body.ids ?? []).filter(Boolean))];
      const failed: Array<{ id: string; voucherNo?: string; message: string }> = [];
      let deleted = 0;
      let skipped = 0;
      for (const id of ids) {
        const item = store.vouchers.get(id);
        if (!item) {
          skipped++;
          continue;
        }
        if (item.status === 'locked') {
          failed.push({ id, voucherNo: String(item.voucherNo || ''), message: '已结项，不可删除' });
          continue;
        }
        if (item.isTaxExemptionCarryForward || item.isProfitLossClosing) {
          failed.push({
            id,
            voucherNo: String(item.voucherNo || ''),
            message: '系统结转凭证不可删除'
          });
          continue;
        }
        const attIds = Array.isArray(item.attachmentIds) ? (item.attachmentIds as string[]) : [];
        for (const attId of attIds) store.attachments.delete(attId);
        store.vouchers.delete(id);
        deleted++;
      }
      ok(res, { deleted, skipped, failed });
      return true;
    }
    if (method === 'POST' && path === '/vouchers/batch-approve') {
      const body = (await parseJSON<{ ids?: string[] }>(req)) ?? {};
      const ids = [...new Set((body.ids ?? []).filter(Boolean))];
      const failed: Array<{ id: string; voucherNo?: string; message: string }> = [];
      let approved = 0;
      let skipped = 0;
      const now = new Date().toISOString();
      for (const id of ids) {
        const item = store.vouchers.get(id);
        if (!item) {
          skipped++;
          continue;
        }
        if (item.status !== 'draft') {
          skipped++;
          continue;
        }
        item.status = 'approved';
        item.approvedAt = now;
        item.updatedAt = now;
        store.vouchers.set(id, item);
        approved++;
      }
      ok(res, { approved, skipped, failed });
      return true;
    }
    if (method === 'POST' && path === '/vouchers/batch-unapprove') {
      const body = (await parseJSON<{ ids?: string[] }>(req)) ?? {};
      const ids = [...new Set((body.ids ?? []).filter(Boolean))];
      const failed: Array<{ id: string; voucherNo?: string; message: string }> = [];
      let unapproved = 0;
      let skipped = 0;
      const now = new Date().toISOString();
      for (const id of ids) {
        const item = store.vouchers.get(id);
        if (!item) {
          skipped++;
          continue;
        }
        if (item.status === 'locked') {
          failed.push({ id, voucherNo: item.voucherNo as string, message: '已结项，不可反审核' });
          continue;
        }
        if (item.status !== 'approved') {
          skipped++;
          continue;
        }
        if (item.isTaxExemptionCarryForward || item.isProfitLossClosing) {
          failed.push({ id, voucherNo: item.voucherNo as string, message: '系统结转凭证不可反审核' });
          continue;
        }
        item.status = 'draft';
        delete item.approvedAt;
        item.updatedAt = now;
        store.vouchers.set(id, item);
        unapproved++;
      }
      ok(res, { unapproved, skipped, failed });
      return true;
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
    if (method === 'POST' && path === '/attachments/upload') {
      const contentType = String(req.headers['content-type'] || '');
      const buf = await readBodyBuffer(req);
      const parsed = parseMockMultipart(buf, contentType);
      if (!parsed.file) {
        fail(res, 400, '请上传 file 字段');
        return true;
      }
      const id = parsed.fields.id || mockId();
      const name = parsed.fields.name || parsed.file.filename || 'file';
      const url = `data:${parsed.file.mime};base64,${parsed.file.data.toString('base64')}`;
      const item: MockAttachment = {
        id,
        name,
        type: parsed.file.mime,
        size: parsed.file.data.length,
        url,
        uploadedAt: new Date().toISOString()
      };
      store.attachments.set(id, item);
      ok(res, item);
      return true;
    }
    if ((method === 'PUT' || method === 'POST') && path === '/attachments/batch') {
      const body =
        (await parseJSON<{ action?: string; items?: MockAttachment[]; ids?: string[] }>(req)) ?? {};
      const action = body.action || (body.items?.length ? 'upsert' : body.ids?.length ? 'delete' : '');
      if (action === 'upsert') {
        const items = body.items ?? [];
        for (const item of items) {
          if (!item?.id) {
            fail(res, 400, '附件 ID 不能为空');
            return true;
          }
          store.attachments.set(item.id, item);
        }
        ok(res, { action: 'upsert', count: items.length, items });
        return true;
      }
      if (action === 'delete') {
        for (const id of body.ids ?? []) store.attachments.delete(id);
        ok(res, { action: 'delete', count: (body.ids ?? []).length, ids: body.ids ?? [] });
        return true;
      }
      fail(res, 400, 'action 仅支持 upsert 或 delete');
      return true;
    }
    if (method === 'DELETE' && path === '/attachments/batch') {
      const body = (await parseJSON<{ ids?: string[] }>(req)) ?? {};
      for (const id of body.ids ?? []) store.attachments.delete(id);
      ok(res, { action: 'delete', count: (body.ids ?? []).length, ids: body.ids ?? [] });
      return true;
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
        const existing = store.attachments.get(id);
        const item: MockAttachment = {
          id,
          name: body.name ?? existing?.name ?? '',
          type: body.type ?? existing?.type ?? '',
          size: body.size ?? existing?.size ?? 0,
          url: body.url ?? existing?.url ?? '',
          uploadedAt: body.uploadedAt ?? existing?.uploadedAt ?? new Date().toISOString()
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
    if (method === 'PUT' && path === '/settings/batch') {
      const body = (await parseJSON<{ items?: Array<{ key?: string; value?: unknown }> }>(req)) ?? {};
      const items = body.items ?? [];
      const out: Array<{ key: string; value: unknown }> = [];
      for (const item of items) {
        if (!item?.key) {
          fail(res, 400, '设置 key 不能为空');
          return true;
        }
        const row = { key: item.key, value: item.value ?? null };
        store.settings.set(item.key, row);
        out.push(row);
      }
      ok(res, out);
      return true;
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
