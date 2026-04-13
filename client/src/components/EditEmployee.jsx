import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import {
  EmployeeService,
  getActiveBranches,
  getActivePositions,
  getActiveDoors,
  getActiveWorkSchedules,
} from "../api";

import MultiSelectDoors from "./MultiSelectDoors";
import Button from "./Button";
import Loading from "./Loading";
import CenterModal from "./CenterModal";

import styles from "./AddEmployee.module.scss";
import { Icons } from "../icons/icons";

const EditEmployee = ({
  id,
  handleClose,
  onSuccess,
  handleLeftPanel,
  closeLeftPanel,
  isLeftPanelOpen,
  handleSetUpdateFunction,
}) => {
  const [formData, setFormData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [branches, setBranches] = useState();
  const [positions, setPositions] = useState();
  const [workSchedules, setWorkSchedules] = useState();
  const [doors, setDoors] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(true);
  const lastOrder = formData?.employmentOrders?.at(-1);
  const isEmployed = lastOrder && lastOrder.type !== "terminate";

  const today = () => new Date().toISOString().slice(0, 10);

  const currentScheduleId = Number(formData.work_schedule_id || 0);
  const originalScheduleId = Number(originalData.work_schedule_id || 0);

  const workScheduleChanged =
    Object.keys(originalData).length > 0 &&
    currentScheduleId !== originalScheduleId &&
    currentScheduleId > 0;

  const fetchInfo = async () => {
    try {
      setLoading(true);

      const employeeRes = await EmployeeService.getById(id);
      const employee = employeeRes.data;
      const currentOrder = employee.employmentOrders.at(-1);

      const initialData = {
        ...employee,
        order_id: currentOrder?.id,
        order_number: currentOrder?.order_number,
        order_date: currentOrder?.date?.slice(0, 10),
        branch_id: currentOrder?.branch_id,
        department_id: currentOrder?.department_id,
        position_id: currentOrder?.position_id,
      };

      setFormData(initialData);
      setOriginalData(initialData);

      if (employeeRes.data.photo) {
        setImagePreview(employeeRes.data.photo);
      }

      const branchesRes = await getActiveBranches();
      setBranches(branchesRes.data);

      const positionsRes = await getActivePositions();
      setPositions(positionsRes.data);

      const workSchedulesRes = await getActiveWorkSchedules();
      setWorkSchedules(workSchedulesRes.data);

      const doorsRes = await getActiveDoors();
      setDoors(doorsRes.data);
    } catch (err) {
      console.log(err.message);
      showAlert(t("error"), "error");
      setTimeout(handleClose, 1500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInfo();
    handleSetUpdateFunction(fetchInfo);
  }, []);

  useEffect(() => {
    if (branches?.length === 1) {
      setFormData((prev) => ({
        ...prev,
        branch_id: branches[0].id,
      }));
    }
  }, [branches]);

  useEffect(() => {
    if (workScheduleChanged && !formData.work_schedule_start_date) {
      setFormData((prev) => ({ ...prev, work_schedule_start_date: today() }));
    }
  }, [workScheduleChanged]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFormData((prev) => ({ ...prev, photo: file }));
    setImagePreview(URL.createObjectURL(file));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setFormData((prev) => ({ ...prev, photo: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);

    try {
      await EmployeeService.update(id, formData);

      await showAlert(t("success"), "success");
      onSuccess();

      setTimeout(() => {
        handleClose();
      }, 1000);
    } catch (err) {
      showAlert(t("error"), "error");
      console.log("error", err);
    } finally {
      setLoading(false);
    }
  };

  const formChanged = JSON.stringify(formData) !== JSON.stringify(originalData);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isLeftPanelOpen) {
          closeLeftPanel();
          return;
        }

        if (formChanged) {
          setShowConfirmClose(true);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [formChanged, isLeftPanelOpen, closeLeftPanel, handleClose]);

  return (
    <form className={styles.addEmployee} onSubmit={handleSubmit}>
      {loading && <Loading />}
      <div className={styles.header}>
        <h2>{t("editEmployee")}</h2>

        <Button
          text={t("save")}
          type="submit"
          disabled={loading}
          loading={loading}
        />
      </div>

      <div className={styles.topRow}>
        {imagePreview ? (
          <div className={styles.previewPhoto}>
            <img
              src={
                imagePreview?.startsWith("blob:")
                  ? imagePreview
                  : `/api/employees/image/${imagePreview}?t=${new Date().getTime()}`
              }
              alt="selectedPhoto"
              className={`${formData.status ? styles.active : styles.terminated}`}
            />

            <svg
              onClick={() => handleRemoveImage()}
              xmlns="http://www.w3.org/2000/svg"
              width="200"
              height="200"
              viewBox="0 0 24 24"
            >
              <path
                fill="#ffffff"
                d="M18 19a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V7H4V4h4.5l1-1h4l1 1H19v3h-1v12M6 7v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V7H6m12-1V5h-4l-1-1h-3L9 5H5v1h13M8 9h1v10H8V9m6 0h1v10h-1V9Z"
              />
            </svg>
          </div>
        ) : (
          <div
            className={`${styles.uploadPhoto} ${
              formData.is_terminated ? styles.terminated : styles.active
            }`}
          >
            <label htmlFor="photo-upload">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="200"
                height="200"
                viewBox="0 0 40 40"
              >
                <path
                  fill="#000000"
                  d="M14.702 28.838c-1.757 0-3.054-.031-4.248-.061c-1.014-.024-1.954-.047-3.043-.047a6.454 6.454 0 0 1-6.447-6.446a6.393 6.393 0 0 1 2.807-5.321a10.558 10.558 0 0 1-.217-2.138C3.554 8.983 8.307 4.23 14.15 4.23c3.912 0 7.495 2.164 9.332 5.574a6.396 6.396 0 0 1 4.599-1.929a6.454 6.454 0 0 1 6.258 8.008a6.45 6.45 0 0 1 4.699 6.207a6.455 6.455 0 0 1-6.447 6.448c-1.661 0-2.827.013-3.979.024c-1.126.012-2.239.024-3.784.024a.5.5 0 0 1 0-1c1.541 0 2.65-.012 3.773-.024c1.155-.012 2.325-.024 3.99-.024a5.447 5.447 0 0 0 1.025-10.798a.5.5 0 0 1-.379-.653a5.452 5.452 0 0 0-5.156-7.213a5.412 5.412 0 0 0-4.318 2.129a.498.498 0 0 1-.852-.101a9.616 9.616 0 0 0-8.76-5.674c-5.291 0-9.596 4.304-9.596 9.595c0 .76.09 1.518.267 2.252a.5.5 0 0 1-.227.545a5.408 5.408 0 0 0-2.63 4.662a5.453 5.453 0 0 0 5.447 5.446c1.098 0 2.045.022 3.067.048c1.188.028 2.477.06 4.224.06a.5.5 0 1 1-.001 1.002z"
                />
                <path
                  fill="#000000"
                  d="M26.35 22.456a.5.5 0 0 1-.347-.14l-6.777-6.535l-6.746 6.508a.5.5 0 1 1-.694-.721l7.093-6.841a.5.5 0 0 1 .694-.001l7.123 6.869a.5.5 0 0 1-.346.861z"
                />
                <path
                  fill="#000000"
                  d="M19.226 35.769a.5.5 0 0 1-.5-.5V15.087a.5.5 0 0 1 1 0V35.27a.5.5 0 0 1-.5.499z"
                />
              </svg>
              <span>{t("uploadPhoto")}</span>
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

        <div>
          <label>
            {t("lastName")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            required
          />

          <label>
            {t("firstName")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            required
          />

          <label>{t("middleName")}</label>
          <input
            type="text"
            name="middle_name"
            value={formData.middle_name}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("gender")}</label>
          <select name="gender" value={formData.gender} onChange={handleChange}>
            <option value="male">{t("male")}</option>
            <option value="female">{t("female")}</option>
          </select>
        </div>

        <div>
          <label>{t("dateOfBirth")}</label>
          <input
            type="date"
            name="date_of_birth"
            value={formData.date_of_birth}
            onChange={handleChange}
            onFocus={(e) => e.target.showPicker?.()}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("pinfl")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="pinfl"
            value={formData.pinfl}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>{t("passport")}</label>
          <input
            type="text"
            name="passport"
            value={formData.passport}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>{t("passportExpiryDate")}</label>
          <input
            type="date"
            name="passport_expiry_date"
            value={formData.passport_expiry_date}
            onChange={handleChange}
            onFocus={(e) => e.target.showPicker?.()}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("education")}</label>
          <select
            name="education"
            value={formData.education}
            onChange={handleChange}
          >
            <option hidden value="">
              {t("select")}
            </option>
            <option value="higher">{t("higherEdu")}</option>
            <option value="secondary">{t("secondaryEdu")}</option>
            <option value="general">{t("generalEdu")}</option>
          </select>
        </div>

        <div>
          <label>{t("speciality")}</label>
          <input
            type="text"
            name="education_specialty"
            value={formData.education_specialty}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("phoneNumber")}</label>
          <input
            type="text"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>{t("email")}</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>{t("address")}</label>
          <input
            type="text"
            name="address"
            value={formData.address}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("employeeNumber")}</label>
          <input
            type="text"
            name="employee_number"
            value={formData.employee_number}
            onChange={handleChange}
          />
        </div>
        <div>
          <label>{t("workSchedule")}</label>
          <select
            name="work_schedule_id"
            value={formData.work_schedule_id}
            onChange={handleChange}
          >
            <option value="">{t("select")}</option>
            {workSchedules &&
              workSchedules.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
          </select>
        </div>
        {workScheduleChanged && (
          <div>
            <label>{t("workScheduleStartDate")}</label>
            <input
              type="date"
              name="work_schedule_start_date"
              value={formData.work_schedule_start_date || 0}
              onChange={handleChange}
              required
            />
          </div>
        )}
        <div>
          <label>{t("door")}</label>
          <MultiSelectDoors
            options={doors}
            selected={formData.door_ids || []}
            onChange={(newDoors) =>
              setFormData((prev) => ({ ...prev, door_ids: newDoors }))
            }
          />
        </div>
      </div>

      {!!formData?.employeeScheduleHistory?.length && (
        <div className={styles.orderBtnWrapper}>
          <button
            type="button"
            className={`${styles.showAllEmploymentBtn} ${styles.btn}`}
            onClick={() =>
              handleLeftPanel("list", "employmentWorkScheduleList")
            }
          >
            {Icons.calendar}
            {t("employeeWorkScheduleHistory")}
          </button>
        </div>
      )}

      {!!formData?.employmentOrders?.length && (
        <div className={styles.orderSectionWrapper}>
          <h4>Редактирование текущего приказа</h4>
          <div
            className={`${styles.orderFields} ${!formData.status ? styles.blurred : ""}`}
          >
            <div className={styles.row}>
              <div style={{ flex: 0.5 }}>
                <label>{t("orderNumber")}</label>
                <input
                  type="text"
                  name="order_number"
                  value={formData.order_number}
                  onChange={handleChange}
                />
              </div>
              <div style={{ flex: 0.6 }}>
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
            </div>

            <div className={styles.row}>
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
            </div>
          </div>

          {!formData.status && (
            <div className={styles.terminatedStamp}>
              <span>{t("terminatedStamp")}</span>
            </div>
          )}
        </div>
      )}

      <div className={styles.orderBtnWrapper}>
        {!!formData?.employmentOrders?.length && (
          <button
            type="button"
            className={`${styles.showAllEmploymentBtn} ${styles.btn} `}
            onClick={() => handleLeftPanel("list", "employmentOrdersList")}
          >
            {Icons.book}
            {t("showAllEmploymentOrders")}
          </button>
        )}

        {/* {formData?.employmentOrders?.length ? (
          <>
            <button
              type="button"
              className={`${styles.transferBtn} ${styles.btn} `}
              onClick={() => handleLeftPanel("transfer", "addEmploymentOrder")}
            >
              {Icons.transfer}
              {t("transferEmployee")}
            </button>

            <button
              type="button"
              className={`${styles.terminateBtn} ${styles.btn} `}
              onClick={() => handleLeftPanel("terminate", "addEmploymentOrder")}
            >
              {Icons.terminate}
              {t("terminateEmployee")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${styles.hireBtn} ${styles.btn} `}
            onClick={() => handleLeftPanel("hire", "addEmploymentOrder")}
          >
            {Icons.plus}
            {t("hireEmployee")}
          </button>
        )} */}

        {isEmployed ? (
          <>
            <button
              type="button"
              className={`${styles.transferBtn} ${styles.btn}`}
              onClick={() => handleLeftPanel("transfer", "addEmploymentOrder")}
            >
              {Icons.transfer}
              {t("transferEmployee")}
            </button>

            <button
              type="button"
              className={`${styles.terminateBtn} ${styles.btn}`}
              onClick={() => handleLeftPanel("terminate", "addEmploymentOrder")}
            >
              {Icons.terminate}
              {t("terminateEmployee")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${styles.hireBtn} ${styles.btn}`}
            onClick={() => handleLeftPanel("hire", "addEmploymentOrder")}
          >
            {Icons.plus}
            {t("hireEmployee")}
          </button>
        )}
      </div>

      <CenterModal
        isOpen={showConfirmClose}
        title="Вы уверены, что хотите закрыть окно?"
        text="Несохранённые данные будут потеряны."
        onClose={() => setShowConfirmClose(false)}
        onAccept={() => {
          setShowConfirmClose(false);
          handleClose();
        }}
      ></CenterModal>
    </form>
  );
};

export default EditEmployee;
