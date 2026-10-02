import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { IconClose, IconFlash } from "./tgIcons";
import styles from "./CameraScanner.module.scss";

// Декодер (zxing-cpp в WebAssembly, читает DataMatrix и QR) грузится лениво — при первом
// открытии камеры; wasm отдаётся с нашего сервера, а не с CDN.
let readerPromise = null;

const loadReader = () => {
  if (!readerPromise) {
    readerPromise = Promise.all([
      import("zxing-wasm/reader"),
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ])
      .then(async ([reader, wasm]) => {
        await reader.prepareZXingModule({
          overrides: {
            locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasm.default : prefix + path),
          },
          fireImmediately: true,
        });
        return reader.readBarcodes;
      })
      .catch((err) => {
        readerPromise = null;
        throw err;
      });
  }
  return readerPromise;
};

const READ_OPTIONS = {
  formats: ["DataMatrix", "QRCode"],
  tryHarder: true,
  tryRotate: true,
  maxNumberOfSymbols: 1,
  // Сырой текст кода — без GS1-«расшифровки»: поля партии разделены ';'.
  textMode: "Plain",
};

const TICK_MS = 90;
const MAX_SIDE = 900;
// Кадр режем чуть шире рамки видоискателя — рука не всегда попадает точно.
const CROP_MARGIN = 1.15;

const haptic = () => {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred("success");
  } catch {
    // Нет тактильного отклика — не страшно.
  }
  navigator.vibrate?.(60);
};

// Полноэкранная камера для считывания DataMatrix / QR (Telegram-версия Производства).
// Камера Telegram (showScanQrPopup) умеет только QR, поэтому кадры разбираются здесь.
// Одно считывание за открытие: onResult(text) вызывается один раз, камера закрывается.
// onFallback — запасной вариант (камера Telegram, только QR), если своя не запустилась.
export default function CameraScanner({ isOpen, onResult, onClose, onFallback }) {
  const { t } = useTranslation();
  const videoRef = useRef(null);
  const frameRef = useRef(null);
  const trackRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [status, setStatus] = useState("starting"); // starting | scanning | error
  const [errorKey, setErrorKey] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    let cancelled = false;
    let timer = null;
    let stream = null;
    let busy = false;

    setStatus("starting");
    setErrorKey("");
    setTorchOn(false);
    setTorchSupported(false);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const stop = () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      trackRef.current = null;
    };

    // Область кадра под рамкой видоискателя (видео показано с object-fit: cover, рамка — по центру).
    const grabFrame = (video) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const scale = Math.max(video.clientWidth / vw, video.clientHeight / vh);
      const frameSize = frameRef.current?.clientWidth || Math.min(video.clientWidth, video.clientHeight);
      const side = Math.min(vw, vh, (frameSize / scale) * CROP_MARGIN);
      const out = Math.min(Math.round(side), MAX_SIDE);

      canvas.width = out;
      canvas.height = out;
      context.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, out, out);
      return context.getImageData(0, 0, out, out);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          const unsupported = new Error("getUserMedia is not available");
          unsupported.name = "NotSupportedError";
          throw unsupported;
        }

        const readerLoading = loadReader();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        setTorchSupported(Boolean(track.getCapabilities?.().torch));
        // Непрерывная автофокусировка — если камера её поддерживает.
        track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});

        const readBarcodes = await readerLoading;
        if (cancelled) return;
        setStatus("scanning");

        const tick = async () => {
          if (cancelled) return;
          if (!busy && video.readyState >= 2 && video.videoWidth) {
            busy = true;
            try {
              const results = await readBarcodes(grabFrame(video), READ_OPTIONS);
              const hit = results.find((item) => item.isValid && item.text);
              if (hit && !cancelled) {
                stop();
                haptic();
                onResultRef.current(hit.text);
                return;
              }
            } catch (err) {
              console.error(err);
            } finally {
              busy = false;
            }
          }
          if (!cancelled) timer = setTimeout(tick, TICK_MS);
        };
        tick();
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        const denied = ["NotAllowedError", "SecurityError", "NotSupportedError"].includes(err?.name);
        setErrorKey(denied ? "tgCameraDenied" : "tgCameraError");
        setStatus("error");
      }
    })();

    return stop;
  }, [isOpen]);

  const toggleTorch = async () => {
    const next = !torchOn;
    try {
      await trackRef.current?.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      console.error(err);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <video ref={videoRef} className={styles.video} playsInline muted autoPlay />

          <div className={styles.top}>
            <button type="button" className={styles.roundBtn} onClick={onClose} aria-label={t("cancel")}>
              <IconClose />
            </button>
            <span className={styles.title}>{t("tgScanCamera")}</span>
            {torchSupported ? (
              <button
                type="button"
                className={`${styles.roundBtn} ${torchOn ? styles.roundBtnOn : ""}`}
                onClick={toggleTorch}
                aria-label={t("tgCameraTorch")}
                aria-pressed={torchOn}
              >
                <IconFlash />
              </button>
            ) : (
              <span className={styles.roundSpacer} />
            )}
          </div>

          <div ref={frameRef} className={styles.frame}>
            <span className={`${styles.corner} ${styles.cornerTl}`} />
            <span className={`${styles.corner} ${styles.cornerTr}`} />
            <span className={`${styles.corner} ${styles.cornerBl}`} />
            <span className={`${styles.corner} ${styles.cornerBr}`} />
            {status === "scanning" && <span className={styles.line} />}
          </div>

          <p className={styles.hint}>{status === "starting" ? t("tgCameraStarting") : t("tgCameraScanHint")}</p>

          {status === "error" && (
            <div className={styles.error}>
              <p>{t(errorKey)}</p>
              {onFallback && (
                <button type="button" className={styles.errorBtn} onClick={onFallback}>
                  {t("tgCameraFallback")}
                </button>
              )}
              <button type="button" className={`${styles.errorBtn} ${styles.errorBtnGhost}`} onClick={onClose}>
                {t("cancel")}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
