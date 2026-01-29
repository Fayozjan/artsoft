import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import { addPosition } from "../api";

import Button from "./Button";

import styles from "./AddPosition.module.scss";

const AddPosition = ({ handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
  });

  const { showAlert } = useAlertStore();

  const { t } = useTranslation();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await addPosition(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        console.log("Ошибка в ответе сервера:", res.data);
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке данных:",
        error.response ? error.response.data : error.message
      );
      showAlert(t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.addPosition} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addPosition")}</h2>
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
            disabled={isLoading}
          />
        </div>
      </div>
    </form>
  );
};

export default AddPosition;
