const { spawnSync } = require('child_process');
const path = require('path');

const node20 = path.resolve(__dirname, '..', 'tools', 'node20', 'node-v20.18.3-win-x64', 'node.exe');
const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: node scripts/run-node20.cjs <script> [...args]');
  process.exit(1);
}

const result = spawnSync(node20, args, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
