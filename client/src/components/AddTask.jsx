import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useAlertStore } from "../stores/alertStore";
import { createTask, updateTask, uploadTaskFile } from "../api";
import { EmployeeService } from "../api/employees";
import Button from "./Button";
import SelectEmployee from "./SelectEmployee";
import styles from "./AddTask.module.scss";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AddTask = ({ initialData, onSuccess, onClose }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const getInitialAssigneeType = (d) => {
    if (!d) return "employee";
    if (d.assignee_employee_id) return "employee";
    if (d.assignee_department_id) return "department";
    if (d.assignee_position_id) return "position";
    if (d.assignee_user_id) return "user";
    return "employee";
  };

  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    priority: initialData?.priority || "medium",
    deadline: initialData?.deadline ? initialData.deadline.slice(0, 10) : "",
    assignee_type: getInitialAssigneeType(initialData),
    employee_id: initialData?.assignee_employee_id || "",
    department_id: initialData?.assignee_department_id || "",
    position_id: initialData?.assignee_position_id || "",
    user_id: initialData?.assignee_user_id || "",
  });

  const [employees, setEmployees] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    EmployeeService.getActive()
      .then((res) => { if (res.success) setEmployees(res.data || []); })
      .catch(console.error);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    const tooBig = selected.filter((f) => f.size > MAX_FILE_SIZE);
    if (tooBig.length) showAlert(t("task.fileTooLarge"), "error");
    const accepted = selected.filter((f) => f.size <= MAX_FILE_SIZE);
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
    e.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (taskId) => {
    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file);
      await uploadTaskFile(taskId, fd);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return showAlert(t("task.titleRequired"), "error");
    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        deadline: formData.deadline || null,
        assignee_employee_id: formData.assignee_type === "employee" && formData.employee_id ? Number(formData.employee_id) : null,
        assignee_department_id: formData.assignee_type === "department" && formData.department_id ? Number(formData.department_id) : null,
        assignee_position_id: formData.assignee_type === "position" && formData.position_id ? Number(formData.position_id) : null,
        assignee_user_id: formData.assignee_type === "user" && formData.user_id ? Number(formData.user_id) : null,
      };

      let taskId = initialData?.id;
      if (taskId) {
        await updateTask(taskId, payload);
      } else {
        const { data } = await createTask(payload);
        taskId = data?.id;
      }

      if (files.length && taskId) {
        try {
          await uploadFiles(taskId);
        } catch (uploadErr) {
          showAlert(t("task.fileUploadError"), "error");
        }
      }

      setFiles([]);
      showAlert(t("success"), "success");
      onSuccess();
    } catch (err) {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.field}>
        <label>{t("task.title")} *</label>
        <input
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder={t("task.titlePlaceholder")}
          required
        />
      </div>

      <div className={styles.field}>
        <label>{t("task.description")}</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder={t("task.descriptionPlaceholder")}
        />
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label>{t("task.priority")}</label>
          <select name="priority" value={formData.priority} onChange={handleChange}>
            <option value="low">{t("priority.low")}</option>
            <option value="medium">{t("priority.medium")}</option>
            <option value="high">{t("priority.high")}</option>
          </select>
        </div>
        <div className={styles.field}>
          <label>{t("task.deadline")}</label>
          <input
            type="date"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.field}>
        <label>{t("task.assignee")}</label>
        <SelectEmployee
          options={employees}
          setFormData={setFormData}
          data="employee"
          placeholder={t("task.assignee")}
          defaultValue={formData.employee_id || null}
        />
      </div>

      <div className={styles.field}>
        <label>{t("task.files")}</label>
        {files.length > 0 && (
          <div className={styles.fileList}>
            {files.map((file, index) => (
              <div className={styles.fileItem} key={`${file.name}-${index}`}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileSize}>{formatSize(file.size)}</span>
                <button
                  type="button"
                  className={styles.fileDelete}
                  onClick={() => handleRemoveFile(index)}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className={styles.uploadBtn}>
          + {t("task.uploadFile")}
          <input type="file" multiple onChange={handleFileSelect} />
        </label>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.btnCancel} onClick={onClose}>
          {t("cancel")}
        </button>
        <Button type="submit" text={t("save")} disabled={loading} />
      </div>
    </form>
  );
};

export default AddTask;
