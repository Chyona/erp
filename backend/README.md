# Base

基于 **Gin + PostgreSQL** 的基础 API 服务，提供账号管理 RESTful 接口。

## 环境要求

- Go 1.25+
- PostgreSQL 14+

## 项目结构

```
base/
├── cmd/
│   ├── webserver/          # HTTP API 服务入口
│   └── envinit/            # 环境初始化 CLI（建表、种子数据）
├── internal/               # 业务代码（含内嵌 config.yaml）
├── docker/                 # 容器部署（Dockerfile、compose、.env）
├── docs/                   # Swagger 文档（docs.go）
└── logs/                   # 运行时日志（自动创建）
```

## 配置说明

配置加载优先级（从高到低）：

1. 环境变量（如 `DATABASE_*`、`COS_*`，容器部署时使用）
2. 外部配置文件（`-config` 参数指定）
3. 内嵌默认配置 `internal/config/config.yaml`（本地调试默认使用）

本地调试可直接使用内嵌配置，默认连接：

| 配置项 | 默认值 |
|--------|--------|
| 服务端口 | `30000` |
| 数据库地址 | `127.0.0.1:5432` |
| 数据库名 | `base_db` |
| 数据库用户 | `postgres` / `postgres` |

## ERP 前端对接

前端通过 `frontend/src/services/erpApi.ts`（`ErpApi`）访问 **`/openapi/erp/v1`**（科目/凭证/附件元数据/审计/设置、`/app/init`、备份导入；附件文件走 COS）。接口说明见 `docs/ERP_API.md`。

健康检查：`GET /health`（无 `/openapi` 前缀）。

## 初始化

### 1. 安装依赖

```bash
go mod download
```

### 2. 准备 PostgreSQL 数据库

确保 PostgreSQL 已启动，并创建数据库（若尚未创建）：

```sql
CREATE DATABASE base_db;
```

### 3. 执行环境初始化

`envinit` 提供三个子命令：

| 命令 | 说明 |
|------|------|
| `schema` | 仅初始化数据库表结构（GORM AutoMigrate） |
| `seed` | 仅填充基础数据 |
| `init` | 一键执行：建表 + 填充基础数据 |

**推荐：首次使用执行一键初始化**

```bash
go run ./cmd/envinit init
```

分步执行：

```bash
go run ./cmd/envinit schema   # 建表
go run ./cmd/envinit seed     # 填充种子数据
```

初始化完成后（或每次启动 webserver）会确保内置管理员存在：

| 用户名 | 密码 | 说明 |
|--------|------|------|
| admin | admin | 系统内置管理员，不强制首次改密 |

若不存在会自动创建；已存在则只保证角色为管理员且启用，**不会覆盖已修改的密码**。

### 4. 使用自定义配置初始化

若本地数据库配置与默认不同，可通过环境变量或外部配置文件覆盖：

```bash
# 环境变量
DATABASE_PASSWORD=your_password go run ./cmd/envinit init

# 外部配置文件（任意路径的 yaml）
go run ./cmd/envinit init -config /path/to/your.yaml
```

## 本地调试

### 启动 API 服务

```bash
go run ./cmd/webserver
```

服务默认监听 `http://localhost:30000`。

### 使用自定义配置启动

```bash
go run ./cmd/webserver -config /path/to/your.yaml
```

或通过环境变量覆盖，例如：

```bash
SERVER_MODE=debug go run ./cmd/webserver
```

### 验证服务

```bash
# 健康检查
curl http://localhost:30000/health

# 查询账号列表
curl http://localhost:30000/openapi/base/v1/accounts
```

### Swagger 文档

浏览器访问：

```
http://localhost:30000/swagger/index.html
```

### 鉴权说明

登录接口（无需 Token）：

```bash
curl -X POST http://localhost:30000/openapi/base/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

返回的 `token` 用于访问 ERP 与账号管理接口，示例：

```bash
curl -X PUT http://localhost:30000/openapi/base/v1/accounts/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"新昵称"}'
```

默认内置账号：`admin` / `admin`（启动时自动确保存在）。

### 日志

日志输出到 `logs/base.log`，单文件最大 10MB，最多保留 10 个历史文件。

```bash
tail -f logs/base.log
```

## 容器部署（可选）

```bash
cd docker
cp .env.example .env   # 编辑 .env 填入数据库信息
docker compose up -d --build
```

本地构建上下文为 `backend/`（`go.mod` 所在目录），Dockerfile 为 `backend/docker/Dockerfile`。  
CI 在推送 `v*` tag 时按同样路径打包并推送到 Docker Hub：`{DOCKERHUB_USERNAME}/erp`。

详细配置说明见 `docker/docker-compose.yaml` 与 `docker/.env.example`。

## 常用 API 路径

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/openapi/base/v1/accounts` | 账号列表 |
| POST | `/openapi/base/v1/accounts` | 创建账号 |
| GET | `/openapi/base/v1/accounts/:id` | 账号详情 |
| PUT | `/openapi/base/v1/accounts/:id` | 更新账号（需鉴权） |
| DELETE | `/openapi/base/v1/accounts/:id` | 删除账号（需鉴权） |
| GET | `/openapi/base/v2/accounts/:id/profile` | 账号概要（v2） |
