-- 全新部署建表脚本（与 GORM AutoMigrate 模型一致；不考虑增量升级）
-- 登录账号表（/openapi/base）
CREATE TABLE IF NOT EXISTS account (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(64)  NOT NULL UNIQUE,
    email       VARCHAR(128) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    nickname    VARCHAR(64),
    open_id     VARCHAR(128),
    remark      VARCHAR(256),
    phone       VARCHAR(32),
    ext         VARCHAR(1024),
    status      SMALLINT     NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_account_deleted_at ON account (deleted_at);
CREATE INDEX IF NOT EXISTS idx_account_open_id ON account (open_id);

-- 会计科目（前端 accounts store → /openapi/erp/v1/accounts）
CREATE TABLE IF NOT EXISTS chart_accounts (
    id          VARCHAR(64)  PRIMARY KEY,
    code        VARCHAR(32)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    category    VARCHAR(32)  NOT NULL,
    direction   VARCHAR(16)  NOT NULL,
    created_at  VARCHAR(32),
    updated_at  VARCHAR(32)
);

CREATE INDEX IF NOT EXISTS idx_chart_accounts_code ON chart_accounts (code);

-- 会计凭证（前端 vouchers store）
CREATE TABLE IF NOT EXISTS vouchers (
    id                              VARCHAR(64) PRIMARY KEY,
    voucher_type                    VARCHAR(16),
    voucher_number                  VARCHAR(32),
    voucher_no                      VARCHAR(64),
    date                            VARCHAR(16),
    entries                         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    business_type                   VARCHAR(64),
    invoice_type                    VARCHAR(32),
    tax_amount                      DOUBLE PRECISION,
    invoice_numbers                 VARCHAR(512),
    remark                          TEXT,
    status                          VARCHAR(16),
    total_debit                     DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_credit                    DOUBLE PRECISION NOT NULL DEFAULT 0,
    checksum                        VARCHAR(128),
    attachment_ids                  JSONB,
    attachment_count                INTEGER,
    prepared_by                     VARCHAR(64),
    reviewed_by                     VARCHAR(64),
    posted_by                       VARCHAR(64),
    cashier_by                      VARCHAR(64),
    reversed_from_id                VARCHAR(64),
    reversed_from_no                VARCHAR(64),
    is_tax_exemption_carry_forward  BOOLEAN,
    tax_exemption_done              BOOLEAN,
    tax_exemption_voucher_id        VARCHAR(64),
    tax_exemption_period            VARCHAR(32),
    tax_exemption_period_type       VARCHAR(16),
    is_profit_loss_closing          BOOLEAN,
    profit_loss_closing_period      VARCHAR(32),
    profit_loss_closing_period_type VARCHAR(16),
    created_at                      VARCHAR(32),
    updated_at                      VARCHAR(32),
    approved_at                     VARCHAR(32),
    locked_at                       VARCHAR(32),
    quarter_declared_key            VARCHAR(32),
    imported_at                     VARCHAR(32),
    import_source                   VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_number ON vouchers (voucher_number);
CREATE INDEX IF NOT EXISTS idx_vouchers_voucher_no ON vouchers (voucher_no);
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers (date);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers (status);

-- 凭证附件（前端 attachments store，data 为 base64）
CREATE TABLE IF NOT EXISTS attachments (
    id          VARCHAR(64)  PRIMARY KEY,
    name        VARCHAR(256) NOT NULL,
    type        VARCHAR(128),
    size        BIGINT       NOT NULL DEFAULT 0,
    data        TEXT,
    uploaded_at VARCHAR(32)
);

-- 审计日志（前端 auditLogs store）
CREATE TABLE IF NOT EXISTS audit_logs (
    id         VARCHAR(64) PRIMARY KEY,
    timestamp  VARCHAR(32),
    action     VARCHAR(64) NOT NULL,
    target     VARCHAR(128),
    details    TEXT,
    user_agent VARCHAR(256)
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);

-- 系统设置（前端 settings store，key-value JSON）
CREATE TABLE IF NOT EXISTS settings (
    key   VARCHAR(128) PRIMARY KEY,
    value JSONB
);
