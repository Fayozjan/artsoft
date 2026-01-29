import axios from "axios";
import { useState, useEffect } from "react";

import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";
import Loading from "./Loading";

import styles from "./EditEmployeeJob.module.scss";

const EditEmployeeJob = ({ id }) => {
  const { showAlert } = useAlertStore();
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  const initialFormData = {
    event_type: "",
    event_date: "",
    order_number: "",
    branch_id: "",
    department_id: "",
    position_id: "",
    description: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    const fetchExtraInfo = async () => {
      try {
        const branchesResponse = await axios.get(`/api/branch`);
        setBranches(branchesResponse.data.data);

        const departmentsResponse = await axios.get(`/api/departments`);
        setDepartments(departmentsResponse.data.data);

        const positionResponse = await axios.get(`/api/position`);
        setPositions(positionResponse.data.data);
      } catch (err) {
        console.log(err.message);
      }
    };

    fetchExtraInfo();
  }, [id]);

  const handleBranchChange = (e) => {
    const branch_id = +e.target.value;
    setFormData((prevData) => ({
      ...prevData,
      branch_id: branch_id,
      department_id: null,
    }));
    const filtered = departments.filter((dep) => dep.branch_id === branch_id);
    setFilteredDepartments(filtered);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: ["department_id", "position_id"].includes(name) ? +value : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`/api/users/update/work/${id}`, formData);

      if (res.data.success) {
        showAlert("Успешно", "success");
        setFormData(initialFormData);
        setFilteredDepartments([]);
      }
      setLoading(false);
    } catch (error) {
      showAlert("Ошибка", "error");
      setLoading(false);
    }
  };

  return (
    <div className={styles.user_job}>
      <form className={styles.employee_form} onSubmit={handleSubmit}>
        <div className={styles.form_group}>
          <div className={styles.input_fields}>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>Тип события</label>
                <select
                  name="event_type"
                  value={formData.event_type}
                  onChange={handleChange}
                >
                  <option value="">Выберите...</option>
                  <option value="hired">Найм сотрудника</option>
                  <option value="promotion">Изменение должности</option>
                  <option value="transfer">
                    Перевод в другой отдел или филиал
                  </option>
                  <option value="leave">Уход в отпуск</option>

                  <option value="termination">
                    Увольнение (по собственному желанию или по статье)
                  </option>
                  <option value="reinstated">Повторный прием на работу</option>
                </select>
              </div>
              <div className={styles.input_col}>
                <label>Дата события</label>
                <input
                  type="date"
                  name="event_date"
                  value={formData.event_date}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.input_col}>
                <label>Приказ №</label>
                <input
                  type="text"
                  name="order_number"
                  value={formData.order_number}
                  onChange={handleChange}
                />
              </div>
            </div>
            {["hired", "promotion", "transfer", "reinstated"].includes(
              formData.event_type
            ) && (
              <div className={styles.row}>
                <div className={styles.input_col}>
                  <label>Филиал</label>
                  <select
                    name="branch_id"
                    value={formData.branch_id}
                    onChange={handleBranchChange}
                    required
                  >
                    <option value="">Выберите филиал</option>
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
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Выберите отдел</option>
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
                    name="position_id"
                    value={formData.position_id}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Выберите должность</option>
                    {positions.map((dep) => (
                      <option key={dep.id} value={dep.id}>
                        {dep.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>Описание</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>
        <div className={styles.buttons}>
          <Button text="Сохранить" type="submit" />
        </div>
      </form>
      <div className={styles.user_timeline}></div>
      {loading && <Loading />}
    </div>
  );
};

export default EditEmployeeJob;
