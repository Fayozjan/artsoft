import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import CameraScanner from "../components/tg/CameraScanner";
import { canUseCamera, getTelegramScanner } from "../utils/telegramScan";
import { primeScanSound } from "../utils/scanSound";

// Считывание кода камерой телефона: start(onResult) открывает камеру, onResult(text)
// вызывается один раз с текстом кода. Своя камера читает DataMatrix и QR; если она
// недоступна, а внутри Telegram есть его сканер — используется он (только QR).
// available — есть ли вообще чем сканировать; element — камеру нужно вывести в разметку.
export const useCameraScanner = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const callbackRef = useRef(null);

  const openTelegramScanner = useCallback(
    (onResult) => {
      const scanner = getTelegramScanner();
      if (!scanner) return;
      scanner.showScanQrPopup({ text: t("tgCameraScanHint") }, (text) => {
        const value = String(text || "").trim();
        if (!value) return false;
        onResult(value);
        return true; // закрыть окно камеры
      });
    },
    [t],
  );

  const start = useCallback(
    (onResult) => {
      callbackRef.current = onResult;
      // Нажатие на кнопку камеры — единственный момент, когда браузер разрешает включить звук.
      primeScanSound();
      if (canUseCamera()) setOpen(true);
      else openTelegramScanner(onResult);
    },
    [openTelegramScanner],
  );

  const element = (
    <CameraScanner
      isOpen={open}
      onClose={() => setOpen(false)}
      onResult={(text) => {
        setOpen(false);
        callbackRef.current?.(String(text).trim());
      }}
      onFallback={
        getTelegramScanner()
          ? () => {
              setOpen(false);
              openTelegramScanner(callbackRef.current);
            }
          : undefined
      }
    />
  );

  return { available: canUseCamera() || Boolean(getTelegramScanner()), start, element };
};
