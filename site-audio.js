// Small, locally synthesised sounds: no audio downloads and no background music.
const STORAGE_KEY = "survisland:sound:enabled";
const recentSounds = new Map();
const voices = new Set();
let context;
let output;
let enabled = true;
let interacted = false;
let unsupported = false;
let swarm;
let wingNoise;

try {
  enabled = localStorage.getItem(STORAGE_KEY) !== "false";
} catch {
  // Sound controls still work when browser storage is unavailable.
}

function updateToggles() {
  document.querySelectorAll(".sound-toggle").forEach((button) => {
    button.setAttribute("aria-pressed", String(enabled && !unsupported));
    button.setAttribute(
      "aria-label",
      unsupported
        ? "Effets sonores indisponibles dans ce navigateur"
        : enabled
          ? "Couper les effets sonores"
          : "Activer les effets sonores",
    );
    button.title = button.getAttribute("aria-label");
    button.querySelector(".sound-toggle-label").textContent = unsupported
      ? "Son indisponible"
      : enabled
        ? "Son actif"
        : "Son coupé";
    button.disabled = unsupported;
  });
}

function getContext() {
  if (!enabled || !interacted || unsupported || document.hidden) return null;
  if (!context) {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) {
      unsupported = true;
      updateToggles();
      return null;
    }
    try {
      context = new Audio();
      output = context.createGain();
      // Keep effects quiet even when several short notes overlap.
      output.gain.value = 0.14;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 12;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.12;
      output.connect(limiter);
      limiter.connect(context.destination);
    } catch {
      unsupported = true;
      updateToggles();
      return null;
    }
  }
  return context.state === "closed" ? null : context;
}

function resumeContext() {
  const audio = getContext();
  if (audio && audio.state !== "running") {
    // Only gestures request a resume; blocked autoplay never causes a rejection.
    try {
      void audio.resume().catch(() => {});
    } catch {
      // Some browsers refuse audio in an inactive document.
    }
  }
  return audio;
}

function onGesture(event) {
  if (!event.isTrusted) return;
  interacted = true;
  resumeContext();
}

function silence() {
  stopSwarm();
  for (const voice of [...voices]) voice.stop();
}

function setEnabled(value) {
  enabled = value;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Keep the preference in memory for this visit.
  }
  if (!enabled) silence();
  else resumeContext();
  updateToggles();
}

