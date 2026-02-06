import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import { getActiveBranches, getActivePositions, getEmployeeById } from "../api";
import { addEmploymentOrder } from "../api/employmentOrders";

import Button from "./Button";
import Loading from "./Loading";

import styles from "./AddEmploymentOrder.module.scss";

const AddEmploymentOrder = ({
  employeeId,
  employmentOrderType,
  handleClose,
  updateEmployeeDataFunction,
}) => {
  const [formData, setFormData] = useState({
    employeeId,
    type: employmentOrderType,
    order_date: new Date().toISOString().slice(0, 10),
  });
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      employeeId,
      type: employmentOrderType,
    }));
  }, [employeeId, employmentOrderType]);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        setLoading(true);

        const [branchesRes, positionsRes, employeeRes] = await Promise.all([
          getActiveBranches(),
          getActivePositions(),
          getEmployeeById(employeeId),
        ]);

        setBranches(branchesRes.data);
        setPositions(positionsRes.data);
        setFormData((prev) => ({
          ...prev,
          branch_id: employeeRes.data.branch_id,
        }));
      } catch (err) {
        console.error(err);
        showAlert({
          type: "error",
          message: t("error"),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [employeeId]);

  useEffect(() => {
    if (branches?.length === 1) {
      setFormData((prev) => ({
        ...prev,
        branch_id: branches[0].id,
      }));
    }
  }, [branches]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      const res = await addEmploymentOrder(formData);

      if (!res?.success) {
        throw new Error(res?.error || t("error"));
      }

      showAlert(t("success"), "success");
      updateEmployeeDataFunction();
      handleClose();
    } catch (err) {
      console.error(err);
      showAlert(err?.response?.data?.message || t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  console.log("employmentOrderType", employmentOrderType);

  return (
    <form className={styles.addEmploymentOrder} onSubmit={handleSubmit}>
      {loading && <Loading />}

      <div className={styles.header}>
        <h2>{t("addingEmploymentOrder")}</h2>
        <svg
          onClick={() => handleClose()}
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 304 384"
        >
          <path
            fill="#000000"
            d="M299 73L179 192l120 119l-30 30l-120-119L30 341L0 311l119-119L0 73l30-30l119 119L269 43z"
          />
        </svg>
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("orderNumber")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="order_number"
            value={formData.order_number}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>
            {t("orderDate")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="date"
            name="order_date"
            value={formData.order_date}
            onChange={handleChange}
            onFocus={(e) => e.target.showPicker?.()}
            required
          />
        </div>
      </div>

      {employmentOrderType != "terminate" && (
        <>
          <div className={styles.row}>
            {employmentOrderType != "transfer" && (
              <div>
                <label>
                  {t("branch")} <span style={{ color: "red" }}>*</span>
                </label>
                <select
                  name="branch_id"
                  value={formData.branch_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">{t("select")}</option>
                  {branches &&
                    branches.map((data) => (
                      <option key={data.id} value={data.id}>
                        {data.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
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
                {formData?.branch_id &&
                  branches &&
                  branches
                    .find((b) => b.id === Number(formData.branch_id))
                    ?.departments.map((data) => (
                      <option key={data.id} value={data.id}>
                        {data.name}
                      </option>
                    ))}
              </select>
            </div>
          </div>
        </>
      )}

      <div className={styles.row}>
        {employmentOrderType != "terminate" && (
          <div>
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
        )}
        <div>
          <label>{t("note")}</label>
          <input
            type="text"
            name="note"
            value={formData.note}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.btnWrapper}>
        <Button text={t("save")} type={"submit"} loading={loading} />
      </div>
    </form>
  );
};

export default AddEmploymentOrder;
