import { useState, useEffect } from "react";
import axios from "axios";

import { useAlertStore } from "../stores/alertStore";

import Loading from "./Loading";
import Button from "./Button";

import styles from "./AddEmployeeJob.module.scss";

const AddEmployeeJob = ({ userId, setActiveTab }) => {
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(false);

  const initialFormData = {
    event_type: "hired",
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
  }, []);

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
      const res = await axios.post(
        `/api/users/update/work/${userId}`,
        formData
      );

      if (res.data.success) {
        showAlert("Успешно", "success");
        setTimeout(() => setActiveTab("door"), 1000);
      }
      setLoading(false);
    } catch (error) {
      showAlert("Ошибка", "error");
      setLoading(false);
    }
  };

  return (
    <div className={styles.add_user}>
      <form className={styles.employee_form} onSubmit={handleSubmit}>
        <div className={styles.form_group}>
          <div className={styles.input_fields}>
            <div className={styles.row}>
              <div className={styles.input_col}>
                <label>Дата</label>
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
          <Button text={"Сохранить и далее"} type="submit" />
        </div>
      </form>
      {loading && <Loading />}
    </div>
  );
};

export default AddEmployeeJob;
