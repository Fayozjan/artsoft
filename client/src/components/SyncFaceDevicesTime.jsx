import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getActiveDoors, getFaceDevices, syncFaceDevicesTime } from "../api";

import Button from "./Button";
import Loading from "./Loading";

import styles from "./SyncFaceDevicesTime.module.scss";

const TIMEZONES = [
  { value: 300, labelKey: "timezoneTashkent" },
  { value: 180, labelKey: "timezoneMoscow" },
  { value: 360, labelKey: "timezoneAlmaty" },
  { value: 0, labelKey: "timezoneUtc" },
];

// Сервер возвращает стабильный code, текст ошибки собираем на клиенте —
// иначе в UI попадал сырой ответ терминала (XML/HTTP-статус) без перевода.
const SYNC_ERROR_KEYS = {
  NO_IP: "syncErrorNoIp",
  UNSUPPORTED: "syncErrorUnsupported",
  NOT_FOUND: "syncErrorNotFound",
  TIMEOUT: "syncErrorTimeout",
  UNREACHABLE: "syncErrorUnreachable",
  CONNECTION_REFUSED: "syncErrorConnectionRefused",
  NETWORK: "syncErrorNetwork",
  AUTH: "syncErrorAuth",
  NOT_SUPPORTED_BY_DEVICE: "syncErrorNotSupportedByDevice",
  DEVICE_REJECTED: "syncErrorDeviceRejected",
  DEVICE_ERROR: "syncErrorDeviceError",
  UNKNOWN: "syncErrorUnknown",
};

const isSyncable = (device) => device.is_local || !!device.serial_number;

