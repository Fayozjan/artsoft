// Камера Telegram Mini Apps (API 6.4+) читает QR-коды. Вне Telegram — null.
export const getTelegramScanner = () => {
  const app = window.Telegram?.WebApp;
  return app?.initData && typeof app.showScanQrPopup === "function" && (app.isVersionAtLeast?.("6.4") ?? true)
    ? app
    : null;
};

// Телефон/планшет без аппаратного сканера: автофокус поля только поднимает экранную
// клавиатуру, поэтому фокус ставим лишь на устройствах с мышью.
export const isTouchDevice = () => Boolean(window.matchMedia?.("(pointer: coarse)").matches);

// Своя камера (getUserMedia + декодер, читает и DataMatrix): на телефоне/планшете и внутри
// Telegram (в т.ч. десктопном с веб-камерой). На ПК с аппаратным сканером не нужна.
export const canUseCamera = () =>
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  (isTouchDevice() || Boolean(window.Telegram?.WebApp?.initData));
