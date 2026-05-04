import { useState, useEffect } from "react";
import axios from "axios";

import { useAlertStore } from "../stores/alertStore";

import Loading from "./Loading";
import { motion } from "framer-motion";

import styles from "./EditEmploymentOrderById.module.scss";

const EditEmploymentOrderById = ({ id, onClickClose, setHistory }) => {
  const { showAlert } = useAlertStore();
  const [departments, setDepartments] = useState([]);
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const [filteredDepartments, setFilteredDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    event_type: "",
    event_date: "",
    order_number: "",
    branch_id: "",
    department_id: "",
    position_id: "",
    description: "",
  });

  useEffect(() => {
    const fetchExtraInfo = async () => {
      try {
        const branchesResponse = await axios.get(`/api/branch`);
        setBranches(branchesResponse.data.data);

        const departmentsResponse = await axios.get(`/api/departments`);
        setDepartments(departmentsResponse.data.data);

        const positionResponse = await axios.get(`/api/position`);
        setPositions(positionResponse.data.data);

        const historyResponse = await axios.get(`/api/user/history/${id}`);
        setFormData(historyResponse.data[0]);
      } catch (err) {
        console.log(err.message);
      }
    };

    fetchExtraInfo();
  }, [id]);

  useEffect(() => {
    if (formData.branch_id && departments.length > 0) {
      const filtered = departments.filter(
        (dep) => dep.branch_id === formData.branch_id,
      );
      setFilteredDepartments(filtered);
    }
  }, [formData.branch_id, departments]);

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
      const res = await axios.patch(`/api/users/update/work/${id}`, formData);

      if (res.data.success) {
        showAlert(t("success"), "success");
        setTimeout(() => {
          onClickClose();
          setHistory([]);
        }, 1500);
      }
      setLoading(false);
    } catch (error) {
      showAlert(t("error"), "error");
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <motion.div
        className={styles.user_job}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.3 }}
      >
        <svg
          className={styles.cancel}
          onClick={() => onClickClose()}
          viewBox="0 0 256 256"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect fill="none" height="256" width="256" />
          <line
            fill="none"
            stroke="#000"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="24"
            x1="200"
            x2="56"
            y1="56"
            y2="200"
          />
          <line
            fill="none"
            stroke="#000"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="24"
            x1="200"
            x2="56"
            y1="200"
            y2="56"
          />
        </svg>
        <form className={styles.employee_form} onSubmit={handleSubmit}>
          <div className={styles.form_group}>
            <div className={styles.input_fields}>
              <div className={styles.row}>
                <div className={styles.input_col}>
                  <label>{t("eventType")}</label>
                  <select
                    name="event_type"
                    value={formData?.event_type}
                    onChange={handleChange}
                  >
                    <option value="">{t("selectOption")}</option>
                    <option value="hired">{t("hiredEvent")}</option>
                    <option value="promotion">{t("promotionEvent")}</option>
                    <option value="transfer">{t("transferEvent")}</option>
                    <option value="leave">{t("leaveEvent")}</option>

                    <option value="termination">{t("terminationEvent")}</option>
                    <option value="reinstated">{t("reinstatedEvent")}</option>
                  </select>
                </div>
                <div className={styles.input_col}>
                  <label>{t("eventDate")}</label>
                  <input
                    type="date"
                    name="event_date"
                    value={
                      formData?.event_date
                        ? formData.event_date.slice(0, 10)
                        : ""
                    }
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.input_col}>
                  <label>{t("orderNumber")}</label>
                  <input
                    type="text"
                    name="order_number"
                    value={formData?.order_number}
                    onChange={handleChange}
                  />
                </div>
              </div>
              {["hired", "promotion", "transfer", "reinstated"].includes(
                formData.event_type,
              ) && (
                <div className={styles.row}>
                  <div className={styles.input_col}>
                    <label>{t("branch")}</label>
                    <select
                      name="branch_id"
                      value={formData?.branch_id}
                      onChange={handleBranchChange}
                      required
                    >
                      <option value="">{t("selectBranch")}</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.input_col}>
                    <label>{t("department")}</label>
                    <select
                      name="department_id"
                      value={formData?.department_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">{t("selectDepartment")}</option>
                      {filteredDepartments.map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.input_col}>
                    <label>{t("position")}</label>
                    <select
                      name="position_id"
                      value={formData?.position_id}
                      onChange={handleChange}
                      required
                    >
                      <option value="">{t("selectPosition")}</option>
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
                  <label>{t("note")}</label>
                  <input
                    type="text"
                    name="description"
                    value={formData?.description}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.buttons}>
            <button type="submit" className={`${styles.btn} ${styles.save}`}>
              {t("save")}
            </button>
          </div>
        </form>
        {loading && <Loading />}
      </motion.div>
    </div>
  );
};

export default EditEmploymentOrderById;
