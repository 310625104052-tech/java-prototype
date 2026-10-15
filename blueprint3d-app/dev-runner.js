import { spawn } from 'child_process';
import http from 'http';

const FASTAPI_PORT = 8001;
const VITE_PORT = 3000;

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${FASTAPI_PORT}/api/health`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startFastAPI() {
  console.log(`[DevRunner] Starting FastAPI on port ${FASTAPI_PORT}...`);
  const proc = spawn(process.platform === 'win32' ? 'py' : 'python3', ['backend/main.py'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, PYTHONPATH: '.' },
  });

  proc.on('error', (err) => {
    console.error(`[DevRunner] Failed to spawn FastAPI:`, err);
  });

  return proc;
}

async function main() {
  let isShuttingDown = false;
  let pythonProc = null;
  let restartAttempts = 0;
  const MAX_RESTART_ATTEMPTS = 5;
  let restartTimeout = null;

  // 1. Start Vite IMMEDIATELY on port 3000 so the UI and dev server are immediately available
  console.log(`[DevRunner] Starting Vite on port ${VITE_PORT}...`);
  const viteProc = spawn('node', ['./node_modules/vite/bin/vite.js', `--port=${VITE_PORT}`], {
    stdio: 'inherit',
    env: process.env,
  });

  const cleanup = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    if (restartTimeout) clearTimeout(restartTimeout);
    if (pythonProc) {
      try { pythonProc.kill('SIGTERM'); } catch {}
    }
    if (viteProc) {
      try { viteProc.kill('SIGTERM'); } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  viteProc.on('exit', (code) => {
    isShuttingDown = true;
    cleanup();
  });

  // 2. Launch FastAPI asynchronously with controlled restart limits
  const launchPython = () => {
    if (isShuttingDown || restartAttempts >= MAX_RESTART_ATTEMPTS) return;

    try {
      pythonProc = startFastAPI();

      pythonProc.on('exit', (code, signal) => {
        console.log(`[DevRunner] FastAPI process exited (code: ${code}, signal: ${signal})`);
        pythonProc = null;
        if (!isShuttingDown) {
          restartAttempts++;
          if (restartAttempts < MAX_RESTART_ATTEMPTS) {
            const delay = Math.min(2000 * Math.pow(1.5, restartAttempts), 10000);
            console.log(`[DevRunner] Retrying FastAPI in ${(delay / 1000).toFixed(1)}s (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`);
            restartTimeout = setTimeout(launchPython, delay);
          } else {
            console.warn(`[DevRunner] FastAPI reached maximum restart attempts (${MAX_RESTART_ATTEMPTS}). Leaving Vite active.`);
          }
        }
      });
    } catch (err) {
      console.error(`[DevRunner] Error launching FastAPI:`, err);
    }
  };

  // Launch FastAPI in background
  launchPython();

  // 3. Periodic health check to reset retry counter if FastAPI stays healthy
  setInterval(async () => {
    if (!isShuttingDown) {
      const healthy = await checkHealth();
      if (healthy) {
        restartAttempts = 0;
      } else if (!pythonProc && restartAttempts < MAX_RESTART_ATTEMPTS) {
        console.log(`[DevRunner] Watchdog detected port ${FASTAPI_PORT} is down. Restarting FastAPI...`);
        launchPython();
      }
    }
  }, 10000);
}

main();
