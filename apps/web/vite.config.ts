/// <reference types="vitest" />
import { defineConfig, createLogger } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const customLogger = createLogger();
const originalError = customLogger.error;
customLogger.error = (msg, options) => {
  // Gracefully filter out transient ECONNREFUSED logs while backend API is starting up
  if (typeof msg === 'string' && msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) {
    customLogger.info('⏳ [vite] Backend API is warming up, connecting shortly...', {
      timestamp: true
    });
    return;
  }
  originalError(msg, options);
};

export default defineConfig({
  customLogger,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            const isConnRefused =
              (err as any)?.code === 'ECONNREFUSED' ||
              err?.message?.includes('ECONNREFUSED');
            if (isConnRefused && res && 'writeHead' in res && !(res as any).headersSent) {
              (res as any).writeHead(503, {
                'Content-Type': 'application/json',
                'Retry-After': '1'
              });
              (res as any).end(
                JSON.stringify({
                  error: {
                    code: 'SERVER_WARMING_UP',
                    message: 'Backend API is still initializing. Retrying connection...'
                  }
                })
              );
            }
          });
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
});
