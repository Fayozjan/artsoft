import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { addDoor } from "../api";
import { getActiveBranches } from "../api/branches";

import Button from "./Button";

import styles from "./AddDoor.module.scss";

const AddDoor = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    branch_id: "",
    latitude: "",
    longitude: "",
  });
  const [branches, setBranches] = useState([]);
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();
  const { showAlert } = useAlertStore();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  useEffect(() => {
    getActiveBranches()
      .then((res) => { if (res.success) setBranches(res.data); })
      .catch(() => {});
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await addDoor(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        console.log("Ошибка в ответе сервера:", res.data);
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке данных:",
        error.response ? error.response.data : error.message
      );
      showAlert(t("error"), "error");
      setTimeout(handleClose, 1500);
    }
  };

  return (
    <form className={styles.addDoor} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addDoor")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="name">
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
          <label htmlFor="branch_id">{t("branch")}</label>
          <select
            name="branch_id"
            value={formData.branch_id}
            onChange={handleChange}
          >
            <option value="">{t("notSelected")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="latitude">{t("latitude")}</label>
          <input
            type="number"
            name="latitude"
            step="any"
            value={formData.latitude}
            onChange={handleChange}
            placeholder="например: 41.299496"
          />
        </div>
        <div>
          <label htmlFor="longitude">{t("longitude")}</label>
          <input
            type="number"
            name="longitude"
            step="any"
            value={formData.longitude}
            onChange={handleChange}
            placeholder="например: 69.240073"
          />
        </div>
      </div>
    </form>
  );
};

export default AddDoor;
