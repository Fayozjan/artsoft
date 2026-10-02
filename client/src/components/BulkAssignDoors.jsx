import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { EmployeeService, getActiveDoors } from "../api";

import Button from "./Button";
import MultiSelectDoors from "./MultiSelectDoors";
import { Icons } from "../icons/icons";
import styles from "./BulkForm.module.scss";

// Массовое назначение дверей выделенным сотрудникам.
// add — добавить к текущим, remove — снять, replace — заменить набор целиком.
const BulkAssignDoors = ({ employeeIds, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [doors, setDoors] = useState([]);
  const [doorIds, setDoorIds] = useState([]);
  const [mode, setMode] = useState("add");
  const [syncDoors, setSyncDoors] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getActiveDoors()
      .then((res) => setDoors(res.data || []))
      .catch(() => setDoors([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (mode !== "replace" && !doorIds.length) {
      showAlert(t("selectDoor"), "error");
      return;
    }

    setLoading(true);
    try {
      const res = await EmployeeService.bulkUpdateDoors(
        employeeIds,
        doorIds,
        mode,
        syncDoors,
      );
      showAlert(`${t("saved")} (${res.updated})`, "success");
      onSuccess?.(res);
      setTimeout(handleClose, 1000);
    } catch (err) {
      showAlert(err.response?.data?.error || t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const modes = [
    { value: "add", label: t("doorModeAdd"), hint: t("doorModeAddHint") },
    { value: "remove", label: t("doorModeRemove"), hint: t("doorModeRemoveHint") },
    { value: "replace", label: t("doorModeReplace"), hint: t("doorModeReplaceHint") },
  ];

  return (
    <form className={styles.bulkForm} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>
          {t("bulkAssignDoors")} ({employeeIds.length})
        </h2>
        <span
          onClick={handleClose}
          style={{ display: "flex", cursor: "pointer" }}
        >
          {Icons.clear}
        </span>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("doors")}</label>
          <MultiSelectDoors
            options={doors}
            selected={doorIds}
            onChange={setDoorIds}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.modeGroup}>
          {modes.map((m) => (
            <label key={m.value} className={styles.modeOption}>
              <input
                type="radio"
                name="mode"
                value={m.value}
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <span>
                {m.label}
                <span className={styles.modeHint}>{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.checkboxRow}>
          <input
            id="bulk-sync-doors"
            type="checkbox"
            checked={syncDoors}
            onChange={(e) => setSyncDoors(e.target.checked)}
          />
          <label htmlFor="bulk-sync-doors">{t("syncWithDoor")}</label>
        </div>
      </div>

      <p className={styles.hint}>{t("syncWithDoorHint")}</p>

      <div className={styles.btnWrapper}>
        <Button
          text={t("apply")}
          type="submit"
          disabled={loading}
          loading={loading}
        />
      </div>
    </form>
  );
};

export default BulkAssignDoors;