/** Also usable inside a modal: every toggle shares the same sound preference. */
export function createSoundToggle() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sound-toggle";
  button.dataset.sound = "none";
  button.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path class="sound-toggle-waves" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="sound-toggle-slash" d="m16 9 5 6m0-6-5 6"/></svg><span class="sound-toggle-label"></span>`;
  button.addEventListener("click", () => {
    setEnabled(!enabled);
    if (enabled) playSound("select");
  });
  // Initialise before insertion as well, for dialogs created during playback.
  button.setAttribute("aria-pressed", String(enabled && !unsupported));
  button.setAttribute(
    "aria-label",
    unsupported
      ? "Effets sonores indisponibles dans ce navigateur"
      : enabled
        ? "Couper les effets sonores"
        : "Activer les effets sonores",
  );
  button.title = button.getAttribute("aria-label");
  button.querySelector(".sound-toggle-label").textContent = unsupported
    ? "Son indisponible"
    : enabled
      ? "Son actif"
      : "Son coupé";
  button.disabled = unsupported;
  return button;
}

function tone(
  audio,
  frequency,
  at,
  duration,
  amplitude,
  type = "sine",
  endFrequency,
) {
  if (voices.size >= 24) return;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + at;
  const end = start + duration;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, end);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(
    amplitude,
    start + Math.min(0.015, duration / 4),
  );
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(output);
  const voice = {
    stop() {
      try {
        const now = audio.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(0, now);
        oscillator.stop();
      } catch {
        // A note may have already ended between interaction events.
      }
      oscillator.disconnect();
      gain.disconnect();
      voices.delete(voice);
    },
  };
  voices.add(voice);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    voices.delete(voice);
  };
  oscillator.start(start);
  oscillator.stop(end + 0.025);
}

// Rounded harmonics and fast amplitude flutter evoke wings rather than a buzzer.
function beeVoice(
  audio,
  {
    frequency = 190,
    endFrequency = frequency,
    duration = 0.25,
    at = 0,
    amplitude = 0.22,
    flutter = 38,
  } = {},
) {
  if (voices.size >= 24) return () => {};
  const start = audio.currentTime + at,
    end = start + duration;
  const carrier = audio.createOscillator();
  const wings = audio.createOscillator();
  const modulation = audio.createGain();
  const filter = audio.createBiquadFilter();
  const envelope = audio.createGain();
  carrier.setPeriodicWave(
    audio.createPeriodicWave(
      new Float32Array(6),
      new Float32Array([0, 1, 0.36, 0.15, 0.06, 0.025]),
    ),
  );
  carrier.frequency.setValueAtTime(frequency, start);
  carrier.frequency.exponentialRampToValueAtTime(endFrequency, end);
  wings.frequency.value = flutter;
  modulation.gain.setValueAtTime(0, start);
  modulation.gain.linearRampToValueAtTime(
    amplitude * 0.17,
    start + Math.min(0.06, duration * 0.25),
  );
  modulation.gain.setValueAtTime(
    amplitude * 0.17,
    end - Math.min(0.14, duration * 0.4),
  );
  modulation.gain.linearRampToValueAtTime(0, end);
  wings.connect(modulation);
  modulation.connect(envelope.gain);
  filter.type = "lowpass";
  filter.frequency.value = Math.min(1050, frequency * 4);
  filter.Q.value = 0.45;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(
    amplitude,
    start + Math.min(0.06, duration * 0.25),
  );
  envelope.gain.setValueAtTime(amplitude, end - Math.min(0.14, duration * 0.4));
  envelope.gain.linearRampToValueAtTime(0, end);
  carrier.connect(filter);
  filter.connect(envelope);
  envelope.connect(output);
  let stopped = false;
  const voice = {
    stop() {
      if (stopped) return;
      stopped = true;
      for (const oscillator of [carrier, wings]) {
        try {
          oscillator.stop();
        } catch {
          /* Already ended. */
        }
        oscillator.disconnect();
      }
      modulation.disconnect();
      filter.disconnect();
      envelope.disconnect();
      voices.delete(voice);
    },
  };
  voices.add(voice);
  carrier.onended = voice.stop;
  carrier.start(start);
  wings.start(start);
  carrier.stop(end + 0.02);
  wings.stop(end + 0.02);
  return voice.stop;
}

function wingSweep(audio, duration = 0.24, amplitude = 0.13, at = 0) {
  if (voices.size >= 24) return;
  if (!wingNoise) {
    wingNoise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const samples = wingNoise.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter(),
    envelope = audio.createGain();
  const start = audio.currentTime + at;
  source.buffer = wingNoise;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(650, start);
  filter.frequency.exponentialRampToValueAtTime(350, start + duration);
  filter.Q.value = 0.65;
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(amplitude, start + duration * 0.25);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(output);
  let stopped = false;
  const voice = {
    stop() {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
      voices.delete(voice);
    },
  };
  voices.add(voice);
  source.onended = voice.stop;
  source.start(start);
  source.stop(start + duration + 0.02);
}

/** Soft effects, played only after an interaction and while sound is enabled. */
export function playSound(name = "click", options = {}) {
  if (name === "none") return false;
  const audio = getContext();
  if (!audio) return false;
  if (audio.state !== "running") {
    const requestedAt = performance.now();
    try {
      void audio
        .resume()
        .then(() => {
          // A first click can arrive before the browser has unlocked audio.
          // Discard old effects instead of playing a backlog after a blocked resume.
          if (
            audio.state === "running" &&
            performance.now() - requestedAt < 500
          ) {
            playSound(name, options);
          }
        })
        .catch(() => {});
    } catch {
      return false;
    }
    return true;
  }
  const now = performance.now();
  // A control may be covered both by delegation and an explicit state callback.
  if (now - (recentSounds.get(name) ?? -Infinity) < 70) return false;
  recentSounds.set(name, now);
  const volume = Number.isFinite(options.volume)
    ? Math.max(0, Math.min(1, options.volume))
    : 1;
  const pitch = Number.isFinite(options.pitch)
    ? Math.max(0.5, Math.min(2, options.pitch))
    : 1;
  const note = (
    frequency,
    at = 0,
    duration = 0.16,
    amplitude = 0.35,
    type = "sine",
    endFrequency,
  ) =>
    tone(
      audio,
      frequency * pitch,
      at,
      duration,
      amplitude * volume,
      type,
      endFrequency ? endFrequency * pitch : undefined,
    );
  const bee = (
    frequency,
    duration,
    amplitude = 0.22,
    endFrequency = frequency,
    at = 0,
  ) =>
    beeVoice(audio, {
      frequency: frequency * pitch,
      endFrequency: endFrequency * pitch,
      duration,
      amplitude: amplitude * volume,
      at,
      flutter: 34 + Math.random() * 9,
    });
  const wings = (duration = 0.24, amplitude = 0.1, at = 0) =>
    wingSweep(audio, duration, amplitude * volume, at);
  switch (name) {
    case "navigation":
      bee(180, 0.28, 0.19, 235);
      wings(0.25, 0.1);
      break;
    case "open":
      bee(165, 0.42, 0.2, 230);
      wings(0.4, 0.14);
      note(330, 0.12, 0.22, 0.09);
      break;
    case "close":
      bee(220, 0.27, 0.16, 155);
      wings(0.2, 0.09);
      break;
    case "select":
      bee(215, 0.17, 0.16, 245);
      note(390, 0.025, 0.16, 0.1, "sine", 310);
      break;
    case "success":
      bee(185, 0.45, 0.16, 220);
      note(294, 0.04, 0.35, 0.14);
      note(370, 0.13, 0.4, 0.1);
      note(440, 0.22, 0.4, 0.08);
      break;
    case "error":
      bee(170, 0.2, 0.15, 145);
      bee(155, 0.25, 0.13, 135, 0.18);
      break;
    case "upload":
      wings(0.42, 0.15);
      bee(180, 0.33, 0.18, 250);
      note(370, 0.18, 0.24, 0.1);
      break;
    case "reveal":
      bee(195 + Math.random() * 22, 0.26, 0.16, 255);
      wings(0.24, 0.11);
      note(350, 0.06, 0.2, 0.09, "sine", 285);
      break;
    case "swapStart":
      wings(0.7, 0.18);
      bee(145, 0.85, 0.24, 240);
      bee(175, 0.65, 0.1, 265, 0.12);
      break;
    case "swapEnd":
      bee(220, 0.8, 0.15, 165);
      wings(0.55, 0.11);
      note(262, 0.05, 0.6, 0.12);
      note(330, 0.13, 0.6, 0.09);
      note(392, 0.23, 0.65, 0.07);
      break;
    case "drop":
      wings(0.4, 0.13);
      bee(200, 0.4, 0.16, 110);
      break;
    default:
      bee(205, 0.12, 0.14, 175);
      note(320, 0, 0.1, 0.08, "sine", 240);
  }
  return true;
}

/** A quiet flutter during the swap. Stops after 45 s even if the caller fails. */
export function startSwarm() {
  stopSwarm();
  const audio = getContext();
  if (!audio || audio.state !== "running") return () => {};
  // Two nearby wing pitches create a soft, living hive instead of a held note.
  const stops = [
    beeVoice(audio, {
      frequency: 176,
      endFrequency: 183,
      duration: 45,
      amplitude: 0.055,
      flutter: 36,
    }),
    beeVoice(audio, {
      frequency: 209,
      endFrequency: 202,
      duration: 45,
      amplitude: 0.035,
      flutter: 43,
    }),
  ];
  let stopped = false;
  let timer;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    stops.forEach((stopVoice) => stopVoice());
    if (swarm === stop) swarm = null;
  };
  swarm = stop;
  timer = setTimeout(stop, 45000);
  return stop;
}

export function stopSwarm() {
  swarm?.();
}

function onClick(event) {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  const control = event.target.closest(
    "button, a[href], summary, [role='button'], [data-sound]",
  );
  if (!control || control.matches(":disabled, [aria-disabled='true']")) return;
  const override = control.closest("[data-sound]")?.dataset.sound;
  if (override !== undefined) {
    playSound(override);
    return;
  }
  if (control.matches("summary")) {
    playSound(control.parentElement.open ? "close" : "open");
  } else if (control.matches(".dialog-close")) {
    // Dialog state handlers cover click, Escape and backdrop consistently.
    return;
  } else if (control.matches("[aria-haspopup='dialog'], .ranked-portrait")) {
    playSound("open");
  } else if (control.matches("a[href]")) {
    playSound("navigation");
  } else {
    playSound("click");
  }
}

function init() {
  if (!document.querySelector(".site-nav .sound-toggle")) {
    document.querySelector(".site-nav")?.append(createSoundToggle());
  }
  updateToggles();
}

document.addEventListener("pointerdown", onGesture, {
  capture: true,
  passive: true,
});
document.addEventListener("keydown", onGesture, { capture: true });
document.addEventListener("click", onGesture, { capture: true });
document.addEventListener("click", onClick);
document.addEventListener("change", (event) => {
  if (!event.isTrusted || !(event.target instanceof Element)) return;
  if (
    !event.target.matches(
      "select, input[type='checkbox'], input[type='radio'], input[type='range']",
    )
  )
    return;
  playSound(event.target.closest("[data-sound]")?.dataset.sound ?? "select");
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  silence();
  if (context?.state === "running") void context.suspend().catch(() => {});
});
window.addEventListener("pagehide", silence);
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  enabled = event.newValue !== "false";
  if (!enabled) silence();
  updateToggles();
});

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
