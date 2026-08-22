# ERP 数据存储 API

对应前端 `frontend/src/services/erpApi.ts`（`ErpApi`），业务持久化到 PostgreSQL；附件文件存对象存储。

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
| POST | `/accounts/batch` | 统一批量：`{ action: "upsert"\|"delete", items?\|ids? }` |
| GET | `/accounts/:id` | 按 ID 查询 |
| PUT | `/accounts/:id` | 新增/更新（upsert） |
| DELETE | `/accounts/:id` | 删除一条 |
| DELETE | `/accounts` | 清空全部 |

## 凭证 vouchers

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/vouchers` | 列出全部凭证 |
| POST | `/vouchers/batch` | **统一批量入口**（见下） |
| GET | `/vouchers/import-llm-status` | 截图识别大模型是否已配置 |
| POST | `/vouchers/parse-import-image` | 分录表截图 → 表格行列（视觉大模型） |
| GET | `/vouchers/:id` | 按 ID 查询 |
| PUT | `/vouchers/:id` | 新增/更新 |
| DELETE | `/vouchers/:id` | 删除一条 |
| DELETE | `/vouchers` | 清空全部 |

### `POST /vouchers/batch`

通过 `action` 区分操作；`ids` / `items` 均为数组，**长度 1 = 单条，多条 = 批量**。

```json
// 写入
{ "action": "upsert", "items": [ { "id": "...", "...": "..." } ] }

// 审核 / 反审核 / 删除
{ "action": "approve", "ids": ["id1", "id2"] }
{ "action": "unapprove", "ids": ["id1"] }
{ "action": "delete", "ids": ["id1", "id2"] }
```

状态类操作返回：

```json
{
  "action": "approve",
  "approved": 2,
  "unapproved": 0,
  "deleted": 0,
  "skipped": 1,
  "failed": [{ "id": "...", "voucherNo": "记-1", "message": "..." }]
}
```

upsert 返回：`{ "action": "upsert", "count": N, "items": [...] }`。

## 附件 attachments

文件存对象存储（COS 等）；库表仅保存**未签名**公开 URL。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/attachments` | 列出全部 |
| POST | `/attachments/upload` | multipart 上传：`file` + 可选 `id`/`name`/`voucherDate`（凭证日期，用于 `attachments/YYYY/MM/`），返回附件元数据（含 `url`） |
| POST | `/attachments/batch` | 统一批量：`{ action: "upsert"\|"delete", items?\|ids? }`（upsert 仅元数据） |
| GET | `/attachments/:id` | 按 ID 查询 |
| PUT | `/attachments/:id` | 更新元数据（如重命名；不可写文件内容） |
| DELETE | `/attachments/:id` | 删除 |
| DELETE | `/attachments` | 清空 |

附件字段：`id`、`name`、`type`、`size`、`url`、`uploadedAt`。`url` 为对象存储公开地址，不含签名参数。

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
| PUT | `/settings/batch` | 批量写入（body: `{ items: [{ key, value }] }`） |
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
| GET | `/data/export` | 导出全库（对应 `ErpApi.exportAll()`） |
| POST | `/data/import` | 导入全库（清空后写入，对应 `ErpApi.importAll()`） |

---

## 前端接入

开发环境在 `frontend/.env.development` 配置：

```
VITE_API_BASE_URL=/openapi/erp/v1
```

`vite.config.ts` 已将 `/openapi`、`/health` 代理到 `http://127.0.0.1:30000`。

所有业务数据仅存 PostgreSQL，附件文件存 COS；前端通过 `erpApi.ts` + `apiClient.ts` 访问本 API（浏览器不落库）。

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
