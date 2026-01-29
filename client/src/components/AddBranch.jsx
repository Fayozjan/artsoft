import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import { addBranch, getActiveEmployees } from "../api";

import Button from "./Button";
import SelectEmployee from "./SelectEmployee";

import styles from "./AddBranch.module.scss";

const AddBranch = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    director_id: "",
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
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("director")}</label>
          <SelectEmployee
            data="director"
            options={employees}
            setFormData={setFormData}
            defaultValue={formData.director_id}
            placeholder={t("select")}
          />
        </div>
      </div>
    </form>
  );
};

export default AddBranch;
