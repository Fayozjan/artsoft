// Короткие сигналы считывания (WebAudio — без аудиофайлов): «пик-пик» вверх — код принят,
// низкий двойной — код не подошёл. Браузер запускает звук только после действия
// пользователя, поэтому primeScanSound() зовём по нажатию на кнопку камеры,
// а playScanSound() — уже когда код считан.

let audioContext = null;

const getContext = () => {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioContext = new AudioContextClass();
  }
  return audioContext;
};

export const primeScanSound = () => {
  const context = getContext();
  if (context?.state === "suspended") context.resume().catch(() => {});
};

const TONES = {
  success: [
    [1046, 0, 0.09],
    [1568, 0.1, 0.14],
  ],
  error: [
    [240, 0, 0.16],
    [180, 0.19, 0.22],
  ],
};

export const playScanSound = (kind = "success") => {
  try {
    const context = getContext();
    if (!context) return;
    if (context.state === "suspended") context.resume().catch(() => {});

    const now = context.currentTime;
    (TONES[kind] || TONES.success).forEach(([frequency, offset, duration]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "error" ? "triangle" : "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + 0.03);
    });
  } catch {
    // Звук — необязательная подсказка: без него считывание работает так же.
  }
};
