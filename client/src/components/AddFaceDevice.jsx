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
    port: "80",
    door_id: "",
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
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await addFaceDevice(formData);

      if (res.success) {
        showAlert("Успешно", "success");
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
        error.response ? error.response.data : error.message
      );
      showAlert("Ошибка", "error");
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
          <label for="name">Название</label>
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
          <label for="name">Направление</label>
          <select
            name="direction"
            value={formData.direction}
            onChange={handleChange}
          >
            <option value="entry">Вход</option>
            <option value="exit">Выход</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>IP адресс</label>
          <input
            type="text"
            name="device_ip"
            value={formData.device_ip}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>Порт</label>
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
          <div className={styles.inputCol}>
            <label for="name">Дверь</label>
            <select
              name="door_id"
              value={formData.door_id}
              onChange={handleChange}
            >
              <option value="">Выберите дверь</option>
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
