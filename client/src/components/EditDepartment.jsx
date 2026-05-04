import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";

import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";

import styles from "./AddDepartment.module.scss";

import {
  editDepartmentById,
  getActiveBranches,
  getDepartmentById,
} from "../api";

const EditDepartment = ({ id, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({
    name: "",
    branch_id: null,
    status: null,
  });

  const [branches, setBranches] = useState([]);
  const [showAllBranches, setShowAllBranches] = useState(false);
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const branchesRes = await getActiveBranches();
        if (branchesRes.success) {
          setBranches(branchesRes.data);
        } else {
          console.error("Ошибка при получении списка филиалов");
        }

        const departmentRes = await getDepartmentById(id);
        if (departmentRes.success) {
          setFormData(departmentRes.data);
        } else {
          console.error("Ошибка при получении списка филиалов");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert(t("error"), "error");
        setTimeout(() => cancelButton(), 1500);
      }
    };

    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]:
        name === "branch_id"
          ? Number(value)
          : name === "status"
          ? value === "true"
          : value,
    }));
  };

  const handleBranchFocus = () => {
    setShowAllBranches(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await editDepartmentById(id, formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
      }
    } catch (error) {
      console.error(
        "Ошибка при обновлении данных:",
        error.response ? error.response.data : error.message
      );
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addDepartment} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editDepartment")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("name")}</label>
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
          <label>{t("branch")}</label>
          <select
            name="branch_id"
            value={formData.branch_id}
            onChange={handleChange}
            onFocus={handleBranchFocus}
            required
          >
            {!showAllBranches && formData.branch_id ? (
              <option value={formData.branch_id} disabled>
                {branches.find((b) => b.id === formData.branch_id)?.name}
              </option>
            ) : (
              <option value="" disabled>
                {t("select")}
              </option>
            )}
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("status")}</label>
          <select name="status" value={formData.status} onChange={handleChange}>
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditDepartment;
