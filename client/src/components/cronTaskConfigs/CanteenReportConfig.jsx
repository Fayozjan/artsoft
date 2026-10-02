import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useFilterDataStore } from "../../stores/filterDataStore";
import { getCanteenDevices } from "../../api";
import ChatIdsInput from "./ChatIdsInput";

import styles from "./AttendanceReportConfig.module.scss";

const PERIODS = ["today", "yesterday", "week", "month", "prev_month"];
const GROUP_BY = ["employee", "department", "branch"];

const emptyFilter = () => ({ branch_id: "", department_id: "", position_id: "", device_id: "" });

// Конфиг-под-форма для task_type = "canteen_report".
// Фильтр — одиночные id (зеркало фильтров CanteenReportPage.jsx), не массивы.
const CanteenReportConfig = ({ config, onChange, failedChatIds }) => {
  const { t } = useTranslation();
  const { branches, departments, positions, fetchAllData } = useFilterDataStore();
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    if (!branches.length || !departments.length || !positions.length) {
      fetchAllData();
    }
    getCanteenDevices()
      .then((res) => setDevices(res.data || []))
      .catch((err) => console.error("Ошибка загрузки терминалов столовой:", err.message));
  }, []);

  const filter = config.filter || emptyFilter();

  const sortByName = (list) =>
    [...list].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  const branchOptions = useMemo(() => sortByName(branches), [branches]);
  const deptOptions = useMemo(() => sortByName(departments), [departments]);
  const positionOptions = useMemo(() => sortByName(positions), [positions]);

  const setFilterField = (field, value) =>
    onChange({ ...config, filter: { ...filter, [field]: value } });

  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <div>
          <ChatIdsInput
            value={config.chat_ids}
            onChange={(chat_ids) => onChange({ ...config, chat_ids })}
            failedIds={failedChatIds}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("reportPeriod")}</label>
          <select
            value={config.period || "today"}
            onChange={(e) => onChange({ ...config, period: e.target.value })}
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(`canteenPeriod_${p}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("groupBy")}</label>
          <select
            value={config.group_by || "employee"}
            onChange={(e) => onChange({ ...config, group_by: e.target.value })}
          >
            {GROUP_BY.map((g) => (
              <option key={g} value={g}>
                {t(g)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("language")}</label>
          <select
            value={config.language || "ru"}
            onChange={(e) => onChange({ ...config, language: e.target.value })}
          >
            <option value="ru">{t("languageRussian")}</option>
            <option value="uzCyrl">{t("languageUzbekCyrl")}</option>
            <option value="uzLatn">{t("languageUzbekLatn")}</option>
            <option value="en">{t("languageEnglish")}</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("branch")}</label>
          <select
            value={filter.branch_id}
            onChange={(e) => setFilterField("branch_id", e.target.value)}
          >
            <option value="">{t("all")}</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("department")}</label>
          <select
            value={filter.department_id}
            onChange={(e) => setFilterField("department_id", e.target.value)}
          >
            <option value="">{t("all")}</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("position")}</label>
          <select
            value={filter.position_id}
            onChange={(e) => setFilterField("position_id", e.target.value)}
          >
            <option value="">{t("all")}</option>
            {positionOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("faceDevice")}</label>
          <select
            value={filter.device_id}
            onChange={(e) => setFilterField("device_id", e.target.value)}
          >
            <option value="">{t("all")}</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name || device.device_ip}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default CanteenReportConfig;
