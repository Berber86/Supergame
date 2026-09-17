/**
 * Единая точка входа проверок: типы, сборка и все check-* по порядку.
 * Любая ступень упала — прогон красный, код выхода ненулевой.
 *
 *   npm test
 */

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const STEPS: { name: string; cmd: string[] }[] = [{ name: 'tsc --noEmit', cmd: ['tsc', '--noEmit'] }];

for (const f of readdirSync('tools').sort()) {
  if (/^check-.*\.ts$/.test(f)) {
    STEPS.push({ name: f.replace('.ts', ''), cmd: ['tsx', `tools/${f}`] });
  }
}
STEPS.push({ name: 'vite build', cmd: ['vite', 'build'] });

let failed = 0;
const started = Date.now();
for (const s of STEPS) {
  const t0 = Date.now();
  const r = spawnSync('npx', ['--no-install', ...s.cmd], { stdio: 'pipe', encoding: 'utf8' });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (r.status === 0) {
    console.log(`  ок  ${s.name}  (${dt} с)`);
  } else {
    failed++;
    console.log(`ПАД  ${s.name}  (${dt} с)`);
    const out = (r.stdout + '\n' + r.stderr).trim().split('\n');
    for (const line of out.slice(-12)) console.log(`     ${line}`);
  }
}
const total = ((Date.now() - started) / 1000).toFixed(1);
if (failed) {
  console.log(`\n${failed} ступеней упало за ${total} с`);
  process.exit(1);
}
console.log(`\nвсе ${STEPS.length} ступеней зелёные за ${total} с`);
