/**
 * 应用级公开配置（来自环境变量，无密钥）。
 * 本地改 .env；生产改 .env.production。
 */
export const APP_CONFIG = {
  /** 系统全称（浏览器标题、关于信息） */
  name: import.meta.env.VITE_APP_NAME || '记账电子凭证系统',
  /** 侧栏短名称 */
  shortName: import.meta.env.VITE_APP_SHORT_NAME || '电子凭证',
  /** 一句话说明 */
  description: import.meta.env.VITE_APP_DESCRIPTION || '中小企业记账与凭证管理',
  /** 侧栏底部文案 */
  footer: import.meta.env.VITE_APP_FOOTER || '数据存于服务端 · ERP API'
} as const;
