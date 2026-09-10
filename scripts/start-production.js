const { spawn } = require('child_process');
const path = require('path');

async function main() {
  const migration = spawn(process.execPath, [path.join(__dirname, 'migrate.js')], { stdio: 'inherit', env: process.env });
  const exitCode = await new Promise((resolve) => migration.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0))));
  if (exitCode !== 0) process.exit(exitCode);
  require('../server');
}
main().catch((error) => { console.error(error); process.exit(1); });
