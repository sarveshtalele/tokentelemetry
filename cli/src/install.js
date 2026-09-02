const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const paths = require('./paths');

const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];

function log(msg) {
  console.log(msg);
}

function copyVendorFiles() {
  const src = paths.vendorDir();
  const dest = paths.installDir();
  if (!fs.existsSync(src)) {
    throw new Error(
      `Bundled app files not found at ${src}. This package was not built correctly (missing "vendor/" — ` +
        `run "npm run prepack" in the cli/ source, or reinstall from npm).`
    );
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    fs.cpSync(path.join(src, entry), path.join(dest, entry), { recursive: true, force: true });
  }
  log(`Copied app files to ${dest}`);
}

function commandExists(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'ignore' });
  return !res.error && res.status === 0;
}

function findSystemPython() {
  if (process.platform === 'win32') {
    if (commandExists('py', ['-3', '--version'])) return { cmd: 'py', baseArgs: ['-3'] };
    if (commandExists('python', ['--version'])) return { cmd: 'python', baseArgs: [] };
  } else {
    if (commandExists('python3', ['--version'])) return { cmd: 'python3', baseArgs: [] };
    if (commandExists('python', ['--version'])) return { cmd: 'python', baseArgs: [] };
  }
  throw new Error('No Python 3 interpreter found on PATH. Install Python 3.9+ and re-run "tokentelemetry install".');
}

function run(cmd, args, opts) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Command failed (${res.status}): ${cmd} ${args.join(' ')}`);
}

function setupPythonEnv() {
  const root = paths.installDir();
  const venv = paths.venvDir();
  // Only the FastAPI backend's deps are needed to run "tokentelemetry start"
  // (the daemon/telemetry package is stdlib-only). The legacy Streamlit
  // requirements.txt at the repo root is intentionally not installed here.
  const reqFiles = [path.join(root, 'backend', 'requirements.txt')];

  const useUv = commandExists('uv', ['--version']);
  if (!fs.existsSync(venv)) {
    if (useUv) {
      log('Creating Python environment with uv…');
      run('uv', ['venv', venv]);
    } else {
      log('uv not found on PATH — falling back to the standard venv module.');
      const py = findSystemPython();
      run(py.cmd, [...py.baseArgs, '-m', 'venv', venv]);
    }
  } else {
    log('Python environment already exists, reusing it.');
  }

  log('Installing Python dependencies…');
  if (useUv) {
    run('uv', ['pip', 'install', '-p', paths.venvPython(), ...reqFiles.flatMap((f) => ['-r', f])]);
  } else {
    run(paths.venvPython(), ['-m', 'pip', 'install', '--upgrade', 'pip']);
    run(paths.venvPython(), ['-m', 'pip', 'install', ...reqFiles.flatMap((f) => ['-r', f])]);
  }
}

function readJsonSafe(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

function hookCommand() {
  const hookPath = path.join(paths.installDir(), 'hooks', 'claude-telemetry-hook.py');
  const python = paths.venvPython();
  return `"${python}" "${hookPath}"`;
}

function installHooks() {
  const settingsPath = paths.claudeSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  const cfg = readJsonSafe(settingsPath);
  cfg.hooks = cfg.hooks || {};

  const cmd = hookCommand();
  for (const evt of HOOK_EVENTS) {
    const existing = Array.isArray(cfg.hooks[evt]) ? cfg.hooks[evt] : [];
    const alreadyPresent = existing.some(
      (item) => Array.isArray(item.hooks) && item.hooks.some((h) => h.command === cmd)
    );
    if (!alreadyPresent) {
      existing.push({ hooks: [{ type: 'command', command: cmd, timeout: 10 }] });
    }
    cfg.hooks[evt] = existing;
  }

  fs.writeFileSync(settingsPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  log(`Installed Claude Code telemetry hooks in ${settingsPath}`);
}

function install() {
  copyVendorFiles();
  setupPythonEnv();
  installHooks();

  log('');
  log('Install complete.');
  log(`  App directory: ${paths.installDir()}`);
  log(`  Python env:    ${paths.venvDir()}`);
  log('');
  log('Run "tokentelemetry start" to launch the backend, daemon, and dashboard.');
  log('To start telemetry automatically at login, see "tokentelemetry status" for the manual');
  log('OS autostart command for your platform (Task Scheduler / launchd / systemd --user).');
}

function uninstall({ purge = false } = {}) {
  const settingsPath = paths.claudeSettingsPath();
  if (fs.existsSync(settingsPath)) {
    const cfg = readJsonSafe(settingsPath);
    const cmd = hookCommand();
    if (cfg.hooks) {
      for (const evt of HOOK_EVENTS) {
        if (!Array.isArray(cfg.hooks[evt])) continue;
        cfg.hooks[evt] = cfg.hooks[evt].filter(
          (item) => !(Array.isArray(item.hooks) && item.hooks.some((h) => h.command === cmd))
        );
      }
      fs.writeFileSync(settingsPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
      log(`Removed telemetry hooks from ${settingsPath}`);
    }
  }

  const dirExists = fs.existsSync(paths.installDir());
  if (purge) {
    if (dirExists) {
      fs.rmSync(paths.installDir(), { recursive: true, force: true });
      log(`Removed ${paths.installDir()}`);
    } else {
      log(`Nothing to purge — ${paths.installDir()} does not exist (already removed).`);
    }
  } else if (dirExists) {
    log(`Left app files and the telemetry database in place at ${paths.installDir()}.`);
    log('Re-run with "tokentelemetry uninstall --purge" to remove them too.');
  }
}

module.exports = { install, uninstall, setupPythonEnv, installHooks, copyVendorFiles, hookCommand };
