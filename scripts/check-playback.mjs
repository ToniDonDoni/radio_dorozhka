import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {compose} = require('../music.js');
const page = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const controller = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];

function boot(autoplayAllowed) {
  const events = {}, elements = {};
  let gesture = false, engine;
  for (const id of ['new-track','status','track-info','track-name','track-bpm','scene']) {
    elements[id] = {dataset: {}, hidden: id === 'track-info', textContent: '',
      events: {}, addEventListener(type, fn) { this.events[type] = fn; }, removeAttribute() {}};
  }
  const context = {state: autoplayAllowed ? 'running' : 'suspended',
    addEventListener() {},
    resume() { if (autoplayAllowed || gesture) this.state = 'running'; return Promise.resolve(); },
    createAnalyser() { return {fftSize: 512}; }};
  // The engine is an external dependency here. Simulate its public playback contract
  // while running the actual page controller against permitted and denied autoplay.
  class Music {
    constructor(onState) { engine = this; this.onState = onState; this.generations = 0; this.context = context; }
    ensureContext() { return context; }
    newTrack() { this.song = compose(++this.generations); this.start(); }
    start() {
      context.resume();
      if (context.state === 'running') this.session = {master: {connect() {}}};
      this.onState({song: this.song, playing: !!this.session, error: ''});
    }
    stop() { this.session = null; }
  }
  vm.runInNewContext(controller, {
    document: {getElementById: id => elements[id], hidden: false, body: {dataset: {}},
      addEventListener: (type, fn) => { events[type] = fn; }},
    window: {createVisual: () => ({resize() {}, draw() {}})},
    NoirMusic: Music, matchMedia: () => ({matches: false, addEventListener() {}}),
    innerWidth: 960, innerHeight: 640, devicePixelRatio: 1,
    addEventListener() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout: () => 1, clearTimeout() {}
  });
  return {elements, events, get engine() { return engine; },
    gesture() { gesture = true; }};
}
const automatic = boot(true);
assert.equal(automatic.engine.generations, 1);
assert.equal(automatic.elements['new-track'].dataset.audioState, 'running');
assert.equal(automatic.elements['track-info'].hidden, false);

const blocked = boot(false);
assert.equal(blocked.engine.generations, 1, 'A composition must be prepared on load.');
assert.equal(blocked.elements['new-track'].dataset.audioState, 'suspended');
assert.equal(blocked.elements['track-info'].hidden, true);
const preparedSeed = blocked.engine.song.seed;
blocked.gesture();
blocked.events.click({type: 'click', target: {closest: () => null}});
assert.equal(blocked.engine.song.seed, preparedSeed, 'Clicking the page must resume the prepared composition.');
assert.equal(blocked.engine.generations, 1);
assert.equal(blocked.elements['new-track'].dataset.audioState, 'running');
assert.equal(blocked.elements['track-info'].hidden, false);
await blocked.elements['new-track'].events.click();
blocked.events.click({type: 'click', target: {closest: () => blocked.elements['new-track']}});
assert.equal(blocked.engine.generations, 2, 'The button must generate exactly one new composition.');
assert.notEqual(blocked.engine.song.seed, preparedSeed);
assert.equal(blocked.elements['track-name'].textContent, blocked.engine.song.profile.name);
assert.equal(blocked.elements['track-bpm'].textContent, `${blocked.engine.song.bpm} BPM`);
console.log('PASS: permitted autoplay, denied autoplay, click-anywhere resume and single-composition button behavior.');
