import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import TelegramPageHeader from "./TelegramPageHeader";
import { FacePassesService } from "../api";
import { getAttendanceByEmployeeId } from "../api/attendance";

import styles from "./AddFacePassTelegram.module.scss";

const AddFacePassTelegram = ({ handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { access } = useAuthStore();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const facingModeRef = useRef("user");
  const [facingMode, setFacingMode] = useState("user");

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [direction, setDirection] = useState("entry");
  const [shiftLoading, setShiftLoading] = useState(true);

  useEffect(() => {
    if (!access?.employee_id) {
      setShiftLoading(false);
      return;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    getAttendanceByEmployeeId(access.employee_id, { date: todayStr })
      .then((res) => {
        const { today: todayData } = res.data;
        const todaySession = todayData?.sessions?.[todayData?.date];
        const events = todaySession?.events || [];
        const lastEvent = events[events.length - 1];
        const isCurrentlyInside = lastEvent?.direction === "entry";
        setDirection(isCurrentlyInside ? "exit" : "entry");
      })
      .catch(() => {})
      .finally(() => setShiftLoading(false));
  }, [access?.employee_id]);

  const setFacing = (mode) => {
    facingModeRef.current = mode;
    setFacingMode(mode);
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        t("geolocationNotSupported") || "Геолокация не поддерживается",
      );
      return;
    }
    setLocationLoading(true);
    setLocationError(null);

    let watchId = null;
    let bestPos = null;
    let gotFirst = false;

    const finish = (pos) => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setLocationLoading(false);
    };

    // Hard stop after 20s — use best fix collected so far
    const hardStop = setTimeout(() => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (bestPos) {
        setLocation({
          latitude: bestPos.coords.latitude,
          longitude: bestPos.coords.longitude,
        });
        setLocationLoading(false);
      } else {
        setLocationError(t("locationDenied") || "Доступ к геолокации запрещён");
        setLocationLoading(false);
      }
    }, 20000);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // Keep best (most accurate = lowest accuracy radius)
        if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
          bestPos = pos;
        }

        if (!gotFirst) {
          gotFirst = true;
          // Show first fix immediately so user isn't blocked
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setLocationLoading(false);
        }

        // Accuracy good enough — stop watching
        if (pos.coords.accuracy <= 20) {
          clearTimeout(hardStop);
          finish(pos);
        }
      },
      (err) => {
        clearTimeout(hardStop);
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
        if (bestPos) {
          setLocation({
            latitude: bestPos.coords.latitude,
            longitude: bestPos.coords.longitude,
          });
          setLocationLoading(false);
        } else {
          setLocationError(
            t("locationDenied") || "Доступ к геолокации запрещён",
          );
          setLocationLoading(false);
        }
        console.error("Geolocation error:", err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const startCamera = async (mode) => {
    const currentMode = mode ?? facingModeRef.current;
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current
            .play()
            .catch((err) => console.error("Video play error:", err));
        }
      });
    } catch (err) {
      console.error("Camera error:", err);
      showAlert(t("cameraError") || "Ошибка доступа к камере", "error");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    if (facingModeRef.current === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPhotoPreview(url);
        setPhoto(
          new File([blob], `work_reg_${Date.now()}.jpg`, {
            type: "image/jpeg",
          }),
        );
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  const retakePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    setPhoto(null);

    setTimeout(() => {
      startCamera();
    }, 50);
  };

  useEffect(() => {
    requestLocation();
    startCamera();
    return () => {
      stopCamera();
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, []);

  const handleSubmit = async () => {
    if (!photo) {
      showAlert(t("photoRequired") || "Сделайте фото", "error");
      return;
    }
    if (!location) {
      showAlert(t("locationRequired") || "Геолокация не получена", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await FacePassesService.AddFacePassTelegram({
        photo,
        latitude: location.latitude,
        longitude: location.longitude,
        direction,
      });
      showAlert(t("success"), "success");
      onSuccess?.();
    } catch (err) {
      console.log("err", err);
      showAlert(err.response?.data?.message || err.message || "Error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.screenWrapper}>
      <TelegramPageHeader title={t("workRegistration")} onBack={handleClose} />

      <div className={styles.scrollContent}>
        <div className={styles.directionLabel}>
          <span
            className={`${styles.directionBadge} ${direction === "exit" ? styles.directionExit : styles.directionEntry}`}
          >
            {direction === "entry"
              ? t("startWork") || "Начать работу"
              : t("finishWork") || "Завершить работу"}
          </span>
        </div>

        <div className={styles.cameraSection}>
          <div className={styles.cameraContainer}>
            <video
              ref={videoRef}
              className={styles.videoFeed}
              playsInline
              muted
              style={{
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
              }}
            />
            <canvas ref={canvasRef} hidden />

            {photoPreview && (
              <div className={styles.photoPreview}>
                <img src={photoPreview} alt="Preview" />
                <button
                  className={styles.deleteBtn}
                  onClick={retakePhoto}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className={styles.cameraControls}>
            {cameraOpen && !photoPreview && (
              <button
                className={styles.shutterBtn}
                onClick={takePhoto}
                type="button"
              />
            )}
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {locationLoading && (
          <div className={styles.locationStatus}>
            <span className={styles.locationSpinner} />
            {t("obtainingLocation") || "Получение геолокации..."}
          </div>
        )}
        {locationError && !locationLoading && (
          <div className={styles.locationError}>
            <span>{locationError}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={requestLocation}
            >
              {t("retry") || "Повторить"}
            </button>
          </div>
        )}
        <button
          className={`${styles.applyBtn} ${direction === "exit" ? styles.finishBtn : ""}`}
          onClick={handleSubmit}
          disabled={isSubmitting || !photo || !location || shiftLoading}
          type="button"
        >
          {isSubmitting
            ? t("sending") || "Отправка..."
            : direction === "entry"
              ? t("entry") || "Отметить вход"
              : t("exit") || "Отметить выход"}
        </button>
      </div>
    </div>
  );
};

export default AddFacePassTelegram;
