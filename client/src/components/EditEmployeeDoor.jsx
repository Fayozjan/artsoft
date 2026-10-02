import axios from "axios";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";
import { Icons } from "../icons/icons";

import styles from "./EditEmployeeDoor.module.scss";

const EditEmployeeDoor = ({ id }) => {
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);
  const [allDoor, setAllDoor] = useState();
  const [formData, setFormData] = useState({});

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userResponse = await axios.get(`/api/users/get/${id}`);
        setFormData({
          ...userResponse.data.user,
          door:
            userResponse.data.user.door === null
              ? []
              : userResponse.data.user.door,
        });
        setImagePreview(
          userResponse.data.user.photo &&
            userResponse.data.user.photo !== "null"
            ? `/${userResponse.data.user.photo}`
            : ""
        );

        if (userResponse.data.user.photo) {
          // Создайте объект File из ссылки на фото
          const fileFromUrl = await fetchFileFromUrl(
            userResponse.data.user.photo
          );
          setFile(fileFromUrl);
        }
      } catch (err) {
        console.log(err.message);
      }
    };

    const fetchExtraInfo = async () => {
      try {
        const doorsResponse = await axios.get(`/api/doors`);
        setAllDoor(doorsResponse.data.data);
      } catch (err) {
        console.log(err.message);
      }
    };

    fetchExtraInfo();
    fetchUserInfo();
  }, [id]);

  const fetchFileFromUrl = async (url) => {
    const response = await axios(`/${url}`);
    const blob = await response.blob();
    const fileName = url.split("/").pop();
    return new File([blob], fileName, { type: blob.type });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    if (selectedFile) {
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleDoorChange = (e, door_id) => {
    const { checked } = e.target;

    setFormData((prevFormData) => {
      let updatedDoors = [...prevFormData.door];

      if (checked) {
        updatedDoors.push(door_id);
      } else {
        updatedDoors = updatedDoors.filter((d) => d !== door_id);
      }

      return {
        ...prevFormData,
        door: updatedDoors,
      };
    });
  };

  const handleChangeImage = (e) => {
    setImagePreview(null);
    setFormData((prevData) => ({ ...prevData, photo: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();

    // Добавьте все простые поля
    Object.entries(formData).forEach(([key, value]) => {
      // Если значение является массивом объектов (например, door), сериализуйте его
      if (Array.isArray(value)) {
        data.append(key, JSON.stringify(value)); // Преобразуем массив объектов в строку
      } else if (value !== null && value !== undefined) {
        // Убедитесь, что null или undefined значения не добавляются
        data.append(key, value);
      }
    });

    if (file instanceof File) {
      data.append("photo", file);
    }

    try {
      const res = await axios.patch(`/api/users/update/door/${id}`, data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        showAlert(t("success"), "success");
        setTimeout(() => cancelButton(), 1500);
      }
    } catch (error) {
      showAlert(t("error"), "error");
      console.log("Error submitting data:", error);
    }
  };

  return (
    <div className={styles.add_user}>
      <form className={styles.employee_form} onSubmit={handleSubmit}>
        <div className={styles.input_file}>
          {imagePreview ? (
            <div className={styles.previewContainer}>
              <img
                src={imagePreview}
                alt="Selected"
                className={styles.previewImage}
              />
              <div className={styles.changeImageButton}>
                <Button text="{t("changePhoto")}" onClick={handleChangeImage} />
              </div>
            </div>
          ) : (
            <div className={styles.uploadContainer}>
              <label htmlFor="photo-upload" className={styles.uploadLabel}>
                <span className={styles.uploadIcon}>{Icons.uploadPlus}</span>
                <span>{t("uploadPhoto")}</span>
              </label>
              <input
                id="photo-upload"
                type="file"
                name="photo"
                onChange={handleFileChange}
                className={styles.hiddenInput}
              />
            </div>
          )}
        </div>
        <div className={styles.input_fields}>
          <label>{t("doors")}</label>
          <div className={styles.checkbox}>
            {allDoor &&
              allDoor.map((door) => (
                <span key={door.id}>
                  <input
                    type="checkbox"
                    id={door.id}
                    value={door.id}
                    checked={
                      formData.door && formData.door.some((d) => d === door.id)
                    }
                    onChange={(e) => handleDoorChange(e, door.id)}
                  />
                  <label>{door.name}</label>
                </span>
              ))}
          </div>
        </div>
      </form>
      <div className={styles.buttons}>
        <Button text={t("save")} onClick={handleSubmit} />
      </div>
    </div>
  );
};

export default EditEmployeeDoor;
