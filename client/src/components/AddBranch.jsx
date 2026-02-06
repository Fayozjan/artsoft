import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import { addBranch, getActiveEmployees } from "../api";

import Button from "./Button";
import SelectEmployee from "./SelectEmployee";

import styles from "./AddBranch.module.scss";

const AddBranch = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    director_id: "",
    region: "",
    address: "",
    bank_name: "",
    bank_account: "",
    inn: "",
    mfo: "",
  });
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await getActiveEmployees();
        setEmployees(res.data);
      } catch (e) {
        console.error(e);
      }
    };

    fetchEmployees();
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
        const res = await addBranch({ ...formData });

        if (res.success) {
          showAlert(t("success"), "success");
          onSuccess();
        } else {
          console.error("Ошибка в ответе сервера:", res.data);
          showAlert(t("error"), "error");
        }
      } catch (error) {
        console.error(
          "Ошибка при отправке данных:",
          error.response ? error.response.data : error.message,
        );
        showAlert(t("error"), "error");
      } finally {
        setLoading(false);
      }
    },
    [formData],
  );

  return (
    <form className={styles.addBranch} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addEmployee")}</h2>
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
          <label>Статус</label>
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

export default AddBranch;
