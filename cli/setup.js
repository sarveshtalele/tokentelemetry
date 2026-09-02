#!/usr/bin/env node
// One-shot setup: detect the system, build + install the `tokentelemetry`
// command globally, run the app install (Python env + Claude Code hooks),
// then hand control to an interactive Start/Stop/Status/Uninstall menu.
//
// Usage (from a fresh git clone):
//   node cli/setup.js
'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawnSync } = require('child_process');

const CLI_DIR = __dirname;

function log(msg) {
  console.log(msg);
}
function section(title) {
  console.log(`\n== ${title} ==`);
}

function commandExists(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: 'ignore', shell: process.platform === 'win32' });
  return !res.error && res.status === 0;
}

function run(cmd, args, opts = {}) {
  log(`$ ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Command failed (exit ${res.status}): ${cmd} ${args.join(' ')}`);
}

function detectSystem() {
  section('Detecting system');
  const info = {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    npm: commandExists('npm', ['--version']),
    python: commandExists('python3', ['--version']) || commandExists('python', ['--version']),
    uv: commandExists('uv', ['--version']),
  };
  log(`Platform: ${info.platform} (${info.arch})`);
  log(`Node:     ${info.node}`);
  log(`npm:      ${info.npm ? 'found' : 'MISSING'}`);
  log(`Python:   ${info.python ? 'found' : 'MISSING (required)'}`);
  log(`uv:       ${info.uv ? 'found (will be used for the Python env)' : 'not found (will fall back to venv/pip)'}`);
  if (!info.npm) throw new Error('npm not found on PATH — install Node.js first.');
  if (!info.python) throw new Error('No Python 3 interpreter found on PATH — install Python 3.9+ (or uv) first.');
  return info;
}

function buildAndInstallGlobalCommand() {
  section('Building and installing the tokentelemetry command');
  const tmpTarball = path.join(os.tmpdir(), 'tokentelemetry-setup.tgz');
  run('npm', ['pack', '--pack-destination', os.tmpdir()], { cwd: CLI_DIR });
  const pkg = require(path.join(CLI_DIR, 'package.json'));
  const producedTarball = path.join(os.tmpdir(), `${pkg.name}-${pkg.version}.tgz`);
  fs.copyFileSync(producedTarball, tmpTarball);
  run('npm', ['install', '-g', tmpTarball]);
  log('Installed the global "tokentelemetry" command.');
}

function runLocalInstall() {
  section('Configuring the app (Python env + Claude Code hooks)');
  // Called in-process against this checkout's own src/, so it works
  // immediately regardless of whether the freshly-updated PATH is visible
  // yet in this shell.
  const { install } = require(path.join(CLI_DIR, 'src', 'install.js'));
  install();
}

function printMenu() {
  console.log('\nWhat would you like to do?');
  console.log('  1) Start the dashboard');
  console.log('  2) Stop the dashboard');
  console.log('  3) Show status');
  console.log('  4) Uninstall (remove Claude Code hooks)');
  console.log('  5) Exit');
  process.stdout.write('> ');
}

async function interactiveLoop() {
  const { start, stop, status } = require(path.join(CLI_DIR, 'src', 'run.js'));
  const { uninstall } = require(path.join(CLI_DIR, 'src', 'install.js'));
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  printMenu();
  for await (const line of rl) {
    const choice = line.trim();
    try {
      switch (choice) {
        case '1':
          start();
          break;
        case '2':
          stop();
          break;
        case '3':
          await status();
          break;
        case '4': {
          rl.pause();
          const purge = await new Promise((resolve) =>
            rl.question('Also delete the app files and database? [y/N] ', (a) => resolve(/^y/i.test(a.trim())))
          );
          rl.resume();
          uninstall({ purge });
          break;
        }
        case '5':
          rl.close();
          break;
        default:
          console.log(`Unrecognized choice: "${choice}"`);
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
    }
    if (choice === '5') break;
    printMenu();
  }
  console.log('Done. Run "node cli/setup.js" again anytime, or use the "tokentelemetry" command directly.');
}

async function main() {
  detectSystem();
  buildAndInstallGlobalCommand();
  runLocalInstall();
  await interactiveLoop();
}

main().catch((err) => {
  console.error(`\nSetup failed: ${err.message}`);
  process.exitCode = 1;
});
