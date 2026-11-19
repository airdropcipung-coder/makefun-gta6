// Sound, all synthesised with WebAudio — no audio files, no network. The context
// starts on the first user gesture (browsers block audio before one), and everything
// is an oscillator or a short noise burst, so the game stays silent until the player
// actually plays.
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

  // A minor-key sunset groove: bass line + hats, scheduled a bar at a time.
  const BASS = [55, 0, 55, 65.4, 49, 0, 58.3, 65.4, 55, 0, 55, 65.4, 73.4, 65.4, 58.3, 49];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq = 1200) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 3000);
      tone(180, 0.08, 'square', 0.25, 0, 60);
    },
    punch() {
      noise(0.08, 0.4, 500);
      tone(90, 0.1, 'sine', 0.4, 0, 45);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.3);
      tone(880, 0.12, 'sine', 0.3, 0.08);
      tone(1320, 0.16, 'sine', 0.25, 0.16);
    },
    crash() {
      noise(0.3, 0.5, 800);
    },
    mission() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.3, i * 0.11));
    },
    wanted() {
      tone(220, 0.25, 'sawtooth', 0.25, 0, 440);
      tone(220, 0.25, 'sawtooth', 0.25, 0.28, 440);
    },
    busted() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, i * 0.18));
    },
    engine(on, speed01 = 0) {
      if (!ensure()) return;
      if (on && !engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.05;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      if (engineOsc) {
        // Only drive the pitch while the engine is on: engine(false) is called
        // with no speed, and feeding that undefined through would set the
        // oscillator to NaN and throw on every frame after.
        if (on) {
          engineOsc.frequency.value = 55 + speed01 * 130;
          engineGain.gain.value = 0.04 + speed01 * 0.05;
        } else {
          engineGain.gain.value = 0;
        }
      }
      if (!on && engineOsc) {
        try {
          engineOsc.stop();
        } catch {
          /* already stopped */
        }
        engineOsc = null;
        engineGain = null;
      }
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'sine';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.05;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        let high = true;
        sirenOsc._timer = window.setInterval(() => {
          if (sirenOsc) sirenOsc.frequency.value = high ? 950 : 700;
          high = !high;
        }, 420);
      }
      if (!on && sirenOsc) {
        window.clearInterval(sirenOsc._timer);
        try {
          sirenOsc.stop();
        } catch {
          /* already stopped */
        }
        sirenOsc = null;
        sirenGain = null;
      }
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = window.setInterval(() => {
        if (muted) return;
        const note = BASS[musicStep % BASS.length];
        if (note) tone(note, 0.22, 'triangle', 0.16);
        if (musicStep % 2 === 0) noise(0.03, 0.06, 8000);
        musicStep += 1;
      }, 210);
    },
    stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
  };
}
