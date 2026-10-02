import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { editCanteenAllowance, getCanteenAllowanceById } from "../api";

import Button from "./Button";
import Loading from "./Loading";

import styles from "./AddCanteenAllowance.module.scss";

const EditCanteenAllowance = ({ id, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [employeeName, setEmployeeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    daily_limit: 1,
    status: "true",
    note: "",
  });

  useEffect(() => {
    const fetchAllowance = async () => {
      try {
        const res = await getCanteenAllowanceById(id);
        if (res.success && res.data) {
          setEmployeeName(res.data.employeeFullName || "");
          setFormData({
            daily_limit: res.data.daily_limit ?? 1,
            status: String(res.data.status),
            note: res.data.note || "",
          });
        }
      } catch (error) {
        console.error("Ошибка при получении нормы:", error.message);
        showAlert(t("error"), "error");
      } finally {
        setLoading(false);
      }
    };
    fetchAllowance();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await editCanteenAllowance(id, {
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
      setIsSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <form className={styles.addCanteenAllowance} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editCanteenAllowance")}</h2>
        <Button text={t("save")} type="submit" loading={isSaving} />
      </div>

      <div className={styles.rowFull}>
        <label>{t("employee")}</label>
        <input type="text" value={employeeName} disabled readOnly />
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
            disabled={isSaving}
          />
        </div>
        <div>
          <label>{t("status")}</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={isSaving}
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
          disabled={isSaving}
        />
      </div>
    </form>
  );
};

export default EditCanteenAllowance;
