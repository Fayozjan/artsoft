import { useState, useEffect } from "react";
import axios from "axios";

import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";

import styles from "./EditEmployeeProfile.module.scss";

const EditEmployeeProfile = ({ id, setHasUnsavedChanges }) => {
  const { showAlert } = useAlertStore();
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({});
  const [allWorkSchedule, setAllWorkSchedule] = useState();

  // Получение информации сотрудника
  const fetchUserInfo = async () => {
    try {
      const userResponse = await axios.get(`/api/users/get/${id}`);
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

  // Получение всех рабочих графиков
  const fetchExtraInfo = async () => {
    try {
      const workScheduleResponse = await axios.get(`/api/work-schedule`);
      setAllWorkSchedule(workScheduleResponse.data.schedules);
    } catch (err) {
      console.log(err.message);
    }
  };

  // При изменении обновляем информацию о сотруднике и рабочих графиков
  useEffect(() => {
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
      setHasUnsavedChanges(true);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleChangeImage = (e) => {
    setImagePreview(null);
    setFormData((prevData) => ({ ...prevData, photo: "" }));
    setHasUnsavedChanges(true);
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
      const res = await axios.patch(`/api/users/update/profile/${id}`, data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        showAlert("Успешно", "success");
        await fetchUserInfo();
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      showAlert("Ошибка", "error");
      console.log("Error submitting data:", error);
    }
  };

  const closeAlert = () => setAlert((prev) => ({ ...prev, show: false }));

  return (
    <div className={styles.add_user}>
      <form className={styles.employee_form} onSubmit={handleSubmit}>
        <div className={styles.form_group}>
          <div className={styles.input_fields}>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>Фамилия</label>
                <input
                  type="text"
                  name="surname"
                  value={formData.surname}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.input_col}>
                <label>Имя</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.input_col}>
                <label>Отчество</label>
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
                <label>Дата рождения</label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Пол</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Выберите пол</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>
              <div className={styles.input_col}>
                <label>Место рождения</label>
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
                <label>Паспорт (ID) №</label>
                <input
                  type="text"
                  name="passport"
                  value={formData.passport}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Дата выдачи</label>
                <input
                  type="date"
                  name="passport_given_date"
                  value={formData.passport_given_date}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Срок действия</label>
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
                <label>ПИНФЛ</label>
                <input
                  type="text"
                  name="pinfl"
                  value={formData.pinfl}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.input_col}>
                <label>Национальность</label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Образование</label>
                <select
                  name="education"
                  value={formData.education}
                  onChange={handleChange}
                >
                  <option hidden value="">
                    Выберите ...
                  </option>
                  <option>Высшее</option>
                  <option>Среднее специальное</option>
                  <option>Среднее общее</option>
                </select>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>Специальность</label>
                <input
                  type="text"
                  name="education_specialty"
                  value={formData.education_specialty}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Телефон</label>
                <input
                  type="text"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Почта</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Адрес проживания</label>
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
                <label>Филиал</label>
                <input type="text" value={formData.branch_name} disabled />
              </div>
              <div className={styles.input_col}>
                <label>Отдел</label>
                <input type="text" value={formData.department_name} disabled />
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>Должность</label>
                <input type="text" value={formData.position_name} disabled />
              </div>
              <div className={styles.input_col}>
                <label>Системный ID</label>
                <input type="text" value={formData.user_id} disabled />
              </div>
              <div className={styles.input_col}>
                <label>Табельный номер</label>
                <input
                  name="employee_number"
                  type="text"
                  value={formData.employee_number}
                  onChange={handleChange}
                />
              </div>
              <div className={styles.input_col}>
                <label>Рабочий график</label>
                <select
                  name="work_schedule_id"
                  value={formData.work_schedule_id}
                  onChange={handleChange}
                >
                  <option value="">Выберите</option>
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
                <div className={styles.changeImageButton}>
                  <Button text="Изменить фото" onClick={handleChangeImage} />
                </div>
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
                  <span>Загрузите фото</span>
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
          <Button text="Сохранить" type="submit" />
        </div>
      </form>
    </div>
  );
};

export default EditEmployeeProfile;
