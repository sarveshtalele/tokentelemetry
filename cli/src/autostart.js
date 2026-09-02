// Registers/removes an OS-level "start tokentelemetry at login" entry, so
// running it every day doesn't require remembering to type `tokentelemetry
// start` yourself. One implementation per platform:
//   Windows -> a Task Scheduler task (via PowerShell)
//   macOS   -> a launchd LaunchAgent
//   Linux   -> a systemd --user service
//
// All three invoke the *full* `start` (backend + daemon + dashboard) using
// absolute paths to `node` and this package's own bin script -- not a bare
// `tokentelemetry` resolved via PATH, which launchd/systemd/Task Scheduler
// often can't see (they don't source your shell profile).
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const paths = require('./paths');

const TASK_NAME = 'Claude Token Telemetry';
const LAUNCHD_LABEL = 'com.tokentelemetry.app';
const SYSTEMD_UNIT = 'tokentelemetry.service';

function binScriptPath() {
  return path.join(paths.packageRoot(), 'bin', 'tokentelemetry.js');
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
}

// ---------- Windows (Task Scheduler) ----------

function windowsEnable() {
  const node = process.execPath;
  const script = path.join(paths.packageRoot(), 'bin', 'tokentelemetry.js');
  const ps = `
$Action = New-ScheduledTaskAction -Execute "${node}" -Argument '"${script}" start'
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName "${TASK_NAME}" -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null
`.trim();
  const res = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  if (res.error || res.status !== 0) {
    throw new Error(
      `Could not register the Task Scheduler task: ${res.stderr || res.error?.message || 'unknown error'}.\n` +
        `You can register it manually -- see the PowerShell snippet in the README.`
    );
  }
}

function windowsDisable() {
  run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `Unregister-ScheduledTask -TaskName "${TASK_NAME}" -Confirm:$false -ErrorAction SilentlyContinue`,
  ]);
}

function windowsStatus() {
  const res = run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    `(Get-ScheduledTask -TaskName "${TASK_NAME}" -ErrorAction SilentlyContinue) -ne $null`,
  ]);
  return !res.error && res.status === 0 && res.stdout.trim() === 'True';
}

// ---------- macOS (launchd) ----------

function launchdPlistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`);
}

function macEnable() {
  const node = process.execPath;
  const script = binScriptPath();
  const logDir = path.join(paths.installDir(), 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LAUNCHD_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${script}</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${path.join(logDir, 'autostart.log')}</string>
  <key>StandardErrorPath</key><string>${path.join(logDir, 'autostart.log')}</string>
</dict>
</plist>
`;
  const plistPath = launchdPlistPath();
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, plist, 'utf8');
  run('launchctl', ['unload', plistPath]); // ignore failure if not already loaded
  const res = run('launchctl', ['load', '-w', plistPath]);
  if (res.error || res.status !== 0) {
    throw new Error(`Could not load the launchd agent: ${res.stderr || res.error?.message || 'unknown error'}`);
  }
}

function macDisable() {
  const plistPath = launchdPlistPath();
  if (fs.existsSync(plistPath)) {
    run('launchctl', ['unload', plistPath]);
    fs.rmSync(plistPath, { force: true });
  }
}

function macStatus() {
  return fs.existsSync(launchdPlistPath());
}

// ---------- Linux (systemd --user) ----------

function systemdUnitPath() {
  return path.join(os.homedir(), '.config', 'systemd', 'user', SYSTEMD_UNIT);
}

function linuxEnable() {
  const node = process.execPath;
  const script = binScriptPath();
  const unit = `[Unit]
Description=Claude Token Telemetry (backend + daemon + dashboard)

[Service]
Type=simple
ExecStart="${node}" "${script}" start
ExecStop="${node}" "${script}" stop
Restart=on-failure

[Install]
WantedBy=default.target
`;
  const unitPath = systemdUnitPath();
  fs.mkdirSync(path.dirname(unitPath), { recursive: true });
  fs.writeFileSync(unitPath, unit, 'utf8');
  run('systemctl', ['--user', 'daemon-reload']);
  const res = run('systemctl', ['--user', 'enable', '--now', SYSTEMD_UNIT]);
  if (res.error || res.status !== 0) {
    throw new Error(
      `Could not enable the systemd user service: ${res.stderr || res.error?.message || 'unknown error'}.\n` +
        `Some minimal/headless Linux setups don't run a user systemd instance -- see the README for the ` +
        `manual unit file as a fallback.`
    );
  }
}

function linuxDisable() {
  run('systemctl', ['--user', 'disable', '--now', SYSTEMD_UNIT]);
  const unitPath = systemdUnitPath();
  if (fs.existsSync(unitPath)) fs.rmSync(unitPath, { force: true });
  run('systemctl', ['--user', 'daemon-reload']);
}

function linuxStatus() {
  const res = run('systemctl', ['--user', 'is-enabled', SYSTEMD_UNIT]);
  return !res.error && res.stdout.trim() === 'enabled';
}

// ---------- Dispatch ----------

function enable() {
  if (process.platform === 'win32') return windowsEnable();
  if (process.platform === 'darwin') return macEnable();
  if (process.platform === 'linux') return linuxEnable();
  throw new Error(`Autostart isn't supported on platform "${process.platform}".`);
}

function disable() {
  if (process.platform === 'win32') return windowsDisable();
  if (process.platform === 'darwin') return macDisable();
  if (process.platform === 'linux') return linuxDisable();
}

function isEnabled() {
  if (process.platform === 'win32') return windowsStatus();
  if (process.platform === 'darwin') return macStatus();
  if (process.platform === 'linux') return linuxStatus();
  return false;
}

module.exports = { enable, disable, isEnabled };
