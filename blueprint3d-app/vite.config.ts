import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// Keeps /api/* failures JSON: if the dev server falls through to index.html
// for an /api route, rewrite it into a 502 JSON response instead of HTML.
function apiGuardPlugin(): Plugin {
  return {
    name: 'api-guard-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/')) {
          const resObj = res as any;
          const originalWriteHead = resObj.writeHead;
          resObj.writeHead = function (statusCode: number, headers: any) {
            if (headers && typeof headers === 'object' && headers['Content-Type']?.includes('text/html')) {
              headers['Content-Type'] = 'application/json';
              return originalWriteHead.call(this, 502, headers);
            }
            return originalWriteHead.apply(this, arguments as any);
          };
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiGuardPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8001',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('error', (err, req, res) => {
              console.error(`[Vite Proxy Error on ${req?.url || '/api'}]:`, err.message);
              const resObj = res as any;
              if (resObj && !resObj.headersSent) {
                resObj.writeHead(503, {
                  'Content-Type': 'application/json',
                });
                resObj.end(
                  JSON.stringify({
                    success: false,
                    error: `Backend service on port 8001 is unavailable (${err.message}). Ensure FastAPI is active.`,
                  })
                );
              }
            });
          },
        },
      },
    },
  };
});
