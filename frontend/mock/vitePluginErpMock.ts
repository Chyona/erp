/**
 * Vite 插件：在开发服务器拦截 /health 与 /openapi/erp/v1，走内存 Mock。
 */
import type { Plugin } from 'vite';
import { handleErpMockRequest } from './erpHandlers';

/** 创建 ERP Mock 插件；仅应在 VITE_USE_MOCK=true 时启用。 */
export function erpMockPlugin(): Plugin {
  return {
    name: 'erp-mock-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const handled = await handleErpMockRequest(req, res);
          if (!handled) next();
        } catch (err) {
          next(err);
        }
      });
    }
  };
}
