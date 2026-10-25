import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
import { writeFileSync } from 'node:fs';

const git = async (...args) => (await exec('git', args)).stdout.trim();
const root = await git('rev-parse', '--show-toplevel');
const path = 'src/lib/app-version.json';
let previous;
try {
  previous = JSON.parse(await git('show', `HEAD:${path}`)).version;
} catch {
  // The first versioned commit starts at 1.1.
  previous = '1.0';
}
if (!/^\d+\.\d$/.test(previous)) throw new Error(`Invalid app version: ${previous}`);
const [major, minor] = previous.split('.').map(Number);
const version = minor === 9 ? `${major + 1}.0` : `${major}.${minor + 1}`;
writeFileSync(`${root}/${path}`, `${JSON.stringify({ version }, null, 2)}\n`);
await git('add', '--', path);
console.log(`App version: ${version}`);
