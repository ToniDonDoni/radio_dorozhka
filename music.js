/* NOIR / DUST: original procedural minimal / microhouse synthesizer.
 * No recordings, downloads or dependencies. See README.md. */
(() => {
  'use strict';
  const TAU = Math.PI * 2;
  const choose = (rng, values) => values[Math.floor(rng() * values.length)];
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function freshSeed() {
    const values = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(values);
      return values[0];
    }
    return Math.floor(Math.random() * 4294967296);
  }
  // Evenly distribute pulses, then rotate the sequence to change its syncopation.
  function euclid(pulses, steps, rotation = 0) {
    return Array.from({length: steps}, (_, step) =>
      (((step + rotation) % steps) * pulses) % steps < pulses);
  }
  const BASS = [
    [0, 3, 6, 10, 14], [0, 6, 7, 10, 15], [2, 6, 8, 11, 14],
    [0, 5, 10, 13], [0, 3, 8, 10, 14], [2, 7, 10, 15],
    [0, 6, 10, 11, 14], [0, 2, 7, 10, 15]
  ];
  const CHORDS = [[0, 3, 7, 10], [0, 3, 7, 14], [0, 5, 10, 14], [0, 3, 10, 17]];
  const PROFILES = [
    {name: 'DUB ROOM', cutoff: 1050, decay: .18, wet: .28, click: .8},
    {name: 'SOFT MACHINE', cutoff: 1750, decay: .12, wet: .17, click: 1},
    {name: 'AFTER HOURS', cutoff: 850, decay: .28, wet: .33, click: .65},
    {name: 'TINY MOTIONS', cutoff: 2200, decay: .095, wet: .13, click: 1.1},
    {name: 'VELVET LOOP', cutoff: 1350, decay: .21, wet: .22, click: .85}
  ];
  function compose(seed) {
    const rng = random(seed);
    const profile = {...choose(rng, PROFILES)};
    const bass = [...choose(rng, BASS)];
    const rotation = choose(rng, [0, 0, 1, 2]);
    const bassSteps = bass.map(step => (step + rotation) % 16);
    return {
      seed: seed >>> 0, id: (seed >>> 0).toString(36).toUpperCase().padStart(7, '0'),
      bpm: 119 + Math.floor(rng() * 8), swing: .09 + rng() * .14,
      root: choose(rng, [29, 31, 33, 34, 36]), profile,
      bassSteps, bassNotes: bass.map(() => choose(rng, [0, 0, 0, 3, 5, 7, 10, 12])),
      bassDecay: .095 + rng() * .10,
      hats: euclid(choose(rng, [5, 7, 9, 11]), 16, Math.floor(rng() * 16)),
      percussion: euclid(choose(rng, [3, 4, 5, 7]), choose(rng, [12, 16, 16]), Math.floor(rng() * 12)),
      chordSteps: choose(rng, [[2, 10], [3, 11, 14], [6, 14], [3, 10, 15], [2, 7, 14]]),
      voicing: [...choose(rng, CHORDS)], progression: choose(rng, [[0, 0, 5, 0], [0, 0, -2, 5], [0, 5, 0, -2]]),
      rimStep: choose(rng, [4, 4, 12]), hatTone: 5400 + rng() * 3400,
      percussionTone: 260 + rng() * 540, melodyCycle: choose(rng, [5, 7, 9]),
      melodyNotes: Array.from({length: 9}, () => choose(rng, [0, 3, 5, 7, 10, 14])),
      variationEvery: choose(rng, [4, 8])
    };
  }
  const hz = note => 440 * Math.pow(2, (note - 69) / 12);

  class NoirMusic {
    constructor(onState = () => {}) {
      this.onState = onState;
      this.context = null;
      this.session = null;
      this.song = null;
      this.hidden = false;
      this.epoch = 0;
      this.error = '';
    }
    notify() {
      this.onState({song: this.song, playing: !!this.session && !this.hidden, error: this.error});
    }
    ensureContext() {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) throw new Error('This browser does not support audio.');
        this.context = new Audio({latencyHint: 'interactive'});
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const data = this.noise.getChannelData(0), rng = random(freshSeed());
        for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
      }
      return this.context;
    }
    newTrack() {
      this.song = compose(freshSeed());
      this.error = '';
      this.start();
      this.notify();
    }
    async start() {
      const epoch = ++this.epoch;
      this.retire();
      if (!this.song || this.hidden) { this.notify(); return; }
      try {
        // Called directly from the user's tap so mobile browsers can unlock audio.
        const audio = this.ensureContext();
        await audio.resume();
        if (epoch !== this.epoch || this.hidden || !this.song) return;
        if (audio.state !== 'running') throw new Error('Press New Dorozhka to enable audio.');
        const session = this.makeSession(this.song);
        this.session = session;
        session.next = audio.currentTime + .065;
        this.schedule(session);
        session.timer = setInterval(() => this.schedule(session), 25);
        this.error = '';
      } catch (error) {
        if (epoch !== this.epoch) return;
        this.error = error.message || 'Press New Dorozhka to enable audio.';
      }
      this.notify();
    }
    makeSession(song) {
      const a = this.context;
      const nodes = [];
      const node = n => { nodes.push(n); return n; };
      const mix = node(a.createGain()), tonal = node(a.createGain()), master = node(a.createGain());
      const compressor = node(a.createDynamicsCompressor());
      compressor.threshold.value = -12; compressor.knee.value = 8;
      compressor.ratio.value = 8; compressor.attack.value = .003; compressor.release.value = .13;
      const highpass = node(a.createBiquadFilter());
      highpass.type = 'highpass'; highpass.frequency.value = 27; highpass.Q.value = .5;
      tonal.connect(mix); mix.connect(highpass); highpass.connect(compressor); compressor.connect(master);
      master.gain.setValueAtTime(0, a.currentTime);
      master.gain.linearRampToValueAtTime(this.level(), a.currentTime + .08);
      master.connect(a.destination);
      const delay = node(a.createDelay(2)), feedback = node(a.createGain());
      const lowpass = node(a.createBiquadFilter()), wet = node(a.createGain()), send = node(a.createGain());
      delay.delayTime.value = (60 / song.bpm) * .75;
      feedback.gain.value = .29; lowpass.frequency.value = 2100;
      wet.gain.value = song.profile.wet; send.gain.value = .7;
      send.connect(delay); delay.connect(lowpass); lowpass.connect(feedback); feedback.connect(delay);
      lowpass.connect(wet); wet.connect(tonal);
      return {song, nodes, sources: new Set(), mix, tonal, master, send,
        rng: random(song.seed ^ 0xD1B54A35), step: 0, next: 0, timer: null, stopped: false};
    }
    level() { return .96 * Math.pow(.45, 1.4) * (4 / 3) * (4 / 3); }
    setHidden(value) {
      this.hidden = value;
      if (value) { this.epoch++; this.retire(); this.context?.suspend(); }
      else if (this.song) this.start();
      this.notify();
    }
    stop() { this.epoch++; this.retire(); this.song = null; this.context?.suspend(); this.notify(); }
    retire() {
      const s = this.session;
      if (!s) return;
      this.session = null; s.stopped = true; clearInterval(s.timer);
      const now = this.context.currentTime;
      s.master.gain.cancelScheduledValues(now);
      s.master.gain.setTargetAtTime(0, now, .012);
      for (const source of s.sources) { try { source.stop(now + .06); } catch (_) {} }
      setTimeout(() => { for (const node of s.nodes) node.disconnect(); }, 150);
    }
    track(s, source, end, nodes = []) {
      s.sources.add(source);
      source.onended = () => {
        s.sources.delete(source); source.disconnect();
        for (const node of nodes) node.disconnect();
      };
      source.stop(end);
    }
    envelope(gain, time, peak, decay, attack = .002) {
      gain.gain.setValueAtTime(.00001, time);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, peak), time + attack);
      gain.gain.exponentialRampToValueAtTime(.00001, time + decay);
    }
    tone(s, time, note, type, peak, decay, cutoff, pan = 0, echo = false) {
      const a = this.context, osc = a.createOscillator(), gain = a.createGain();
      const filter = a.createBiquadFilter(), stereo = a.createStereoPanner();
      osc.type = type; osc.frequency.value = hz(note);
      filter.type = 'lowpass'; filter.Q.value = .7;
      filter.frequency.setValueAtTime(cutoff, time);
      filter.frequency.exponentialRampToValueAtTime(Math.max(110, cutoff * .34), time + decay);
      stereo.pan.value = pan;
      this.envelope(gain, time, peak, decay, .004);
      osc.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(s.tonal);
      if (echo) stereo.connect(s.send);
      osc.start(time); this.track(s, osc, time + decay + .02, [filter, gain, stereo]);
    }
    kick(s, time, ghost = false) {
      const a = this.context, osc = a.createOscillator(), gain = a.createGain();
      osc.frequency.setValueAtTime(142, time);
      osc.frequency.exponentialRampToValueAtTime(49, time + .055);
      osc.frequency.exponentialRampToValueAtTime(43, time + .22);
      this.envelope(gain, time, ghost ? .24 : .69, ghost ? .14 : .29);
      osc.connect(gain); gain.connect(s.mix); osc.start(time);
      this.track(s, osc, time + .33, [gain]);
      // Duck the musical bus under each kick; drums retain a dry, steady pulse.
      s.tonal.gain.setValueAtTime(.33, time);
      s.tonal.gain.exponentialRampToValueAtTime(1, time + .16);
    }
    noiseHit(s, time, peak, decay, frequency, pan = 0, clap = false) {
      const a = this.context, source = a.createBufferSource(), gain = a.createGain();
      const filter = a.createBiquadFilter(), stereo = a.createStereoPanner();
      source.buffer = this.noise;
      filter.type = clap ? 'bandpass' : 'highpass'; filter.frequency.value = frequency; filter.Q.value = clap ? .8 : .6;
      stereo.pan.value = pan;
      this.envelope(gain, time, peak, decay);
      if (clap) {
        for (const offset of [.012, .026]) {
          gain.gain.setValueAtTime(.0001, time + offset);
          gain.gain.linearRampToValueAtTime(peak * .75, time + offset + .001);
        }
        gain.gain.exponentialRampToValueAtTime(.00001, time + decay);
      }
      source.connect(filter); filter.connect(gain); gain.connect(stereo); stereo.connect(s.mix);
      source.start(time, s.rng() * .6);
      this.track(s, source, time + decay + .02, [filter, gain, stereo]);
    }
    rim(s, time, peak, pan) {
      const a = this.context, osc = a.createOscillator(), gain = a.createGain();
      const mod = a.createOscillator(), depth = a.createGain(), stereo = a.createStereoPanner();
      osc.frequency.value = s.song.percussionTone; mod.frequency.value = s.song.percussionTone * 1.47;
      depth.gain.setValueAtTime(180, time); depth.gain.exponentialRampToValueAtTime(.1, time + .055);
      mod.connect(depth); depth.connect(osc.frequency); this.envelope(gain, time, peak, .075);
      stereo.pan.value = pan; osc.connect(gain); gain.connect(stereo); stereo.connect(s.tonal); stereo.connect(s.send);
      osc.start(time); mod.start(time);
      this.track(s, osc, time + .09, [gain, stereo]); this.track(s, mod, time + .09, [depth]);
    }
    schedule(s) {
      if (s !== this.session || s.stopped || this.context.state !== 'running') return;
      const a = this.context, song = s.song, stepTime = 60 / song.bpm / 4;
      // On a stalled main thread, skip missed beats instead of firing a burst.
      if (s.next < a.currentTime + .005) {
        const missed = Math.ceil((a.currentTime + .025 - s.next) / stepTime);
        s.step += Math.max(0, missed); s.next += Math.max(0, missed) * stepTime;
      }
      while (s.next < a.currentTime + .13) {
        this.playStep(s, s.step, s.next, stepTime);
        s.next += stepTime; s.step++;
      }
    }
    playStep(s, absolute, time, stepTime) {
      const p = s.song, rng = s.rng, step = absolute % 16, bar = Math.floor(absolute / 16);
      const phrase = Math.floor(bar / 8), chordShift = p.progression[Math.floor(bar / 4) % p.progression.length];
      const breakBar = bar % 32 === 23 || bar % 32 === 24;
      const variant = Math.floor(bar / p.variationEvery) % 4;
      const swing = step % 2 ? p.swing * stepTime : 0;
      const t = time + swing + (rng() - .5) * .003;
      const velocity = .8 + rng() * .2;
      if (step % 4 === 0 && (!breakBar || step === 0)) this.kick(s, time);
      if (bar % 8 === 7 && step === 15 && rng() < .38) this.kick(s, t, true);
      if (step === 4 || step === 12) {
        if (bar % 8 !== 0) this.noiseHit(s, t + .008, .11 * velocity, .105, 1750, -.07, true);
      }
      if ((step % 4 === 2 || p.hats[(step + (variant === 2 ? 2 : 0)) % 16]) && rng() > .08) {
        const open = step % 4 === 2 && rng() < .45;
        this.noiseHit(s, t, (open ? .045 : .035) * velocity, open ? .15 : .035,
          p.hatTone, (step % 2 ? -.22 : .2));
      }
      if (bar > 0 && p.percussion[absolute % p.percussion.length] && rng() > .27) {
        this.rim(s, t + .004, .075 * p.profile.click * velocity, rng() * 1.1 - .55);
      }
      const bassIndex = p.bassSteps.indexOf(step);
      if (bassIndex >= 0 && (!breakBar || step === p.bassSteps[0]) && (bassIndex === 0 || rng() > .1)) {
        const note = p.root + chordShift + p.bassNotes[(bassIndex + (variant === 3 ? 1 : 0)) % p.bassNotes.length];
        this.tone(s, t, note, 'triangle', .25 * velocity, p.bassDecay,
          480 + Math.sin(bar * .2) * 160, 0);
        this.tone(s, t, note - 12, 'sine', .13 * velocity, p.bassDecay + .04, 220, 0);
      }
      if (bar > 1 && p.chordSteps.includes(step) && rng() > (breakBar ? .6 : .2)) {
        const cutoff = p.profile.cutoff * (.75 + .25 * Math.sin(bar * .37 + phrase));
        for (let i = 0; i < p.voicing.length; i++) {
          this.tone(s, t + i * .0015, p.root + 24 + chordShift + p.voicing[i],
            'sawtooth', .024 * velocity, p.profile.decay, cutoff, (i - 1.5) * .13, true);
        }
      }
      if (bar > 3 && absolute % p.melodyCycle === 0 && rng() < .4) {
        this.tone(s, t, p.root + 36 + chordShift + p.melodyNotes[(Math.floor(absolute / p.melodyCycle) + phrase) % p.melodyNotes.length],
          'sine', .055 * velocity, .11 + rng() * .12, 3000, rng() * 1.2 - .6, true);
      }
    }
  }
  if (typeof window !== 'undefined') window.NoirMusic = NoirMusic;
  if (typeof module !== 'undefined' && module.exports) module.exports = {NoirMusic, compose, euclid, random};
})();
