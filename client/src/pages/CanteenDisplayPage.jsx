import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { getCanteenDisplayState } from "../api";
import CanteenMealsModal from "../components/CanteenMealsModal";

import styles from "./CanteenDisplayPage.module.scss";

// Терминал не умеет ничего показывать сам — экран рядом с ним опрашивает
// сервер, крупно выводит текущее распознавание и держит ленту предыдущих.
const POLL_INTERVAL_MS = 1500;
const FEED_LIMIT = 12;
// Минимум, сколько держится карточка. За опрос может прийти сразу несколько
// проходов — показываем их по очереди, а не только последний.
const MIN_CARD_MS = 3000;
// Очередь не копим бесконечно: после долгого простоя показывать всю пачку
// подряд бессмысленно, важны последние
const MAX_QUEUE = 10;
const DEVICE_STORAGE_KEY = "canteen-display-device";
const SOUND_STORAGE_KEY = "canteen-display-sound";

const readStored = (key, fallback = "") => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* приватный режим — настройка просто не запомнится */
  }
};

// Короткий сигнал: в шумной столовой на экран не всегда смотрят
const playBeep = (ok) => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    /* звук не критичен */
  }
};

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

const initial = (name) => (name || "?").trim().charAt(0).toUpperCase();

// Кадр с терминала лежит там же, где фото проходов
const capturedPhotoUrl = (photo) =>
  photo ? `/api/face-passes/image/${photo}` : null;

const employeePhotoUrl = (photo) =>
  photo ? `/api/employees/image/${photo}` : null;

const Avatar = ({ src, name, className }) =>
  src ? (
    <img className={className} src={src} alt={name || ""} />
  ) : (
    <div className={className} data-placeholder="true">
      {initial(name)}
    </div>
  );

