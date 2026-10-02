import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { EmployeeService, getActiveBranches, getActivePositions } from "../api";

import Button from "./Button";
import { Icons } from "../icons/icons";
import styles from "./BulkForm.module.scss";

// Прямая правка филиала/отдела/должности без приказа — для кривых данных
// после импорта или ручных ошибок. Приказ не создаётся.
const BulkEditPlacement = ({ employeeIds, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getActiveBranches(), getActivePositions()])
      .then(([branchesRes, positionsRes]) => {
        setBranches(branchesRes.data || []);
        setPositions(positionsRes.data || []);
      })
      .catch(() => showAlert(t("errorOccurred"), "error"));
  }, []);

  const departments =
    branches.find((b) => b.id === Number(branchId))?.departments || [];

  const handleBranchChange = (value) => {
    setBranchId(value);
    setDepartmentId("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!branchId && !departmentId && !positionId) {
      showAlert(t("bulkEditPlacementNothingSelected"), "error");
      return;
    }

    setLoading(true);
    try {
      const res = await EmployeeService.bulkUpdatePlacement(
        employeeIds,
        {
          branch_id: branchId || undefined,
          department_id: departmentId || undefined,
          position_id: positionId || undefined,
        },
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

  return (
    <form className={styles.bulkForm} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>
          {t("bulkEditPlacement")} ({employeeIds.length})
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
          <label>{t("branch")}</label>
          <select
            value={branchId}
            onChange={(e) => handleBranchChange(e.target.value)}
          >
            <option value="">{t("bulkKeepCurrent")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>{t("department")}</label>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            disabled={!branchId}
            required={Boolean(branchId)}
          >
            <option value="">{t("bulkKeepCurrent")}</option>
            {departments.map((d) => (
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
            value={positionId}
            onChange={(e) => setPositionId(e.target.value)}
          >
            <option value="">{t("bulkKeepCurrent")}</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className={styles.hint}>{t("bulkEditPlacementHint")}</p>

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

export default BulkEditPlacement;
