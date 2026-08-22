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
    resolve: {
      // 避免 antd/rc-picker 与业务代码各打包一份 dayjs，导致 DatePicker 报 clone.weekday is not a function
      dedupe: ['dayjs', 'react', 'react-dom']
    },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            // 重型按需库单独分包（export / 导入时再加载）
            if (id.includes('exceljs')) return 'exceljs';
            if (id.includes('jszip')) return 'jszip';
            if (id.includes('xlsx')) return 'xlsx';
            // antd 与其依赖（含 dayjs、rc-*）同包，避免循环 chunk
            if (
              id.includes('antd') ||
              id.includes('@ant-design') ||
              id.includes('dayjs') ||
              id.includes('/rc-') ||
              id.includes('\\rc-')
            ) {
              return 'antd';
            }
            // 仅匹配真正的 react 包路径，避免误伤 @ant-design/react-*
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules\\react\\') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules\\react-dom') ||
              id.includes('react-router')
            ) {
              return 'react-vendor';
            }
          }
        }
      }
    },
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