const CanteenDisplayPage = () => {
  const { t } = useTranslation();

  const [deviceId, setDeviceId] = useState(() =>
    readStored(DEVICE_STORAGE_KEY, ""),
  );
  const [soundOn, setSoundOn] = useState(
    () => readStored(SOUND_STORAGE_KEY, "on") === "on",
  );
  const [state, setState] = useState(null);
  const [error, setError] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  // "served" | "denied" — какой счётчик раскрыли списком
  const [mealsModal, setMealsModal] = useState(null);
  // { event, at } — что на карточке и когда его показали
  const [shown, setShown] = useState(null);

  const queueRef = useRef([]);
  const maxSeenIdRef = useRef(null);
  // Зеркало shown: таймер очереди читает его синхронно, не дожидаясь рендера
  const shownRef = useRef(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const show = useCallback((event, withSound) => {
    const next = { event, at: Date.now() };
    shownRef.current = next;
    setShown(next);
    if (withSound && soundRef.current) playBeep(event.status === "served");
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await getCanteenDisplayState(
        deviceId || undefined,
        FEED_LIMIT,
      );
      if (!res.success) return;
      setState(res.data);
      setError(false);

      const rows = res.data.recent || [];
      if (rows.length === 0) return;

      const maxId = Math.max(...rows.map((r) => r.id));

      // Первый ответ — не очередь, а исходное состояние: историю не
      // проигрываем и не озвучиваем, показываем только ещё свежий проход
      if (maxSeenIdRef.current === null) {
        maxSeenIdRef.current = maxId;
        if (rows[0].fresh) show(rows[0], false);
        return;
      }

      if (maxId <= maxSeenIdRef.current) return;

      const fresh = rows
        .filter((row) => row.id > maxSeenIdRef.current)
        .sort((a, b) => a.id - b.id);
      maxSeenIdRef.current = maxId;

      queueRef.current = [...queueRef.current, ...fresh].slice(-MAX_QUEUE);
    } catch (err) {
      console.error("Ошибка опроса экрана столовой:", err.message);
      setError(true);
    }
  }, [deviceId, show]);

  useEffect(() => {
    queueRef.current = [];
    maxSeenIdRef.current = null;
    shownRef.current = null;
    setShown(null);
    fetchState();
    const timer = setInterval(fetchState, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchState]);

  // Разбор очереди: следующий проход не вытесняет предыдущий раньше времени
  useEffect(() => {
    const timer = setInterval(() => {
      if (queueRef.current.length === 0) return;

      const prev = shownRef.current;
      if (prev && Date.now() - prev.at < MIN_CARD_MS) return;

      const next = queueRef.current.shift();
      if (next) show(next, true);
    }, 200);
    return () => clearInterval(timer);
  }, [show]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDeviceChange = (e) => {
    setDeviceId(e.target.value);
    writeStored(DEVICE_STORAGE_KEY, e.target.value);
  };

  const toggleSound = () => {
    setSoundOn((prev) => {
      writeStored(SOUND_STORAGE_KEY, prev ? "off" : "on");
      return !prev;
    });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  };

  const recent = state?.recent || [];

  // Карточка живёт окно свежести, но не меньше MIN_CARD_MS — иначе проход из
  // пачки мелькнул бы и пропал. Пересчёт идёт по тику часов (раз в секунду).
  const windowMs = (state?.windowSeconds ?? 20) * 1000;
  const event = (() => {
    if (!shown) return null;
    const age = Date.now() - new Date(shown.event.date).getTime();
    const heldFor = Date.now() - shown.at;
    return age <= windowMs || heldFor < MIN_CARD_MS ? shown.event : null;
  })();
  const served = event?.status === "served";

  const denyText = (reason) =>
    reason === "limit_reached"
      ? t("canteenLimitReached")
      : t("canteenNoAllowance");

  return (
    <div
      className={`${styles.display} ${
        event ? (served ? styles.served : styles.denied) : ""
      }`}
    >
      <div className={styles.controlsBar}>
        <div className={styles.controls}>
          <select
            className={styles.deviceSelect}
            value={deviceId}
            onChange={handleDeviceChange}
          >
            <option value="">{t("allCanteenTerminals")}</option>
            {(state?.devices || []).map((device) => (
              <option key={device.id} value={device.id}>
                {device.name || device.device_ip}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleSound}
            title={t("sound")}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleFullscreen}
            title={t("fullscreen")}
          >
            ⛶
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.mainColumn}>
          <div className={styles.counters}>
            <button
              type="button"
              className={`${styles.counter} ${styles.counterServed} ${styles.counterBtn}`}
              onClick={() => setMealsModal("served")}
            >
              <span className={styles.counterValue}>
                {state?.today?.served ?? 0}
              </span>
              <span className={styles.counterLabel}>{t("servedToday")}</span>
            </button>

            <button
              type="button"
              className={`${styles.counter} ${styles.counterDenied} ${styles.counterBtn}`}
              onClick={() => setMealsModal("denied")}
            >
              <span className={styles.counterValue}>
                {state?.today?.denied ?? 0}
              </span>
              <span className={styles.counterLabel}>{t("deniedToday")}</span>
            </button>

            <div className={`${styles.counter} ${styles.counterClock}`}>
              <span className={styles.counterValue}>
                {clock.toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className={styles.counterLabel}>
                {clock.toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "long",
                })}
              </span>
            </div>
          </div>

          {error && (
            <div className={styles.errorBar}>{t("connectionLost")}</div>
          )}

          <div className={styles.stage}>
          {event ? (
            <div
              className={`${styles.card} ${
                served ? styles.cardServed : styles.cardDenied
              }`}
            >
              <div className={styles.photos}>
                <figure className={styles.photoBox}>
                  <Avatar
                    src={
                      capturedPhotoUrl(event.photo) ||
                      employeePhotoUrl(event.employeePhoto)
                    }
                    name={event.employeeFullName}
                    className={
                      capturedPhotoUrl(event.photo) ||
                      employeePhotoUrl(event.employeePhoto)
                        ? styles.photo
                        : styles.photoPlaceholder
                    }
                  />
                  <figcaption className={styles.photoCaption}>
                    {event.photo ? t("terminalCapture") : t("employeePhoto")}
                  </figcaption>
                </figure>
              </div>

              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <div className={styles.nameCol}>
                    <h1 className={styles.name}>{event.employeeFullName}</h1>
                    <p className={styles.meta}>
                      {[event.departmentName, event.positionName]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>

                  {/* Фото из базы рядом с ФИО — сверяют лицо с именем, а не
                      с кадром: кадр и так крупно слева */}
                  {event.photo && event.employeePhoto && (
                    <img
                      className={styles.nameAvatar}
                      src={employeePhotoUrl(event.employeePhoto)}
                      alt={event.employeeFullName || ""}
                      title={t("employeePhoto")}
                    />
                  )}
                </div>

                {/* Строки внутри блока — одно сообщение, поэтому жмутся
                    друг к другу, а блоки разделяет общий gap у .info */}
                <div className={styles.verdictBlock}>
                  {served ? (
                    <>
                      {/* Какая это порция из положенных, а не остаток:
                          «2 / 3» человек считывает быстрее, чем «осталось 1» */}
                      <div className={styles.portion}>
                        <span className={styles.portionValue}>
                          {event.portion_no ?? event.used_today}
                        </span>
                        <span className={styles.portionSep}>/</span>
                        <span className={styles.portionLimit}>
                          {event.daily_limit}
                        </span>
                      </div>
                      <div className={styles.portionLabel}>
                        {t("portionOfDay")}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.verdict}>{t("canteenDenied")}</div>
                      <div className={styles.denyReason}>
                        {denyText(event.deny_reason)}
                      </div>
                    </>
                  )}
                </div>

                <div className={styles.footer}>
                  <p className={styles.limitLine}>
                    {t("dailyPortionLimit")}: {event.daily_limit} ·{" "}
                    {t("usedToday")}: {event.used_today}
                  </p>
                  <p className={styles.time}>
                    {formatTime(event.date)}
                    {event.deviceName ? ` · ${event.deviceName}` : ""}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.idle}>
              <div className={styles.idleIcon}>🍽</div>
              <p className={styles.idleText}>{t("canteenIdlePrompt")}</p>
              <p className={styles.idleSub}>
                {t("servedToday")}: {state?.today?.served ?? 0}
              </p>
            </div>
          )}
          </div>
        </div>

        <aside className={styles.feed}>
          <div className={styles.feedHeader}>
            <span>{t("recentPasses")}</span>
            <span className={styles.feedCount}>{recent.length}</span>
          </div>

          <div className={styles.feedList}>
            {recent.length > 0 ? (
              recent.map((item, index) => (
                <div
                  key={item.id}
                  className={`${styles.feedItem} ${
                    item.status === "served"
                      ? styles.feedServed
                      : styles.feedDenied
                  } ${index === 0 && item.fresh ? styles.feedItemActive : ""}`}
                >
                  <Avatar
                    src={
                      capturedPhotoUrl(item.photo) ||
                      employeePhotoUrl(item.employeePhoto)
                    }
                    name={item.employeeFullName}
                    className={
                      item.photo || item.employeePhoto
                        ? styles.feedPhoto
                        : styles.feedPhotoPlaceholder
                    }
                  />

                  <div className={styles.feedInfo}>
                    <span className={styles.feedName}>
                      {item.employeeFullName}
                    </span>
                    <span className={styles.feedMeta}>
                      {formatTime(item.date)}
                      {item.departmentName ? ` · ${item.departmentName}` : ""}
                    </span>
                  </div>

                  <div className={styles.feedRight}>
                    {item.status === "served" ? (
                      <>
                        <span className={styles.feedRemaining}>
                          {item.portion_no ?? item.used_today}
                          <span className={styles.feedRemainingOf}>
                            /{item.daily_limit}
                          </span>
                        </span>
                        <span className={styles.feedTag}>
                          {t("canteenServed")}
                        </span>
                      </>
                    ) : (
                      <span className={styles.feedTagDenied}>
                        {denyText(item.deny_reason)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.feedEmpty}>{t("noPassesToday")}</p>
            )}
          </div>
        </aside>
      </div>

      {mealsModal && (
        <CanteenMealsModal
          status={mealsModal}
          date={state?.today?.date}
          deviceId={deviceId}
          onClose={() => setMealsModal(null)}
        />
      )}
    </div>
  );
};

export default CanteenDisplayPage;
