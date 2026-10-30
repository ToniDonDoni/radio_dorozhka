import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
let sha = 'local', count = '0';
try { sha = git(['rev-parse', 'HEAD']); count = git(['rev-list', '--count', 'HEAD']); }
catch { if (process.env.GITHUB_ACTIONS) throw new Error('The deployment must have a Git commit.'); }
if (process.env.GITHUB_SHA && sha !== process.env.GITHUB_SHA) throw new Error('Checkout does not match the selected workflow commit.');
let page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const synth = fs.readFileSync(path.join(root, 'music.js'), 'utf8');
if (/<\/script/i.test(synth)) throw new Error('The synthesizer cannot contain a closing script tag.');
if ((page.match(/<script src="music\.js"><\/script>/g) || []).length !== 1) throw new Error('Expected one synthesizer include.');
page = page.replace('<script src="music.js"></script>', () => `<script>\n${synth}\n</script>`)
  .replaceAll('__COMMIT_SHA__', sha).replaceAll('__BUILD_ID__', `#${count} · ${sha.slice(0, 8)}`);
const out = path.join(root, 'dist');
fs.mkdirSync(out, {recursive: true});
fs.writeFileSync(path.join(out, 'index.html'), page);
console.log(`Built one self-contained HTML page: #${count} · ${sha.slice(0, 8)}.`);
