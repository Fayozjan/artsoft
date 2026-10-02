import { useState, useEffect } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";

import styles from "./AddEmployeeProfile.module.scss";

const AddEmployeeProfile = ({ userId, setUserId, setActiveTab }) => {
  const [formData, setFormData] = useState({});
  const { showAlert } = useAlertStore();
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);
  const [allWorkSchedule, setAllWorkSchedule] = useState();
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  const fetchUserInfo = async () => {
    try {
      const userResponse = await axios.get(`/api/users/get/${userId}`);
      setFormData(userResponse.data.user);
      setImagePreview(
        userResponse.data.user.photo && userResponse.data.user.photo !== "null"
          ? `${userResponse.data.user.photo}`
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

  useEffect(() => {
    const fetchExtraInfo = async () => {
      try {
        const workScheduleResponse = await axios.get(`/api/work-schedule`);
        setAllWorkSchedule(workScheduleResponse.data.schedules);
      } catch (err) {
        console.log(err.message);
      }
    };

    fetchExtraInfo();
    if (userId) {
      fetchUserInfo();
    }
  }, []);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleChangeImage = (e) => {
    setImagePreview(null);
    setFile(null);
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
      const res = await axios.post("/api/users/update/profile/add", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        showAlert(t("success"), "success");
        setUserId(res.data.result.user_id);
        setTimeout(() => setActiveTab("job"), 1000);
      }
    } catch (error) {
      showAlert(t("error"), "error");
      console.log("Error submitting data:", error);
    }
  };

  return (
    <div className={styles.add_user}>
      <form className={styles.employee_form} onSubmit={handleSubmit}>
        <div className={styles.form_group}>
          <div className={styles.input_fields}>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.surname")}</label>
                <input
                  type="text"
                  name="surname"
                  value={formData.surname}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.name")}</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.patronymic")}</label>
                <input
                  type="text"
                  name="patronymic"
                  value={formData.patronymic}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.dateOfBirth")}</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.sex")}</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="male">
                    {t("employeesPage.addEmployee.male")}
                  </option>
                  <option value="female">
                    {t("employeesPage.addEmployee.female")}
                  </option>
                </select>
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.placeOfBirth")}</label>
                <input
                  type="text"
                  name="place_of_birth"
                  value={formData.place_of_birth}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.passport")}</label>
                <input
                  type="text"
                  name="passport"
                  value={formData.passport}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>
                  {t("employeesPage.addEmployee.passportDateOfIssue")}
                </label>
                <input
                  type="date"
                  name="passport_given_date"
                  value={formData.passport_given_date}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>
                  {t("employeesPage.addEmployee.passportDateOfExpiration")}
                </label>
                <input
                  type="date"
                  name="passport_validity_period"
                  value={formData.passport_validity_period}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.pinfl")}</label>
                <input
                  type="text"
                  name="pinfl"
                  value={formData.pinfl}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.nationality")}</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.education")}</label>
                <select
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                >
                  <option hidden value="">
                    {t("employeesPage.addEmployee.select")}
                  </option>
                  <option value="Higher">
                    {t("employeesPage.addEmployee.higherEdu")}
                  </option>
                  <option value="Secondary">
                    {t("employeesPage.addEmployee.secondaryEdu")}
                  </option>
                  <option value="General">
                    {t("employeesPage.addEmployee.generalEdu")}
                  </option>
                </select>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.speciality")}</label>
                <input
                  type="text"
                  name="education_speciality"
                  value={formData.education_speciality}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.phoneNumber")}</label>
                <input
                  type="text"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.email")}</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.address")}</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.branch")}</label>
                <input type="text" value={formData.branch_name} disabled />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.department")}</label>
                <input type="text" value={formData.department_name} disabled />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.position")}</label>
                <input type="text" value={formData.position_name} disabled />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.employeeNumber")}</label>
                <input
                  type="text"
                  name="employee_number"
                  value={formData.employee_number}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>{t("employeesPage.addEmployee.workSchedule")}</label>
                <select
                  name="work_schedule_id"
                  value={formData.work_schedule_id}
                  onChange={handleChange}
                >
                  <option value="">
                    {t("employeesPage.addEmployee.select")}
                  </option>
                  {allWorkSchedule &&
                    allWorkSchedule.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
          <div className={styles.input_file}>
            {imagePreview ? (
              <div className={styles.previewContainer}>
                <img
                  src={imagePreview}
                  alt="Selected"
                  className={styles.previewImage}
                />
                <button
                  type="button"
                  className={styles.changeImageButton}
                  onClick={handleChangeImage}
                >
                  {t("changePhoto")}
                </button>
              </div>
            ) : (
              <div className={styles.uploadContainer}>
                <label htmlFor="photo-upload" className={styles.uploadLabel}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={styles.uploadIcon}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span>{t("employeesPage.addEmployee.uploadPhoto")}</span>
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
        </div>

        <div className={styles.buttons}>
          <Button text={t("button.saveAndNext")} type={"submit"} />
        </div>
      </form>
    </div>
  );
};

export default AddEmployeeProfile;
