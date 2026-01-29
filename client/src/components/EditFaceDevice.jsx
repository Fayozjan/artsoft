import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { editFaceDevice, getActiveDoors, getFaceDevice } from "../api";

import Button from "./Button";

import styles from "./AddFaceDevice.module.scss";

const EditFaceDevice = ({ id, handleClose, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    direction: "",
    device_ip: "",
    port: "",
    door_id: "",
    status: "",
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
        showAlert("Ошибка", "error");
        setTimeout(() => navigate("/doors"), 1500);
      }
    };

    fetchData();
  }, [id]);

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
      const res = await editFaceDevice(id, formData);

      if (res.success) {
        showAlert("Успешно", "success");
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
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
            value={formData?.name}
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
            value={formData?.direction}
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
            value={formData?.device_ip}
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
            value={formData?.port}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label for="name">Дверь</label>
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
          <label>Статус</label>
          <select
            name="status"
            value={formData?.status}
            onChange={handleChange}
          >
            <option value="true">Включить</option>
            <option value="false">Выключить</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditFaceDevice;