const SyncFaceDevicesTime = ({ handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [devices, setDevices] = useState([]);
  const [doors, setDoors] = useState([]);
  const [doorFilter, setDoorFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [offsetMinutes, setOffsetMinutes] = useState(TIMEZONES[0].value);
  const [mode, setMode] = useState("manual");
  const [results, setResults] = useState(null);
  const [onlyFailed, setOnlyFailed] = useState(false);

  const errorText = (result) =>
    t(SYNC_ERROR_KEYS[result.code] || SYNC_ERROR_KEYS.UNKNOWN);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data }, doorsRes] = await Promise.all([
          getFaceDevices({ page: 1, pageSize: 1000 }),
          getActiveDoors(),
        ]);
        setDevices(data.filter(isSyncable));
        if (doorsRes.success) setDoors(doorsRes.data);
      } catch (error) {
        console.error("Ошибка при получении устройств:", error.message);
        setLoadFailed(true);
        showAlert(
          error.response?.data?.error || t("syncTimeLoadDevicesFailed"),
          "error",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const resultsById = useMemo(() => {
    if (!results) return {};
    return Object.fromEntries(results.map((r) => [r.id, r]));
  }, [results]);

  const failedCount = results ? results.filter((r) => !r.success).length : 0;
  const okCount = results ? results.length - failedCount : 0;

  const byDoor = doorFilter
    ? devices.filter((d) => String(d.door_id ?? d.door?.id) === doorFilter)
    : devices;

  const filteredDevices =
    onlyFailed && results
      ? byDoor.filter((d) => resultsById[d.id] && !resultsById[d.id].success)
      : byDoor;

  // Устройство могли удалить между открытием окна и синхронизацией —
  // такой результат не к чему привязать в списке, показываем отдельно.
  const orphanResults = useMemo(() => {
    if (!results) return [];
    const known = new Set(devices.map((d) => d.id));
    return results.filter((r) => !known.has(r.id) && !r.success);
  }, [results, devices]);

  const allSelected =
    filteredDevices.length > 0 &&
    filteredDevices.every((d) => selectedIds.has(d.id));

  const toggleDevice = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        filteredDevices.forEach((d) => next.delete(d.id));
      } else {
        filteredDevices.forEach((d) => next.add(d.id));
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedIds.size === 0) {
      showAlert(t("selectAtLeastOneDevice"), "error");
      return;
    }

    setSubmitting(true);
    setResults(null);
    setOnlyFailed(false);

    try {
      const res = await syncFaceDevicesTime(
        [...selectedIds],
        offsetMinutes,
        mode,
      );
      setResults(res.data);

      const failed = res.data.filter((r) => !r.success);
      if (failed.length === 0) {
        showAlert(t("success"), "success");
        onSuccess?.();
      } else {
        // Подробности — в списке устройств; в алерте только счётчик,
        // иначе тост разрастается на весь экран при пачке ошибок.
        showAlert(
          `${t("syncTimeFailedDevices")}: ${failed.length} / ${res.data.length}`,
          "error",
        );
        if (failed.length < res.data.length) onSuccess?.();
      }
    } catch (error) {
      console.error("Ошибка при синхронизации времени:", error.message);
      showAlert(
        error.response?.data?.error || error.message || t("error"),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.syncFaceDevicesTime} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("syncFaceDeviceTime")}</h2>
        <Button text={t("syncTimeSubmit")} type="submit" loading={submitting} />
      </div>

      <div className={styles.modeRow}>
        <label className={styles.modeOption}>
          <input
            type="radio"
            name="syncMode"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
          />
          {t("syncModeManual")}
        </label>
        <label className={styles.modeOption}>
          <input
            type="radio"
            name="syncMode"
            checked={mode === "ntp"}
            onChange={() => setMode("ntp")}
          />
          {t("syncModeNtp")}
        </label>
      </div>

      <div className={styles.timezoneRow}>
        <label>{t("selectTimezone")}</label>
        <select
          value={offsetMinutes}
          onChange={(e) => setOffsetMinutes(Number(e.target.value))}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {t(tz.labelKey)}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.timezoneRow}>
        <label>{t("door")}</label>
        <select
          value={doorFilter}
          onChange={(e) => setDoorFilter(e.target.value)}
        >
          <option value="">{t("all")}</option>
          {doors.map((door) => (
            <option key={door.id} value={String(door.id)}>
              {door.name}
            </option>
          ))}
        </select>
      </div>

      {results && (
        <div className={styles.summary}>
          <span className={styles.summaryOk}>
            ✓ {t("syncTimeSucceeded")}: {okCount}
          </span>
          {failedCount > 0 && (
            <>
              <span className={styles.summaryFail}>
                ✗ {t("syncTimeFailedDevices")}: {failedCount}
              </span>
              <label className={styles.onlyFailed}>
                <input
                  type="checkbox"
                  checked={onlyFailed}
                  onChange={() => setOnlyFailed((v) => !v)}
                />
                {t("syncTimeShowOnlyFailed")}
              </label>
            </>
          )}
        </div>
      )}

      {orphanResults.length > 0 && (
        <div className={styles.orphanList}>
          {orphanResults.map((r) => (
            <div key={`orphan-${r.id}`} className={styles.deviceError}>
              <span className={styles.deviceErrorText}>
                {r.name} — {errorText(r)}
              </span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <Loading />
      ) : loadFailed ? (
        <div className={styles.empty}>{t("syncTimeLoadDevicesFailed")}</div>
      ) : devices.length === 0 ? (
        <div className={styles.empty}>{t("noEligibleDevices")}</div>
      ) : filteredDevices.length === 0 ? (
        <div className={styles.empty}>{t("noData")}</div>
      ) : (
        <div className={styles.deviceList}>
          <label className={styles.deviceRow}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            <span className={styles.deviceName}>{t("selectAllDevices")}</span>
          </label>

          {filteredDevices.map((device) => {
            const result = resultsById[device.id];
            const failed = result && !result.success;

            return (
              <div key={device.id} className={styles.deviceItem}>
                <label className={styles.deviceRow}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(device.id)}
                    onChange={() => toggleDevice(device.id)}
                  />
                  <span className={styles.deviceName}>{device.name}</span>
                  <span className={styles.deviceIp}>
                    {device.device_ip || device.serial_number}
                  </span>
                  {result && (
                    <span
                      className={failed ? styles.resultFail : styles.resultOk}
                    >
                      {failed ? "✗" : "✓"}
                    </span>
                  )}
                </label>

                {failed && (
                  <div className={styles.deviceError}>
                    <span className={styles.deviceErrorText}>
                      {errorText(result)}
                    </span>
                    {result.detail && (
                      <span
                        className={styles.deviceErrorDetail}
                        title={result.detail}
                      >
                        {result.detail}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
};

export default SyncFaceDevicesTime;
