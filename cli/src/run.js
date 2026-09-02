const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const paths = require('./paths');

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 5173;
const STARTUP_CHECK_DELAY_MS = 800;

function logDir() {
  const dir = path.join(paths.installDir(), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function logPath(name) {
  return path.join(logDir(), name);
}

function openLog(name) {
  return fs.openSync(logPath(name), 'a');
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnDetached(cmd, args, opts) {
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ['ignore', opts.out, opts.err],
    cwd: opts.cwd,
    env: opts.env,
  });
  // Without this, a missing binary (ENOENT) or similar spawn failure emits
  // an async 'error' event that Node treats as unhandled and crashes the
  // whole CLI process. spawnAndVerify's post-spawn isAlive() check already
  // reports the failure properly -- this just stops it from being fatal.
  child.on('error', () => {});
  child.unref();
  return child.pid;
}

function tailLog(name, maxChars = 400) {
  try {
    const content = fs.readFileSync(logPath(name), 'utf8');
    return content.length > maxChars ? '…' + content.slice(-maxChars) : content;
  } catch {
    return '(no log output captured)';
  }
}

function ensureInstalled() {
  if (!fs.existsSync(paths.venvPython())) {
    throw new Error('Not installed yet. Run "tokentelemetry install" first.');
  }
}

function openBrowser(url) {
  if (process.env.TOKENTELEMETRY_NO_OPEN) return;
  const [cmd, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true });
    // Best-effort only: a missing opener (headless server, or the autostart
    // entry running before a desktop session exists) emits an async 'error'
    // that would otherwise crash this process as an unhandled event -- it
    // just means there's no browser to open, not a real failure.
    child.on('error', () => {});
    child.unref();
  } catch {
    // spawn() itself throwing synchronously (rare) is just as harmless here.
  }
}

/**
 * Spawn a service and give it a moment to either come up or crash, so
 * `start` reports what actually happened instead of always claiming
 * success. Returns the pid if it's still alive after the check, or null
 * (and prints a specific, actionable error) if it already exited.
 */
async function spawnAndVerify(label, logName, cmd, args, opts) {
  const out = openLog(logName);
  const pid = spawnDetached(cmd, args, { ...opts, out, err: out });
  await sleep(STARTUP_CHECK_DELAY_MS);
  if (isAlive(pid)) return pid;
  const tail = tailLog(logName);
  console.log(`${label} failed to start. Last output from ${logPath(logName)}:`);
  console.log(tail);
  if (/EADDRINUSE|address already in use/i.test(tail)) {
    console.log(`(Looks like the port is already in use — is another instance of tokentelemetry already running?)`);
  }
  return null;
}

async function start() {
  ensureInstalled();
  const state = readRunState();

  if (isAlive(state.backend)) {
    console.log(`Backend already running (pid ${state.backend}).`);
  } else {
    const backendDir = path.join(paths.installDir(), 'backend');
    const pid = await spawnAndVerify(
      'Backend',
      'backend.log',
      paths.venvPython(),
      ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(BACKEND_PORT)],
      { cwd: backendDir }
    );
    if (pid) {
      state.backend = pid;
      console.log(`Backend started (pid ${pid}) on http://127.0.0.1:${BACKEND_PORT}`);
    } else {
      delete state.backend;
    }
  }

  if (isAlive(state.daemon)) {
    console.log(`Telemetry daemon already running (pid ${state.daemon}).`);
  } else {
    const pid = await spawnAndVerify('Telemetry daemon', 'daemon.log', paths.venvPython(), ['-m', 'telemetry.daemon'], {
      cwd: paths.installDir(),
    });
    if (pid) {
      state.daemon = pid;
      console.log(`Telemetry daemon started (pid ${pid}).`);
    } else {
      delete state.daemon;
    }
  }

  if (isAlive(state.frontend)) {
    console.log(`Dashboard already running (pid ${state.frontend}).`);
  } else {
    const frontendDir = path.join(paths.installDir(), 'frontend-dist');
    const pid = await spawnAndVerify(
      'Dashboard',
      'frontend.log',
      process.execPath,
      [path.join(__dirname, 'static-server.js'), frontendDir, String(FRONTEND_PORT), String(BACKEND_PORT)],
      { cwd: paths.installDir() }
    );
    if (pid) {
      state.frontend = pid;
      console.log(`Dashboard started (pid ${pid}) on http://127.0.0.1:${FRONTEND_PORT}`);
    } else {
      delete state.frontend;
    }
  }

  writeRunState(state);
  const dashboardUrl = `http://127.0.0.1:${FRONTEND_PORT}`;
  console.log('');
  if (state.frontend) {
    console.log(`Opening ${dashboardUrl} in your browser…`);
    console.log(`Logs: ${logDir()}`);
    openBrowser(dashboardUrl);
  } else {
    console.log(`Dashboard isn't up — see the error above. Logs: ${logDir()}`);
  }
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
      // Strict 200 (not just "any non-5xx") -- something *else* answering on
      // the port with a 404 shouldn't read as our own service being healthy.
      resolve(res.statusCode === 200);
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
  if (!backendUp || !frontendUp) {
    console.log(`  Not running? "tokentelemetry start". Running but unreachable? Check ${logDir()}`);
  }
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
