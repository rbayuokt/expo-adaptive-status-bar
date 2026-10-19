const { spawnSync } = require('child_process')

// On Windows `tsc` and `jest` are `.cmd` batch files, which only spawn with shell: true.
function spawnSyncWithAutoShell(command, args, options) {
  return spawnSync(command, args, { ...options, shell: process.platform === 'win32' })
}

module.exports = { spawnSyncWithAutoShell }
