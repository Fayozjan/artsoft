import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlertStore } from "../stores/alertStore";
import EXIF from "exif-js";
import {
  getActiveBranches,
  getActivePositions,
  getActiveDoors,
  EmployeeService,
} from "../api";

import { Icons } from "../icons/icons";

import styles from "./AddEmployeeTelegram.module.scss";
import TelegramPageHeader from "./TelegramPageHeader";

const AddEmployeeTelegram = ({ handleClose, onSuccess, isEdit = false }) => {
  const today = new Date().toISOString().split("T")[0];
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [formData, setFormData] = useState({
    order_number: 1,
    order_date: today,
    last_name: "",
    first_name: "",
    middle_name: "",
    pinfl: "",
    branch_id: "",
    department_id: "",
    position_id: "",
    door_ids: [],
    photo: null,
  });

  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [doors, setDoors] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const selectedBranch = branches.find(
    (b) => b.id === Number(formData.branch_id),
  );

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const [b, p, d] = await Promise.all([
          getActiveBranches(),
          getActivePositions(),
          getActiveDoors(),
        ]);
        setBranches(b.data);
        setPositions(p.data);
        setDoors(d.data);
      } catch (err) {
        console.error(err.message);
      }
    };
    fetchInfo();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const fixImageOrientation = (file) =>
    new Promise(async (resolve, reject) => {
      try {
        // Браузер сам применяет EXIF-ориентацию
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });

        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close(); // освобождаем память

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Canvas toBlob failed"));
            resolve({ url: URL.createObjectURL(blob), blob });
          },
          "image/jpeg", // ✅ всегда jpeg, не зависит от исходного формата (heic и др.)
          0.9,
        );
      } catch (err) {
        reject(err);
      }
    });

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const { url, blob } = await fixImageOrientation(file);
        setImagePreview(url);
        const fileName = file.name.replace(/\.[^.]+$/, ".jpg");
        const correctedFile = new File([blob], fileName, {
          type: "image/jpeg",
        });
        setFormData((p) => ({ ...p, photo: correctedFile }));
      } catch (err) {
        console.error("Photo process error:", err);
        setImagePreview(URL.createObjectURL(file));
        setFormData((p) => ({ ...p, photo: file }));
      }
    }
    e.target.value = "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (name === "branch_id") {
        return {
          ...prev,
          branch_id: value,
          department_id: "",
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await EmployeeService.create(formData);
      showAlert(t("success"), "success");
      onSuccess();
    } catch (err) {
      const message = err.response?.data?.error || err.message || "Error";
      showAlert(message, "error");
    }
  };

  return (
    <div className={styles.screenWrapper}>
      <TelegramPageHeader title="Добавление" />

      <form id="employeeForm" className={styles.scrollContent}>
        <div className={styles.photoSection}>
          {imagePreview ? (
            <div className={styles.previewPhoto}>
              <img src={imagePreview} alt="Preview" />
              <div
                className={styles.removeBadge}
                onClick={() => {
                  setImagePreview(null);
                  setFormData((p) => ({ ...p, photo: null }));
                }}
              >
                {"×"}
              </div>
            </div>
          ) : (
            <label className={styles.uploadPlaceholder} htmlFor="photo-upload">
              <div className={styles.uploadCircle}>{Icons.camera || "+"}</div>
              <span>{t("uploadPhoto")}</span>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                hidden
                onChange={handlePhotoChange}
              />
            </label>
          )}
        </div>

        <div className={styles.formSection}>
          <div className={styles.inputGroup}>
            <label>{t("lastName")} *</label>
            <input
              type="text"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label>{t("firstName")} *</label>
            <input
              type="text"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label>{t("pinfl")} *</label>
            <input
              type="text"
              name="pinfl"
              value={formData.pinfl}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label>{t("branch")} *</label>
            <select
              name="branch_id"
              value={formData.branch_id}
              onChange={handleChange}
              required
            >
              <option value="">{t("select")}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label>
              {t("department")} <span style={{ color: "red" }}>*</span>
            </label>
            <select
              name="department_id"
              value={formData.department_id}
              onChange={handleChange}
              disabled={!formData.branch_id}
              required
            >
              <option value="">{t("select")}</option>
              {selectedBranch?.departments?.map((data) => (
                <option key={data.id} value={data.id}>
                  {data.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label>
              {t("position")} <span style={{ color: "red" }}>*</span>
            </label>
            <select
              name="position_id"
              value={formData.position_id}
              onChange={handleChange}
              required
            >
              <option value="">{t("select")}</option>
              {positions &&
                positions.map((data) => (
                  <option key={data.id} value={data.id}>
                    {data.name}
                  </option>
                ))}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label>{t("doors")}</label>
            <select
              name="door_ids"
              multiple
              value={formData.door_ids}
              onChange={(e) => {
                const values = Array.from(
                  e.target.selectedOptions,
                  (option) => option.value,
                );
                setFormData({ ...formData, door_ids: values });
              }}
            >
              {doors.map((door) => (
                <option key={door.id} value={door.id}>
                  {door.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      <div className={styles.footer}>
        <button
          className={styles.applyBtn}
          onClick={() => (onClick = { handleSubmit })}
          form="employeeForm"
          type="submit"
        >
          {t("save") || "Сохранить"}
        </button>
      </div>
    </div>
  );
};

export default AddEmployeeTelegram;
