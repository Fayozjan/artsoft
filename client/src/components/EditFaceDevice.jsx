import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { editFaceDevice, getActiveDoors, getFaceDevice } from "../api";

import Button from "./Button";

import styles from "./AddFaceDevice.module.scss";

const EditFaceDevice = ({ id, handleClose, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({
    name: "",
    direction: "",
    device_ip: "",
    port: 80,
    door_id: "",
    serial_number: "",
    password: "",
    is_local: true,
  });
  const [doors, setDoors] = useState();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [faceDevice, doorsRes] = await Promise.all([
          getFaceDevice(id),
          getActiveDoors(),
        ]);

        if (faceDevice.success) {
          setFormData(faceDevice.data);
        } else {
          console.error("Ошибка при получении данных устройства");
        }

        if (doorsRes.success) {
          setDoors(doorsRes.data);
        } else {
          console.error("Ошибка при получении списка дверей");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert(t("error"), "error");
        setTimeout(() => navigate("/doors"), 1500);
      }
    };

    fetchData();
  }, [id]);

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
      const res = await editFaceDevice(id, formData);

      if (res.success) {
        showAlert(t("success"), "success");
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
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
        <h2>{t("editFaceDevice")}</h2>
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
          <label>{t("direction")}</label>
          <select
            name="direction"
            value={formData?.direction}
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
            value={formData?.device_ip}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>{t("port")}</label>
          <input
            type="text"
            name="port"
            value={formData?.port}
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
          <label>{t("door")}</label>
          <select
            name="door_id"
            value={formData?.door_id}
            onChange={handleChange}
          >
            {doors?.map((item) => (
              <option value={item.id}>{item.name}</option>
            ))}
          </select>
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

export default EditFaceDevice;
