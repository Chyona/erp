# ERP 数据存储 API

对应前端 `frontend/src/services/db.ts` 的五个数据 store，持久化到 PostgreSQL。

**Base URL:** `/openapi/erp/v1`

**响应格式：**

```json
{ "code": 0, "message": "success", "data": ... }
```

---

## 科目 accounts（前端 store: `accounts`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/accounts` | 列出全部科目 |
| GET | `/accounts/:id` | 按 ID 查询 |
| PUT | `/accounts/:id` | 新增/更新（upsert） |
| DELETE | `/accounts/:id` | 删除一条 |
| DELETE | `/accounts` | 清空全部 |

## 凭证 vouchers

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/vouchers` | 列出全部凭证 |
| GET | `/vouchers/:id` | 按 ID 查询 |
| PUT | `/vouchers/:id` | 新增/更新 |
| DELETE | `/vouchers/:id` | 删除一条 |
| DELETE | `/vouchers` | 清空全部 |

JSON 字段与前端 `Voucher` 类型一致（含 `entries` JSON 数组）。

## 附件 attachments

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/attachments` | 列出全部 |
| GET | `/attachments/:id` | 按 ID 查询 |
| PUT | `/attachments/:id` | 新增/更新（`data` 为 base64 字符串） |
| DELETE | `/attachments/:id` | 删除 |
| DELETE | `/attachments` | 清空 |

## 审计日志 audit-logs

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/audit-logs?limit=0` | 列表（`limit=0` 表示全部；>0 为条数上限） |
| GET | `/audit-logs/:id` | 单条 |
| POST | `/audit-logs` | 追加日志 `{ action, target, details }` |
| DELETE | `/audit-logs` | 清空 |

## 设置 settings

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/settings` | 全部 `{ key, value }[]` |
| GET | `/settings/:key` | 单条，不存在时 `value: null` |
| PUT | `/settings/:key` | 写入 `{ "value": ... }` |
| DELETE | `/settings/:key` | 删除 |
| DELETE | `/settings` | 清空 |

常用 key：`companyName`、`defaultSignatory`、`declaredQuarters`、`voucherTemplates` 等。

## 应用初始化

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/app/init` | 启动初始化：默认科目同步、凭证分录科目名校正、已申报季度凭证结项同步 |

前端 `AppInit` 会调用此接口。返回：

```json
{ "companyName": "", "accounts": [], "repaired": 0, "syncedLocks": 0 }
```

## 备份 / 恢复

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/data/export` | 导出全库（对应 `DB.exportAll()`） |
| POST | `/data/import` | 导入全库（清空后写入，对应 `DB.importAll()`） |

---

## 前端接入

开发环境在 `frontend/.env.development` 配置：

```
VITE_API_BASE_URL=/openapi/erp/v1
```

`vite.config.ts` 已将 `/openapi`、`/health` 代理到 `http://127.0.0.1:30000`。

所有业务数据仅存 PostgreSQL，前端通过 `db.ts` + `apiClient.ts` 访问本 API（不再使用 IndexedDB）。

业务逻辑（凭证审核、报表、税务结转等）在前端 services 中执行，通过本存储层读写服务端数据。

---

## 数据库表

| 表名 | 对应前端 store |
|------|----------------|
| `chart_accounts` | accounts |
| `vouchers` | vouchers |
| `attachments` | attachments |
| `audit_logs` | auditLogs |
| `settings` | settings |

初始化（二选一即可，全新部署）：

```bash
# 推荐：GORM AutoMigrate
go run ./cmd/envinit schema

# 或执行原生 SQL（migrations/erp.up.sql）
```

启动 API：

```bash
go run ./cmd/webserver   # 默认 :30000
```

## 与原有 `/openapi/base` 的区别

- `/openapi/base/v1/accounts` — 系统登录用户（`account` 表）
- `/openapi/erp/v1/accounts` — 会计科目（`chart_accounts` 表）
