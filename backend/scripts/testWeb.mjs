// test:web — validate the served web dashboard builds (HTML present + JS parses).
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = join(root, 'web', 'index.html');

try {
  const html = readFileSync(file, 'utf8');
  const checks = [
    ['has <html>', /<html/i.test(html)],
    ['has API client', /async function api\(/.test(html)],
    ['calls /dashboard', /\/dashboard/.test(html)],
    ['calls /sources/status', /\/sources\/status/.test(html)],
    ['calls /raw-statements', /\/raw-statements/.test(html)],
    ['calls /alerts', /\/alerts/.test(html)],
    ['calls /settings/status', /\/settings\/status/.test(html)],
    ['has retry POST', /\/sources\/'\+id\+'\/retry|sources\/.*\/retry/.test(html)],
  ];
  // JS syntax check
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  if (!m) throw new Error('no <script> block found');
  const tmp = join(root, '.web_check.tmp.js');
  writeFileSync(tmp, m[1]);
  execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
  unlinkSync(tmp);

  console.log('WEB BUILD TEST');
  console.log('='.repeat(40));
  let ok = true;
  for (const [label, pass] of checks) { console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}`); if (!pass) ok = false; }
  console.log(`  PASS  JS syntax valid`);
  console.log(`  PASS  web/index.html ${(html.length / 1024).toFixed(1)} KB`);
  console.log('='.repeat(40));
  console.log(ok ? 'WEB BUILD: PASS' : 'WEB BUILD: FAIL');
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.error('WEB BUILD: FAIL —', e.message);
  process.exit(1);
}
