// pm2 process manager config for the full GyanBrige stack.
//
//   pm2 start deploy/ecosystem.config.cjs
//   pm2 save
//
// Runs the 4 backend services (tsx), the Caddy single-origin reverse proxy,
// and the ngrok tunnel. Docker infra (postgres/mongo/redis/minio/livekit) is
// managed separately via `pnpm infra:up`.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Resolve caddy/ngrok even before their winget PATH entry is picked up.
const CADDY =
  process.env.CADDY_BIN ||
  'C:/Users/Ishan/AppData/Local/Microsoft/WinGet/Packages/CaddyServer.Caddy_Microsoft.Winget.Source_8wekyb3d8bbwe/caddy.exe';
const NGROK =
  process.env.NGROK_BIN ||
  'C:/Users/Ishan/AppData/Local/Microsoft/WinGet/Packages/Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe/ngrok.exe';

// Pull PUBLIC_HOST out of the root .env so the ngrok tunnel targets the right
// static domain without duplicating config.
function readEnv(key) {
  try {
    const txt = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    const m = txt.match(new RegExp('^' + key + '=(.*)$', 'm'));
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}
const PUBLIC_HOST = readEnv('PUBLIC_HOST');

const tsxService = (name, dir, port) => ({
  name,
  cwd: path.join(ROOT, 'services', dir),
  script: 'src/index.ts',
  interpreter: 'node',
  interpreter_args: '--import tsx',
  env: port ? { NODE_ENV: 'production', PORT: String(port) } : { NODE_ENV: 'production' },
  autorestart: true,
  max_restarts: 20,
  restart_delay: 3000,
});

const apps = [
  tsxService('gb-api', 'api', 4000),
  tsxService('gb-realtime', 'realtime', 4002),
  {
    name: 'gb-transcription',
    cwd: path.join(ROOT, 'services', 'transcription'),
    script: 'transcriptionServer.js',
    interpreter: 'node',
    env: { NODE_ENV: 'production', PORT: '4001' },
    autorestart: true,
    max_restarts: 20,
    restart_delay: 3000,
  },
  tsxService('gb-worker', 'worker', null),
  {
    // Main public site: Next.js frontend (self-contained, own /api, JSON DB).
    name: 'gb-frontend',
    cwd: path.join(ROOT, 'frontend'),
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    interpreter: 'node',
    env: { NODE_ENV: 'production', PORT: '3000', NEXT_PUBLIC_QR_HOST: PUBLIC_HOST },
    autorestart: true,
    max_restarts: 20,
    restart_delay: 3000,
  },
  {
    name: 'gb-caddy',
    script: CADDY,
    args: `run --config "${path.join(ROOT, 'deploy', 'Caddyfile')}"`,
    interpreter: 'none',
    cwd: ROOT,
    autorestart: true,
  },
  {
    name: 'gb-ngrok',
    script: NGROK,
    args: PUBLIC_HOST
      ? `http --domain=${PUBLIC_HOST} 8080 --log=stdout`
      : 'http 8080 --log=stdout',
    interpreter: 'none',
    cwd: ROOT,
    autorestart: true,
  },
];

module.exports = { apps };
