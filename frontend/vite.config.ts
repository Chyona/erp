import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { erpMockPlugin } from './mock/vitePluginErpMock';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv(mode)：读 .env（若有）再读 .env.[mode]（若有）；后者覆盖同名项
  // build 时 mode=production → 以 .env.production 为准（CI 通常只有该文件）
  const env = loadEnv(mode, process.cwd(), '');
  const useMock = env.VITE_USE_MOCK === 'true';
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:30000';

  return {
    plugins: [react(), ...(useMock ? [erpMockPlugin()] : [])],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5173,
      host: true,
      open: true,
      // Mock 开启时由插件处理 /openapi、/health，不再转发到真实后端
      proxy: useMock
        ? undefined
        : {
            '/openapi': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false
            },
            '/health': {
              target: proxyTarget,
              changeOrigin: true,
              secure: false
            }
          }
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT) || 4173,
      proxy: useMock
        ? undefined
        : {
            '/openapi': { target: proxyTarget, changeOrigin: true, secure: false },
            '/health': { target: proxyTarget, changeOrigin: true, secure: false }
          }
    }
  };
});
