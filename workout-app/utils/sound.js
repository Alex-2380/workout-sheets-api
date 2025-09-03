// utils/sound.js
let ctx; // persistent audio context

export function ensureAudioContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended
  if (ctx.state === "suspended") {
    ctx.resume();
  }
  return ctx;
}

export function playBeep(frequency = 440, duration = 300, volume = 0.3) {
  try {
    const ctx = ensureAudioContext();

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.value = volume;

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (err) {
    console.warn("Beep failed:", err);
  }
}
