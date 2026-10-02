import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { assignCanteenAllowances, EmployeeService } from "../api";

import Button from "./Button";
import MultiSelectEmployees from "./MultiSelectEmployees";

import styles from "./AddCanteenAllowance.module.scss";

// Норма назначается сразу группе: в столовой её ставят цехом/отделом,
// а не по одному человеку.
const AddCanteenAllowance = ({ handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    daily_limit: 1,
    status: "true",
    note: "",
    branch_id: "",
    department_id: "",
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await EmployeeService.getActive();
        if (res.success) setEmployees(res.data);
      } catch (error) {
        console.error("Ошибка при получении сотрудников:", error.message);
      }
    };
    fetchEmployees();
  }, []);

  const branches = useMemo(
    () => [...new Set(employees.map((e) => e.branchName).filter(Boolean))],
    [employees],
  );

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees
            .filter(
              (e) => !formData.branch_id || e.branchName === formData.branch_id,
            )
            .map((e) => e.departmentName)
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, "ru")),
    [employees, formData.branch_id],
  );

  // Фильтры сужают список выбора, но уже отмеченных людей не снимают
  const visibleEmployees = useMemo(
    () =>
      employees.filter(
        (e) =>
          (!formData.branch_id || e.branchName === formData.branch_id) &&
          (!formData.department_id ||
            e.departmentName === formData.department_id),
      ),
    [employees, formData.branch_id, formData.department_id],
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "branch_id" ? { department_id: "" } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selected.length === 0) {
      showAlert(t("selectAtLeastOneEmployee"), "error");
      return;
    }

    setIsLoading(true);
    try {
      const res = await assignCanteenAllowances({
        employee_ids: selected,
        daily_limit: Number(formData.daily_limit),
        status: formData.status === "true",
        note: formData.note,
      });

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1000);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      showAlert(
        error.response?.data?.error || error.message || t("error"),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.addCanteenAllowance} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("assignCanteenAllowance")}</h2>
        <Button text={t("save")} type="submit" loading={isLoading} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("branch")}</label>
          <select
            name="branch_id"
            value={formData.branch_id}
            onChange={handleChange}
          >
            <option value="">{t("all")}</option>
            {branches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>{t("department")}</label>
          <select
            name="department_id"
            value={formData.department_id}
            onChange={handleChange}
          >
            <option value="">{t("all")}</option>
            {departments.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.rowFull}>
        <label>
          {t("employees")}
          <span className={styles.counter}>
            {t("selected")}: {selected.length}
          </span>
        </label>
        <MultiSelectEmployees
          options={visibleEmployees}
          selected={selected}
          onChange={setSelected}
        />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("dailyPortionLimit")}</label>
          <input
            type="number"
            name="daily_limit"
            value={formData.daily_limit}
            onChange={handleChange}
            min="0"
            max="20"
            required
            disabled={isLoading}
          />
        </div>
        <div>
          <label>{t("status")}</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={isLoading}
          >
            <option value="true">{t("enabled")}</option>
            <option value="false">{t("disabled")}</option>
          </select>
        </div>
      </div>

      <div className={styles.rowFull}>
        <label>{t("note")}</label>
        <input
          type="text"
          name="note"
          value={formData.note}
          onChange={handleChange}
          maxLength={255}
          disabled={isLoading}
        />
      </div>

      <p className={styles.hint}>{t("canteenAllowanceHint")}</p>
    </form>
  );
};

export default AddCanteenAllowance;
