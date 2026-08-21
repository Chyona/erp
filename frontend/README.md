# 记账电子凭证系统（前端）

React + Vite + Ant Design。业务数据通过 HTTP 访问后端 `/openapi/erp/v1`（开发可走代理或本地 Mock）。

## 快速开始

```bash
cp .env.example .env   # 首次：复制本地环境变量
pnpm install
pnpm dev               # 代理到真实后端（默认 http://127.0.0.1:30000）
# 或
pnpm dev:mock          # 不启后端，使用内存 Mock
```

开发服务器默认：http://localhost:5173

## 环境变量

| 文件 | 用途 | 是否提交 |
|------|------|----------|
| `.env` | 本地开发 | 否 |
| `.env.example` | 本地示例 | 是 |
| `.env.production` | 生产构建公开配置（无代理/密钥） | 是 |

```bash
cp .env.example .env
```

Vite 加载规则（文件不存在则跳过，不报错）：

1. `pnpm dev` → `mode=development`，读本机 `.env`（含代理 / Mock，不提交）
2. `pnpm build` → `mode=production`，读已提交的 `.env.production`  
   （CI 通常没有 `.env`；本机若有 `.env`，会先读，再被 `.env.production` 同名项覆盖）

| 变量 | 说明 | 默认 |
|------|------|------|
| `VITE_APP_NAME` | 系统全称（浏览器标题） | `记账电子凭证系统` |
| `VITE_APP_SHORT_NAME` | 侧栏短名称 | `电子凭证` |
| `VITE_APP_DESCRIPTION` | 系统简介 | — |
| `VITE_APP_FOOTER` | 侧栏底部文案 | — |
| `VITE_API_BASE_URL` | 前端请求的 API 根路径 | `/openapi/erp/v1` |
| `VITE_PROXY_TARGET` | 仅本地 `.env`：Vite 开发代理目标 | `http://127.0.0.1:30000` |
| `VITE_USE_MOCK` | `true` 时启用 Mock | `false` |

说明：`VITE_PROXY_TARGET` 只写在本地 `.env`，**不要**写入可提交的 `.env.production`。

- 联调后端：`.env` 中 `VITE_USE_MOCK=false`，先启动 `backend` 的 `go run ./cmd/webserver`
- 纯前端：`pnpm dev:mock`（临时设置 `VITE_USE_MOCK=true`，无需改 `.env`）

## 代理与 Mock

- **代理**：`vite.config.ts` 将 `/openapi`、`/health` 转发到 `VITE_PROXY_TARGET`
- **Mock**：`mock/` 目录提供与后端一致的 JSON 信封与 CRUD（科目/凭证/附件/审计/设置、`/app/init`、导入导出）

```
frontend/
├── .env / .env.example
├── .env.production
├── vite.config.ts          # 代理 / Mock 切换
├── mock/
│   ├── erpStore.ts         # 内存数据
│   ├── erpHandlers.ts      # 路由处理
│   └── vitePluginErpMock.ts
└── src/services/
    ├── apiClient.ts
    └── db.ts               # 统一走 /openapi/erp/v1
```

## 常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发（代理后端） |
| `pnpm dev:mock` | 开发（Mock） |
| `pnpm build` | 生产构建 |
| `pnpm preview` | 预览构建产物 |
| `pnpm typecheck` | TypeScript 检查 |

## 免责声明

本系统为辅助记账工具，不构成专业财务或税务建议。
