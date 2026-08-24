/**
 * 将 Connect/Vite 请求路由到 ErpMockStore，响应格式与后端 { code, message, data } 一致。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  mockUsers,
  parseBearer,
  publicAccount,
  tokenFor,
  type MockRole
} from './authUsers';
import { erpMockStore, mockId, type MockAttachment, type MockVoucher } from './erpStore';
import { mockBackupStore } from './backupStore';

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

  // —— 认证 ——
  if (path === '/auth/login' && method === 'POST') {
    const raw = await readBody(req);
    let body: { username?: string; password?: string } = {};
    try {
      body = JSON.parse(raw || '{}') as { username?: string; password?: string };
    } catch {
      fail(res, 400, '请输入用户名和密码');
      return true;
    }
    const found = mockUsers.find(
      (u) => u.username === body.username && u.password === body.password && u.status === 1
    );
    if (!found) {
      fail(res, 401, '用户名或密码错误');
      return true;
    }
    ok(res, {
      token: tokenFor(found),
      expires_at: '2099-12-31 23:59:59',
      account_id: found.id,
      username: found.username,
      nickname: found.nickname,
      role: found.role,
      must_change_password: found.mustChangePassword
    });
    return true;
  }

  if (path === '/auth/confirm-password' && method === 'POST') {
    const auth = parseBearer(req);
    if (!auth) {
      fail(res, 401, '请先登录');
      return true;
    }
    const raw = await readBody(req);
    let body: { password?: string } = {};
    try {
      body = JSON.parse(raw || '{}') as { password?: string };
    } catch {
      fail(res, 400, '请输入密码');
      return true;
    }
    const me = mockUsers.find((u) => u.id === auth.accountId);
    if (!me || me.password !== body.password) {
      fail(res, 403, '密码不正确');
      return true;
    }
    ok(res, null, '密码校验通过');
    return true;
  }

  if (path === '/auth/setup-password' && method === 'POST') {
    const auth = parseBearer(req);
    if (!auth) {
      fail(res, 401, '请先登录');
      return true;
    }
    const body = (await parseJSON<{ password?: string }>(req)) || {};
    if (!body.password || body.password.length < 6) {
      fail(res, 400, '请输入至少 6 位的新密码');
      return true;
    }
    const me = mockUsers.find((u) => u.id === auth.accountId);
    if (!me) {
      fail(res, 401, '请先登录');
      return true;
    }
    if (!me.mustChangePassword) {
      fail(res, 400, '当前账号无需设置密码，如需修改请联系管理员');
      return true;
    }
    me.password = body.password;
    me.mustChangePassword = false;
    ok(res, {
      token: tokenFor(me),
      expires_at: '2099-12-31 23:59:59',
      account_id: me.id,
      username: me.username,
      nickname: me.nickname,
      role: me.role,
      must_change_password: false
    });
    return true;
  }

  if (path === '/auth/skip-password-setup' && method === 'POST') {
    const auth = parseBearer(req);
    if (!auth) {
      fail(res, 401, '请先登录');
      return true;
    }
    const me = mockUsers.find((u) => u.id === auth.accountId);
    if (!me) {
      fail(res, 401, '请先登录');
      return true;
    }
    me.mustChangePassword = false;
    ok(res, {
      token: tokenFor(me),
      expires_at: '2099-12-31 23:59:59',
      account_id: me.id,
      username: me.username,
      nickname: me.nickname,
      role: me.role,
      must_change_password: false
    });
    return true;
  }

  if (path === '/auth/change-password' && method === 'POST') {
    const auth = parseBearer(req);
    if (!auth) {
      fail(res, 401, '请先登录');
      return true;
    }
    const body = (await parseJSON<{ old_password?: string; new_password?: string }>(req)) || {};
    if (!body.old_password || !body.new_password || body.new_password.length < 6) {
      fail(res, 400, '请填写当前密码，以及至少 6 位的新密码');
      return true;
    }
    const me = mockUsers.find((u) => u.id === auth.accountId);
    if (!me) {
      fail(res, 401, '请先登录');
      return true;
    }
    if (me.password !== body.old_password) {
      fail(res, 400, '当前密码不正确');
      return true;
    }
    me.password = body.new_password;
    me.mustChangePassword = false;
    ok(res, null, '密码已修改');
    return true;
  }

  // —— 系统用户管理（仅管理员）——
  if (path === '/users' || path.startsWith('/users/')) {
    const auth = parseBearer(req);
    if (!auth) {
      fail(res, 401, '请先登录');
      return true;
    }
    if (auth.role !== 'admin') {
      fail(res, 403, '当前账号无权限执行此操作');
      return true;
    }

    if (path === '/users' && method === 'GET') {
      const list = [...mockUsers]
        .sort((a, b) => {
          if (a.username === 'admin') return -1;
          if (b.username === 'admin') return 1;
          return b.id - a.id;
        })
        .map(publicAccount);
      ok(res, {
        list,
        total: mockUsers.length,
        page: 1,
        page_size: 100
      });
      return true;
    }

    if (path === '/users' && method === 'POST') {
      const body =
        (await parseJSON<{
          username?: string;
          email?: string;
          password?: string;
          nickname?: string;
          role?: MockRole;
        }>(req)) || {};
      if (!body.username || !body.password) {
        fail(res, 400, '请填写用户名和密码');
        return true;
      }
      const email = (body.email || '').trim();
      if (mockUsers.some((u) => u.username === body.username)) {
        fail(res, 400, '该用户名已被使用，请换一个用户名');
        return true;
      }
      if (email && mockUsers.some((u) => u.email === email)) {
        fail(res, 400, '该邮箱已被使用，请换一个邮箱');
        return true;
      }
      const nextId = Math.max(0, ...mockUsers.map((u) => u.id)) + 1;
      const created = {
        id: nextId,
        username: body.username,
        email,
        password: body.password,
        nickname: body.nickname || body.username,
        role: (body.role === 'admin' || body.role === 'readonly' ? body.role : 'user') as MockRole,
        status: 1,
        mustChangePassword: true
      };
      mockUsers.push(created);
      ok(res, publicAccount(created));
      return true;
    }

    const resetMatch = path.match(/^\/users\/(\d+)\/reset-password$/);
    if (resetMatch && method === 'POST') {
      const id = Number(resetMatch[1]);
      const idx = mockUsers.findIndex((u) => u.id === id);
      if (idx < 0) {
        fail(res, 404, '账号不存在');
        return true;
      }
      const body = (await parseJSON<{ password?: string }>(req)) || {};
      if (!body.password || body.password.length < 6) {
        fail(res, 400, '请输入至少 6 位的新密码');
        return true;
      }
      mockUsers[idx].password = body.password;
      mockUsers[idx].mustChangePassword = auth.accountId !== id;
      ok(
        res,
        publicAccount(mockUsers[idx]),
        auth.accountId === id ? '密码已修改' : '密码已重置，用户下次登录需重新设置密码'
      );
      return true;
    }

    const idMatch = path.match(/^\/users\/(\d+)$/);
    if (idMatch) {
      const id = Number(idMatch[1]);
      const idx = mockUsers.findIndex((u) => u.id === id);
      if (idx < 0) {
        fail(res, 404, '账号不存在');
        return true;
      }
      if (method === 'GET') {
        ok(res, publicAccount(mockUsers[idx]));
        return true;
      }
      if (method === 'PUT') {
        const body =
          (await parseJSON<{
            nickname?: string;
            email?: string;
            phone?: string;
            remark?: string;
            role?: MockRole;
            status?: number;
          }>(req)) || {};
        const target = mockUsers[idx];
        const isBuiltinAdmin = target.username === 'admin';
        if (isBuiltinAdmin && (body.role !== undefined || body.status !== undefined)) {
          fail(res, 400, '内置管理员账号不可修改角色或状态');
          return true;
        }
        if (body.nickname !== undefined) target.nickname = (body.nickname || '').trim();
        if (body.email !== undefined) {
          const email = (body.email || '').trim();
          if (email && mockUsers.some((u) => u.email === email && u.id !== id)) {
            fail(res, 400, '该邮箱已被使用，请换一个邮箱');
            return true;
          }
          target.email = email;
        }
        if (body.phone !== undefined) target.phone = (body.phone || '').trim();
        if (body.remark !== undefined) target.remark = (body.remark || '').trim();
        if (!isBuiltinAdmin && (body.role === 'admin' || body.role === 'user' || body.role === 'readonly')) {
          if (target.role === 'admin' && body.role !== 'admin') {
            if (mockUsers.filter((u) => u.role === 'admin').length <= 1) {
              fail(res, 400, '至少保留一个管理员账号');
              return true;
            }
          }
          target.role = body.role;
        }
        if (!isBuiltinAdmin && typeof body.status === 'number') {
          if (body.status !== 1 && mockUsers.filter((u) => u.role === 'admin' && u.status === 1).length <= 1 && target.role === 'admin') {
            fail(res, 400, '不能禁用最后一个管理员');
            return true;
          }
          target.status = body.status;
        }
        ok(res, publicAccount(target));
        return true;
      }
      if (method === 'DELETE') {
        if (mockUsers[idx].username === 'admin') {
          fail(res, 400, '内置管理员账号不可删除');
          return true;
        }
        if (mockUsers[idx].role === 'admin' && mockUsers.filter((u) => u.role === 'admin').length <= 1) {
          fail(res, 400, '不能删除最后一个管理员');
          return true;
        }
        mockUsers.splice(idx, 1);
        ok(res, null, '删除成功');
        return true;
      }
    }

    fail(res, 404, '未找到接口');
    return true;
  }

  const store = erpMockStore;
  const auth = parseBearer(req);

  if (auth) {
    const me = mockUsers.find((u) => u.id === auth.accountId);
    if (me?.mustChangePassword) {
      fail(res, 403, '请先设置登录密码');
      return true;
    }
  }

  // 只读：禁止写与导出备份
  if (auth?.role === 'readonly') {
    const isInit = method === 'POST' && path === '/app/init';
    const isSafeRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || isInit;
    if (!isSafeRead || path === '/data/export') {
      fail(res, 403, '只读账号无权修改或导出数据');
      return true;
    }
  }

  try {
    // POST /app/init
    if (method === 'POST' && path === '/app/init') {
      ok(res, store.appInit());
      return true;
    }

    // GET|POST /data/export|import
    if (method === 'GET' && path === '/data/export') {
      if (auth?.role === 'readonly') {
        fail(res, 403, '当前账号无权导出或备份');
        return true;
      }
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

    if (path === '/backups') {
      if (auth?.role === 'readonly') {
        fail(res, 403, '当前账号无权查看备份');
        return true;
      }
      if (method === 'GET') {
        ok(res, mockBackupStore.list());
        return true;
      }
      if (method === 'POST') {
        const body = (await parseJSON<{ name?: string }>(req)) ?? {};
        ok(res, mockBackupStore.create(body.name));
        return true;
      }
    }
    if (method === 'POST' && path === '/backups/upload') {
      if (auth?.role !== 'admin') {
        fail(res, 403, '需要管理员权限');
        return true;
      }
      const contentType = String(req.headers['content-type'] || '');
      const buf = await readBodyBuffer(req);
      const { fields, file } = parseMockMultipart(buf, contentType);
      if (!file?.data) {
        fail(res, 400, '请上传备份文件');
        return true;
      }
      try {
        const record = mockBackupStore.upload(fields.name, file.data.toString('utf8'));
        ok(res, record);
      } catch (err) {
        fail(res, 400, err instanceof Error ? err.message : '无效的备份文件');
      }
      return true;
    }
    if (method === 'POST' && path === '/backups/batch-delete') {
      if (auth?.role !== 'admin') {
        fail(res, 403, '需要管理员权限');
        return true;
      }
      const body = (await parseJSON<{ ids?: string[] }>(req)) ?? {};
      mockBackupStore.batchRemove(body.ids ?? []);
      ok(res, null, '删除成功');
      return true;
    }
    const backupMatch = /^\/backups\/([^/]+)(?:\/(download|restore))?$/.exec(path);
    if (backupMatch) {
      const id = decodeURIComponent(backupMatch[1]);
      const action = backupMatch[2];
      if (action === 'download') {
        if (auth?.role === 'readonly') {
          fail(res, 403, '当前账号无权下载备份');
          return true;
        }
        try {
          const { record, content } = mockBackupStore.download(id);
          const filename = record.name.endsWith('.bak') ? record.name : `${record.name}.bak`;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
          res.end(content);
        } catch (err) {
          fail(res, 404, err instanceof Error ? err.message : '备份不存在');
        }
        return true;
      }
      if (action === 'restore') {
        if (auth?.role !== 'admin') {
          fail(res, 403, '需要管理员权限');
          return true;
        }
        if (method !== 'POST') {
          fail(res, 405, 'Method Not Allowed');
          return true;
        }
        try {
          mockBackupStore.restore(id);
          ok(res, null, '恢复成功');
        } catch (err) {
          fail(res, 404, err instanceof Error ? err.message : '恢复失败');
        }
        return true;
      }
      if (method === 'PUT') {
        if (auth?.role !== 'admin') {
          fail(res, 403, '需要管理员权限');
          return true;
        }
        const body = (await parseJSON<{ name?: string }>(req)) ?? {};
        if (!body.name?.trim()) {
          fail(res, 400, '备份名称不能为空');
          return true;
        }
        try {
          ok(res, mockBackupStore.rename(id, body.name));
        } catch (err) {
          fail(res, 404, err instanceof Error ? err.message : '备份不存在');
        }
        return true;
      }
      if (method === 'DELETE') {
        if (auth?.role !== 'admin') {
          fail(res, 403, '需要管理员权限');
          return true;
        }
        mockBackupStore.remove(id);
        ok(res, null, '删除成功');
        return true;
      }
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
        const pageRaw = u.searchParams.get('page');
        if (pageRaw) {
          const page = Math.max(1, Number(pageRaw) || 1);
          const pageSize = Math.max(1, Math.min(Number(u.searchParams.get('page_size') || '100') || 100, 100));
          const filters = {
            startDate: u.searchParams.get('start_date') || '',
            endDate: u.searchParams.get('end_date') || '',
            status: u.searchParams.get('status') || '',
            voucherType: u.searchParams.get('voucher_type') || '',
            voucherNumber: u.searchParams.get('voucher_number') || '',
            summary: u.searchParams.get('summary') || '',
            accountCode: u.searchParams.get('account_code') || '',
            amountMin: u.searchParams.get('amount_min') || '',
            amountMax: u.searchParams.get('amount_max') || '',
            businessType: u.searchParams.get('business_type') || '',
            signatory: u.searchParams.get('signatory') || '',
            remark: u.searchParams.get('remark') || '',
            keyword: u.searchParams.get('keyword') || ''
          };
          const { applyVoucherFilters, paginateVouchers } = await import(
            '../src/utils/voucherListFilter'
          );
          const filtered = applyVoucherFilters([...store.vouchers.values()], filters);
          const paged = paginateVouchers(filtered, page, pageSize);
          ok(res, {
            list: paged.list,
            total: paged.total,
            page: paged.page,
            page_size: paged.pageSize
          });
          return true;
        }
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
    if (method === 'POST' && path === '/vouchers/parse-invoice-number') {
      fail(res, 503, 'Mock 模式未接入大模型，请配置 APP_LLM_API_KEY 后使用发票识别');
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
          const me = auth ? mockUsers.find((u) => u.id === auth.accountId) : undefined;
          if (me) item.reviewedBy = me.nickname || me.username;
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
          item.reviewedBy = '';
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
        {
          const me = auth ? mockUsers.find((u) => u.id === auth.accountId) : undefined;
          if (me) item.reviewedBy = me.nickname || me.username;
        }
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
        item.reviewedBy = '';
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
          uploadedAt: body.uploadedAt ?? existing?.uploadedAt ?? new Date().toISOString(),
          recognizedInvoiceNumbers:
            body.recognizedInvoiceNumbers ?? existing?.recognizedInvoiceNumbers
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
        const me = auth ? mockUsers.find((u) => u.id === auth.accountId) : undefined;
        const log = {
          id: mockId(),
          timestamp: new Date().toISOString(),
          action: body.action,
          target: body.target ?? '',
          details: body.details ?? '',
          userAgent: ua,
          operatorAccountId: me?.id ?? 0,
          operatorUsername: me?.username ?? '',
          operatorNickname: me?.nickname ?? ''
        };
        store.auditLogs.set(log.id, log);
        ok(res, log);
        return true;
      }
      if (method === 'DELETE') {
        store.auditLogs.clear();
        ok(res, null, '已清空操作日志');
        return true;
      }
    }
    const logMatch = path.match(/^\/audit-logs\/([^/]+)$/);
    if (logMatch && method === 'GET') {
      const id = decodeURIComponent(logMatch[1]);
      const item = store.auditLogs.get(id);
      if (!item) {
        fail(res, 404, '操作日志不存在');
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
