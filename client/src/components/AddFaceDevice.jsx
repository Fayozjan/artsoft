import axios from "axios";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";

import styles from "./AddFaceDevice.module.scss";
import { addFaceDevice, getActiveDoors } from "../api";

const AddFaceDevice = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    direction: "entry",
    device_ip: "",
    port: 80,
    door_id: "",
    serial_number: "",
    password: "",
    is_local: true,
  });
  const [doors, setDoors] = useState();
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await getActiveDoors();
        if (res.success) {
          setDoors(res.data);
        }
      } catch (error) {
        console.error("Ошибка при получении данных:", error.message);
      }
    };

    fetchDevices();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: name === "is_local" ? value === "true" : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await addFaceDevice(formData);

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
    <form className={styles.addFaceDevice} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addFaceDevice")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="name">{t("name")}</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>{t("password")}</label>
          <input
            type="text"
            name="password"
            value={formData.password}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("serialNumber")}</label>
          <input
            type="text"
            name="serial_number"
            value={formData.serial_number}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="name">{t("direction")}</label>
          <select
            name="direction"
            value={formData.direction}
            onChange={handleChange}
          >
            <option value="entry">{t("entry")}</option>
            <option value="exit">{t("exit")}</option>
            <option value="universal">{t("universal")}</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("ipAddress")}</label>
          <input
            type="text"
            name="device_ip"
            value={formData.device_ip}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>{t("port")}</label>
          <input
            type="text"
            name="port"
            value={formData.port}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("localDevice")}</label>
          <select
            name="is_local"
            value={formData.is_local}
            onChange={handleChange}
          >
            <option value={true}>{t("yes")}</option>
            <option value={false}>{t("no")}</option>
          </select>
        </div>
        <div>
          <div className={styles.inputCol}>
            <label htmlFor="name">{t("door")}</label>
            <select
              name="door_id"
              value={formData.door_id}
              onChange={handleChange}
              required
            >
              <option value="">{t("selectDoor")}</option>
              {doors?.map((item) => (
                <option value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </form>
  );
};

export default AddFaceDevice;
