import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";

import styles from "./AnprCamera.module.scss";
import { anprCamerasApi, getActiveGates } from "../api";

const AddAnprCamera = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    gate_id: "",
    camera_ip: "",
    port: 80,
    mac_address: "",
    direction: "entry",
    username: "",
    password: "",
    status: true,
  });
  const [gates, setGates] = useState([]);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchGates = async () => {
      try {
        const res = await getActiveGates();
        if (res.success) {
          setGates(res.data);
        }
      } catch (error) {
        console.error("Ошибка при получении данных:", error.message);
      }
    };

    fetchGates();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "status" ? value === "true" : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await anprCamerasApi.add(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        console.log("Ошибка в ответе сервера:", res.data);
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке данных:",
        error.response ? error.response.data : error.message,
      );
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.anprCamera} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addAnprCamera")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="name">{t("name")}</label>
          <input
            type="text"
            name="name"
            value={formData.name ?? ""}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>{t("macAddress")}</label>
          <input
            type="text"
            name="mac_address"
            value={formData.mac_address ?? ""}
            onChange={handleChange}
            placeholder="ac:cb:51:00:00:00"
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("ipAddress")}</label>
          <input
            type="text"
            name="camera_ip"
            value={formData.camera_ip ?? ""}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>{t("port")}</label>
          <input
            type="number"
            name="port"
            value={formData.port ?? ""}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("username")}</label>
          <input
            type="text"
            name="username"
            value={formData.username ?? ""}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>{t("password")}</label>
          <input
            type="text"
            name="password"
            value={formData.password ?? ""}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("direction")}</label>
          <select
            name="direction"
            value={formData.direction ?? ""}
            onChange={handleChange}
          >
            <option value="entry">{t("entry")}</option>
            <option value="exit">{t("exit")}</option>
          </select>
        </div>
        <div>
          <label>{t("gates")}</label>
          <select
            name="gate_id"
            value={formData.gate_id ?? ""}
            onChange={handleChange}
            required
          >
            <option value="">{t("selectGates")}</option>
            {gates?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("status")}</label>
          <select
            name="status"
            value={String(formData.status)}
            onChange={handleChange}
          >
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
        <div />
      </div>
    </form>
  );
};

export default AddAnprCamera;
