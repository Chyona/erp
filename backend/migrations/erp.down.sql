-- 全新部署回滚：删除 ERP 与登录相关表
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS chart_accounts;
DROP TABLE IF EXISTS account;
