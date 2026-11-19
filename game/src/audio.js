// Every sound is synthesised with WebAudio: no audio files, no network.
// The context starts on the first user gesture (browsers block autoplay),
// and every effect is a short envelope over an oscillator or filtered noise.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // A minor-key bassline that walks under the game, one note per beat.
  const BASSLINE = [55, 0, 55, 65.4, 55, 0, 49, 58.3, 55, 0, 55, 65.4, 82.4, 73.4, 65.4, 58.3];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol || 0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    // Call from a user gesture (Enter, click): unlocks the context.
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    get ready() {
      return ctx !== null;
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },

    // A continuous engine hum whose pitch follows speed 0..1.
    engine(speed01, on) {
      if (!ensure() || muted) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      const target = on ? 0.05 + speed01 * 0.06 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
    },

    // The police two-tone wail, on while any wanted stars are up.
    siren(on) {
      if (!ensure() || muted) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.035;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.7;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 750;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        lfo.start();
        sirenOsc._lfo = lfo;
      } else if (!on && sirenOsc) {
        try {
          sirenOsc.stop();
          sirenOsc._lfo.stop();
        } catch {
          // Already stopped.
        }
        sirenOsc = null;
      }
    },

    shot() {
      noise(0.12, 0.5, 2800);
      tone(180, 0.08, 'square', 0.15, 60);
    },
    punch() {
      noise(0.09, 0.35, 500);
      tone(90, 0.1, 'sine', 0.3, 45);
    },
    hit() {
      tone(220, 0.08, 'square', 0.12, 140);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.2);
      setTimeout(() => tone(990, 0.18, 'sine', 0.2), 90);
    },
    cash() {
      tone(880, 0.1, 'triangle', 0.22);
      setTimeout(() => tone(1174, 0.16, 'triangle', 0.22), 80);
    },
    fail() {
      tone(220, 0.35, 'sawtooth', 0.2, 110);
    },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110));
    },
    door() {
      noise(0.15, 0.2, 900);
    },

    // Start the bassline loop; one note every 0.42 s.
    musicStart() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted) return;
        const f = BASSLINE[musicStep % BASSLINE.length];
        musicStep += 1;
        if (f > 0) tone(f, 0.4, 'triangle', 0.11);
        if (musicStep % 8 === 0) tone(220, 0.5, 'sine', 0.05);
      }, 420);
    },
    musicStop() {
      if (musicTimer) {
        clearInterval(musicTimer);
        musicTimer = null;
      }
    },
  };
}
