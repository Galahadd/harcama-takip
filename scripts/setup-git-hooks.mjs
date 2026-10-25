import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
try {
  await exec('git', ['rev-parse', '--git-dir']);
} catch {
  process.exit(0); // Production installs may not include .git.
}
let hooksPath = '';
try {
  hooksPath = (await exec('git', ['config', '--get', 'core.hooksPath'])).stdout.trim();
} catch { /* Git returns 1 for an unset setting. */ }
if (hooksPath && hooksPath !== '.githooks') {
  throw new Error(`Existing core.hooksPath (${hooksPath}); integrate the version hook before committing.`);
}
await exec('git', ['config', 'core.hooksPath', '.githooks']);
