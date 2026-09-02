#!/usr/bin/env node
const { install, uninstall } = require('../src/install');
const { start, stop, status } = require('../src/run');

const HELP = `tokentelemetry — install and run the Claude Telemetry Enterprise console

Usage:
  tokentelemetry                 Install (if needed) and start everything
  tokentelemetry install         Copy app files, set up Python env, wire Claude Code hooks
  tokentelemetry start           Start the backend, telemetry daemon, and dashboard
  tokentelemetry stop            Stop everything started by "start"
  tokentelemetry status          Show install location, running processes, health checks
  tokentelemetry uninstall       Remove the Claude Code hooks (add --purge to also delete app files)

Environment:
  TOKENTELEMETRY_HOME   Install directory (default: ~/.tokentelemetry)
  CLAUDE_CONFIG_DIR     Claude Code config directory (default: ~/.claude)
`;

async function main() {
  const [, , cmdArg, ...rest] = process.argv;
  const cmd = cmdArg || 'default';

  switch (cmd) {
    case 'install':
      install();
      break;
    case 'start':
      start();
      break;
    case 'stop':
      stop();
      break;
    case 'status':
      await status();
      break;
    case 'uninstall':
      uninstall({ purge: rest.includes('--purge') });
      break;
    case 'default':
      install();
      start();
      break;
    case '-h':
    case '--help':
    case 'help':
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
});
