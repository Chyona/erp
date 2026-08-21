/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API 根路径，如 /openapi/erp/v1 */
  readonly VITE_API_BASE_URL: string;
  /** 开发代理目标后端地址（仅本地 .env） */
  readonly VITE_PROXY_TARGET?: string;
  /** 是否启用 Vite Mock（'true' | 'false'） */
  readonly VITE_USE_MOCK?: string;
  /** 系统全称 */
  readonly VITE_APP_NAME?: string;
  /** 侧栏短名称 */
  readonly VITE_APP_SHORT_NAME?: string;
  /** 系统简介 */
  readonly VITE_APP_DESCRIPTION?: string;
  /** 侧栏底部文案 */
  readonly VITE_APP_FOOTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
