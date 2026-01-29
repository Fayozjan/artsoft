import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { addDepartment, getActiveBranches } from "../api";

import Button from "./Button";

import styles from "./AddDepartment.module.scss";

const AddDepartment = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    branch_id: "",
  });

  const [branches, setBranches] = useState([]);
  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(false);
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  useEffect(() => {
    const fetchBranches = async () => {
      setLoading(true);
      try {
        const res = await getActiveBranches();

        if (res.success) {
          setBranches(res.data);
        } else {
          console.error("Ошибка");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert("Ошибка", "error");
        setTimeout(() => cancelButton(), 1500);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, []);

  useEffect(() => {
    if (branches?.length === 1) {
      setFormData((prev) => ({
        ...prev,
        branch_id: branches[0].id,
      }));
    }
  }, [branches]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: name === "branch_id" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await addDepartment(formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке данных:",
        error.response?.data || error.message
      );
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addDepartment} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addDepartment")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("name")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("branch")} <span style={{ color: "red" }}>*</span>
          </label>
          <select
            name="branch_id"
            value={formData.branch_id}
            onChange={handleChange}
            required
          >
            <option value="" disabled>
              {t("select")}
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
};

export default AddDepartment;
