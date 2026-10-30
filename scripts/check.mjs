import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const {compose} = require('../music.js');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal((page.match(/<button\b/g) || []).length, 1, 'The page must have exactly one button.');
assert(page.includes('>New Dorozhka</button>'));
for (const [, script] of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script);
new vm.Script(fs.readFileSync(path.join(root, 'music.js'), 'utf8'));
assert.deepEqual(compose(1234), compose(1234));
assert.notDeepEqual(compose(1234), compose(5678));
for (let seed = 0; seed < 100; seed++) {
  const song = compose(seed);
  assert(song.bpm >= 119 && song.bpm <= 126);
  assert(song.bassSteps.length > 0 && song.voicing.length > 0);
}
const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
assert(workflow.includes('workflow_dispatch:'));
assert(!/^\s*(push|pull_request|schedule):/m.test(workflow), 'Publication must be manual.');
assert(workflow.includes('fetch-depth: 0'));
assert(workflow.includes('path: dist'));
for (const file of ['index.html', 'music.js', 'scripts/build.mjs', '.github/workflows/pages.yml']) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  assert(!/\/Users\/|\/home\/|DISCORD_BOT_TOKEN|api\.key\.env|gh[pousr]_[A-Za-z0-9]{20}/.test(text), `Private data in ${file}`);
}
console.log('PASS: source syntax, single-button interface, procedural compositions and manual-only publishing.');

await import('./check-playback.mjs');
