import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { getDoor, editDoor } from "../api";
import { getActiveBranches } from "../api/branches";

import Button from "./Button";

import styles from "./AddDoor.module.scss";

const EditDoors = ({ id, handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    status: "",
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
  }, []);

  useEffect(() => {
    getActiveBranches()
      .then((res) => { if (res.success) setBranches(res.data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getDoor(id);
        if (res.success) {
          setFormData({
            name: res.data.name ?? "",
            status: res.data.status !== undefined ? String(res.data.status) : "true",
            branch_id: res.data.branch_id ?? "",
            latitude: res.data.latitude ?? "",
            longitude: res.data.longitude ?? "",
          });
        } else {
          console.error("Ошибка при получении данных двери");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert(t("error"), "error");
        setTimeout(handleClose, 1500);
      }
    };

    fetchData();
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
      const res = await editDoor(id, formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1000);
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке данных:",
        error.response ? error.response.data : error.message
      );
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addDoor} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editDoor")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="name">{t("name")}</label>
          <input
            type="text"
            name="name"
            value={formData?.name}
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
            value={formData?.branch_id}
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
            value={formData?.latitude}
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
            value={formData?.longitude}
            onChange={handleChange}
            placeholder="например: 69.240073"
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("status")}</label>
          <select
            name="status"
            value={formData?.status}
            onChange={handleChange}
          >
            <option value="true">{t("enable")}</option>
            <option value="false">{t("disable")}</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditDoors;
