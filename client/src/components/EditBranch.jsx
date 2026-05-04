import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import { editBranchById, getBranchById } from "../api/branches";
import { EmployeeService } from "../api";

import Button from "./Button";
import SelectEmployee from "./SelectEmployee";

import styles from "./AddBranch.module.scss";
import Loading from "./Loading";

const EditBranch = ({ id, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    name: "",
    status: true,
    director_id: "",
    address: "",
  });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [branchRes, employeesRes] = await Promise.all([
        getBranchById(id),
        EmployeeService.getActive(),
      ]);

      if (branchRes.success) setFormData(branchRes.data);
      if (employeesRes.success) setEmployees(employeesRes.data);
    } catch (error) {
      console.error("Ошибка при загрузке данных:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "status" ? value === "true" : value,
    }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await editBranchById(id, formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
      } else {
        console.error("Ошибка в ответе сервера:", res.data);
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error(
        "Ошибка при обновлении данных:",
        error.response ? error.response.data : error.message,
      );
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.addBranch} onSubmit={handleSubmit}>
      {loading && <Loading />}
      <div className={styles.header}>
        <h2>{t("editBranch")}</h2>
        <Button text={t("save")} type="submit" disabled={loading} />
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
            disabled={loading}
          />
        </div>
        <div>
          <label>{t("director")}</label>
          <SelectEmployee
            data="director"
            options={employees}
            setFormData={setFormData}
            defaultValue={formData.director_id}
            placeholder={t("select")}
            disabled={loading}
          />
        </div>
      </div>
      <div className={styles.row}>
        <div>
          <label>{t("region")}</label>
          <input
            type="text"
            name="region"
            value={formData.region}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label>{t("address")}</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
      </div>
      <div className={styles.row}>
        <div>
          <label>{t("bankName")}</label>
          <input
            type="text"
            name="bank_name"
            value={formData.bank_name}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label>{t("bankAccount")}</label>
          <input
            type="text"
            name="bank_account"
            value={formData.bank_account}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
      </div>
      <div className={styles.row}>
        <div>
          <label>{t("inn")}</label>
          <input
            type="text"
            name="inn"
            value={formData.inn}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label>{t("mfo")}</label>
          <input
            type="mfo"
            name="mfo"
            value={formData.mfo}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
        <div>
          <label>{t("status")}</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditBranch;
