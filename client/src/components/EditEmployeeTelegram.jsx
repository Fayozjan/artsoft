import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAlertStore } from "../stores/alertStore";

import {
  EmployeeService,
  getActiveBranches,
  getActivePositions,
  getActiveDoors,
} from "../api";
import { Icons } from "../icons/icons";
import styles from "./EditEmployeeTelegram.module.scss";
import TelegramPageHeader from "./TelegramPageHeader";
import Loading from "./Loading";

const EditEmployeeTelegram = ({ id, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const today = new Date().toISOString().split("T")[0];

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
  const [loading, setLoading] = useState(false);

  const selectedBranch = branches.find(
    (b) => b.id === Number(formData.branch_id),
  );

  useEffect(() => {
    const fetchInfo = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [bRes, pRes, dRes, empRes] = await Promise.all([
          getActiveBranches(),
          getActivePositions(),
          getActiveDoors(),
          EmployeeService.getById(id),
        ]);

        setBranches(bRes.data);
        setPositions(pRes.data);
        setDoors(dRes.data);

        const emp = empRes.data;
        const currentOrder = emp.employmentOrders?.at(-1);

        const initialData = {
          ...emp,
          order_number: currentOrder?.order_number || 1,
          order_date: currentOrder?.date?.slice(0, 10) || today,
          branch_id: currentOrder?.branch_id || "",
          department_id: currentOrder?.department_id || "",
          position_id: currentOrder?.position_id || "",
          door_ids: emp.door_ids || [],
          photo: null,
        };

        setFormData(initialData);
        if (emp.photo) {
          const timestamp = emp.updated_at
            ? new Date(emp.updated_at).getTime()
            : Date.now();
          setImagePreview(`/api/employees/image/${emp.photo}?t=${timestamp}`);
        }
      } catch (err) {
        console.error(err);
        showAlert(t("errorLoading"), "error");
      } finally {
        setLoading(false);
      }
    };
    fetchInfo();
  }, [id, showAlert, t, today]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:"))
        URL.revokeObjectURL(imagePreview);
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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "branch_id" ? { department_id: "" } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await EmployeeService.update(id, formData);
      showAlert(t("success"), "success");
      onSuccess();
      handleClose();
    } catch (err) {
      showAlert(err.response?.data?.error || err.message, "error");
    }
  };

  return (
    <div className={styles.screenWrapper}>
      <TelegramPageHeader title="Изменение" />

      <form id="employeeForm" className={styles.scrollContent}>
        <div className={styles.photoSection}>
          {imagePreview ? (
            <div className={styles.previewPhoto}>
              <img key={imagePreview} src={imagePreview} alt="Preview" />
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
            <label>{t("department")} *</label>
            <select
              name="department_id"
              value={formData.department_id}
              onChange={handleChange}
              disabled={!formData.branch_id}
              required
            >
              <option value="">{t("select")}</option>
              {selectedBranch?.departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.inputGroup}>
            <label>{t("position")} *</label>
            <select
              name="position_id"
              value={formData.position_id}
              onChange={handleChange}
              required
            >
              <option value="">{t("select")}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
                  (o) => o.value,
                );
                setFormData((p) => ({ ...p, door_ids: values }));
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
          onClick={handleSubmit}
          form="employeeForm"
          type="submit"
        >
          {t("save") || "Сохранить"}
        </button>
      </div>

      {loading && <Loading />}
    </div>
  );
};

export default EditEmployeeTelegram;
