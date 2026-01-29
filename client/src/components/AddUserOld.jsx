import { useState, useEffect } from "react";
import axios from "axios";
import styles from "./AddUser.module.scss";
import Alert from "./Alert";

const AddUserOld = ({ cancelButton }) => {
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [alert, setAlert] = useState({ message: "", type: "", show: false });
  const [imagePreview, setImagePreview] = useState(null);
  const [file, setFile] = useState(null);
  const [allDoor, setAllDoor] = useState();
  const [allWorkSchedule, setAllWorkSchedule] = useState();

  const [formData, setFormData] = useState({
    surname: "",
    name: "",
    patronymic: "",
    date_of_birth: "",
    gender: "",
    place_of_birth: "",
    passport: "",
    passport_given_date: "",
    passport_validity_period: "",
    pinfl: "",
    nationality: "",
    education: "",
    family: "",
    telephone: "",
    email: "",
    address: "",
    branch: "",
    department: "",
    position: "",
    order_number: "",
    date_of_employment: "",
    date_of_dismissal: "",
    door: "",
    work_schedule_id: "",
    status: true,
  });

  useEffect(() => {
    const fetchBranchesAndDepartments = async () => {
      try {
        const branchesResponse = await axios.get(`/api/branch`);
        setBranches(branchesResponse.data.data);

        const departmentsResponse = await axios.get(`/api/departments`);
        setDepartments(departmentsResponse.data.data);

        const positionResponse = await axios.get(`/api/position`);
        setPositions(positionResponse.data.data);

        const doorsResponse = await axios.get(`/api/doors`);
        setAllDoor(doorsResponse.data.data);

        const workScheduleResponse = await axios.get(`/api/work-schedule`);
        setAllWorkSchedule(workScheduleResponse.data.schedules);
      } catch (err) {
        console.log(err.message);
      }
    };

    fetchBranchesAndDepartments();
  }, []);

  const handleBranchChange = (e) => {
    const branch_id = +e.target.value;
    setSelectedBranch(branch_id);
    setFormData((prevData) => ({ ...prevData, branch: branch_id }));

    // Фильтруем отделы по выбранному филиалу
    const filtered = departments.filter((dep) => dep.branch_id === branch_id);
    setFilteredDepartments(filtered);
    setFormData((prevData) => ({ ...prevData, department: "" })); // Сбрасываем выбранный отдел
  };

  const handleButtonClick = () => {
    cancelButton();
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = new FormData();
    // Добавьте все простые поля
    Object.entries(formData).forEach(([key, value]) => {
      // Если значение является массивом объектов (например, door), сериализуйте его
      if (Array.isArray(value)) {
        data.append(key, JSON.stringify(value)); // Преобразуем массив объектов в строку
      } else {
        data.append(key, value);
      }
    });
    if (file) {
      data.append("photo", file);
    }

    try {
      const res = await axios.post(`/api/users/create`, data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        setAlert({
          message: "Сотрудник успешно добавлен!",
          type: "good",
          show: true,
        });
        setTimeout(() => cancelButton(), 1500);
      }
    } catch (error) {
      setAlert({
        message: "Ошибка при добавлении сотрудника!",
        type: "bad",
        show: true,
      });
      console.log("Error submitting data:", error);
    }
  };

  const closeAlert = () => setAlert((prev) => ({ ...prev, show: false }));
  return (
    <div className={styles.overlay}>
      <div className={styles.add_user}>
        <h1>Добавить сотрудника</h1>
        <div className={styles.container}>
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
                    <label>Паспорт №</label>
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
                    <select
                      name="branch"
                      value={selectedBranch}
                      onChange={handleBranchChange}
                      required
                    >
                      <option value="">Выберите филиал ...</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.input_col}>
                    <label>Отдел</label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Выберите отдел ...</option>
                      {filteredDepartments.map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.input_col}>
                    <label>Должность</label>
                    <select
                      name="position"
                      value={formData.position}
                      onChange={handleChange}
                    >
                      <option value="">Выберите должность ...</option>
                      {positions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.row}>
                  <div className={styles.input_col}>
                    <label>Приказ №</label>
                    <input
                      type="text"
                      name="order_number"
                      value={formData.order_number}
                      onChange={handleChange}
                    />
                  </div>
                  <div className={styles.input_col}>
                    <label>Дата приёма</label>
                    <input
                      type="date"
                      name="date_of_employment"
                      value={formData.date_of_employment}
                      onChange={handleChange}
                    />
                  </div>
                  {formData.status !== true && (
                    <div className={styles.input_col}>
                      <label>Дата уволнения</label>
                      <input
                        type="date"
                        name="date_of_dismissal"
                        value={formData.date_of_dismissal}
                        onChange={handleChange}
                      />
                    </div>
                  )}
                  <div className={styles.input_col}>
                    <label>Двери</label>
                    <div className={styles.checkbox}>
                      {allDoor &&
                        allDoor.map((door) => (
                          <div>
                            <input
                              type="checkbox"
                              id={door.id}
                              value={door.id}
                              checked={
                                formData.door &&
                                formData.door.some((d) => d === door.id)
                              }
                              onChange={(e) => handleDoorChange(e, door.id)}
                            />
                            <label>{door.name}</label>
                          </div>
                        ))}
                    </div>
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
                  <div className={styles.input_col}>
                    <label>Статус</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                    >
                      <option value={true}>Включить</option>
                      <option value={false}>Выключить</option>
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
                      onClick={() => setImagePreview(null)}
                    >
                      Изменить фото
                    </button>
                  </div>
                ) : (
                  <div className={styles.uploadContainer}>
                    <label
                      htmlFor="photo-upload"
                      className={styles.uploadLabel}
                    >
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

                {/* <label className={styles.label_file}>
                Выберите документ
                <input
                  type='file'
                  name=''
                  id='doc-file'
                  className={styles.hidden_input_file}
                />
              </label> */}

                <div className={styles.buttons}>
                  <button
                    onClick={handleButtonClick}
                    type="button"
                    className={`${styles.btn} ${styles.cancel}`}
                  >
                    Назад
                  </button>
                  <button
                    type="submit"
                    className={`${styles.btn} ${styles.save}`}
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
        {alert.show && (
          <Alert
            message={alert.message}
            onClose={closeAlert}
            type={alert.type}
          />
        )}
      </div>
    </div>
  );
};

export default AddUserOld;
