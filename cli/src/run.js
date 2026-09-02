const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const paths = require('./paths');

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;

function logDir() {
  const dir = path.join(paths.installDir(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function openLog(name) {
  return fs.openSync(path.join(logDir(), name), 'a');
}

function readRunState() {
  const p = paths.runStatePath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function writeRunState(state) {
  fs.mkdirSync(paths.installDir(), { recursive: true });
  fs.writeFileSync(paths.runStatePath(), JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function spawnDetached(cmd, args, opts) {
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ['ignore', opts.out, opts.err],
    cwd: opts.cwd,
    env: opts.env,
  });
  child.unref();
  return child.pid;
}

function ensureInstalled() {
  if (!fs.existsSync(paths.venvPython())) {
    throw new Error('Not installed yet. Run "tokentelemetry install" first.');
  }
}

function start() {
  ensureInstalled();
  const state = readRunState();

  if (isAlive(state.backend)) {
    console.log(`Backend already running (pid ${state.backend}).`);
  } else {
    const backendDir = path.join(paths.installDir(), 'backend');
    const out = openLog('backend.log');
    const pid = spawnDetached(
      paths.venvPython(),
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
      { cwd: backendDir, out, err: out }
    );
    state.backend = pid;
    console.log(`Backend started (pid ${pid}) on http://127.0.0.1:${BACKEND_PORT}`);
  }

  if (isAlive(state.daemon)) {
    console.log(`Telemetry daemon already running (pid ${state.daemon}).`);
  } else {
    const out = openLog('daemon.log');
    const pid = spawnDetached(paths.venvPython(), ['-m', 'telemetry.daemon'], {
      cwd: paths.installDir(),
      out,
      err: out,
    });
    state.daemon = pid;
    console.log(`Telemetry daemon started (pid ${pid}).`);
  }

  if (isAlive(state.frontend)) {
    console.log(`Dashboard already running (pid ${state.frontend}).`);
  } else {
    const frontendDir = path.join(paths.installDir(), 'frontend-dist');
    const out = openLog('frontend.log');
    const pid = spawnDetached(
      process.execPath,
      [path.join(__dirname, 'static-server.js'), frontendDir, String(FRONTEND_PORT), String(BACKEND_PORT)],
      { cwd: paths.installDir(), out, err: out }
    );
    state.frontend = pid;
    console.log(`Dashboard started (pid ${pid}) on http://127.0.0.1:${FRONTEND_PORT}`);
  }

  writeRunState(state);
  console.log('');
  console.log(`Open http://127.0.0.1:${FRONTEND_PORT} in your browser.`);
  console.log(`Logs: ${logDir()}`);
}

function stop() {
  const state = readRunState();
  let stoppedAny = false;
  for (const key of ['backend', 'daemon', 'frontend']) {
    const pid = state[key];
    if (isAlive(pid)) {
      try {
        process.kill(pid);
        console.log(`Stopped ${key} (pid ${pid}).`);
        stoppedAny = true;
      } catch (err) {
        console.log(`Could not stop ${key} (pid ${pid}): ${err.message}`);
      }
    }
    delete state[key];
  }
  writeRunState(state);
  if (!stoppedAny) console.log('Nothing was running.');
}

function checkHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function status() {
  const state = readRunState();
  console.log(`Install directory: ${paths.installDir()}`);
  console.log(`Claude settings:   ${paths.claudeSettingsPath()}`);
  console.log('');
  for (const key of ['backend', 'daemon', 'frontend']) {
    const pid = state[key];
    console.log(`${key.padEnd(9)} ${isAlive(pid) ? `running (pid ${pid})` : 'not running'}`);
  }
  const backendUp = await checkHttp(`http://127.0.0.1:${BACKEND_PORT}/health`);
  const frontendUp = await checkHttp(`http://127.0.0.1:${FRONTEND_PORT}/`);
  console.log('');
  console.log(`Backend health check:  ${backendUp ? 'OK' : 'unreachable'} (http://127.0.0.1:${BACKEND_PORT}/health)`);
  console.log(`Dashboard reachable:   ${frontendUp ? 'OK' : 'unreachable'} (http://127.0.0.1:${FRONTEND_PORT}/)`);
  console.log('');
  try {
    const autostart = require('./autostart');
    const enabled = autostart.isEnabled();
    console.log(`Autostart at login:    ${enabled ? 'enabled' : 'not enabled'}`);
    if (!enabled) {
      console.log('  Run "tokentelemetry autostart enable" to start automatically every time you log in.');
    }
  } catch (err) {
    console.log(`Autostart at login:    unknown (${err.message})`);
  }
}

module.exports = { start, stop, status };
