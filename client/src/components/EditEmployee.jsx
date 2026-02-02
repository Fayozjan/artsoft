import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import {
  getEmployeeById,
  editEmployee,
  getActiveBranches,
  getActivePositions,
  getActiveDoors,
  getActiveWorkSchedules,
  editEmploymentOrderById,
} from "../api";

import MultiSelectDoors from "./MultiSelectDoors";
import Button from "./Button";
import Loading from "./Loading";
import CenterModal from "./CenterModal";

import styles from "./AddEmployee.module.scss";

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

      const employeeRes = await getEmployeeById(id);
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

    try {
      // 1. Обновляем сотрудника
      await editEmployee(id, {
        last_name: formData.last_name,
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        photo: formData.photo,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth,
        pinfl: formData.pinfl,
        passport: formData.passport,
        passport_expiry_date: formData.passport_expiry_date,
        education: formData.education,
        education_specialty: formData.education_specialty,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        employee_number: formData.employee_number,
        work_schedule_id: formData.work_schedule_id,
        door_ids: formData.door_ids,
        work_schedule_start_date:
          Number(formData.work_schedule_id) !==
          Number(originalData.work_schedule_id)
            ? formData.work_schedule_start_date
            : null,
      });

      // 2. Обновляем ТЕКУЩИЙ приказ
      if (formData.order_id) {
        await editEmploymentOrderById(formData.order_id, {
          order_number: formData.order_number,
          date: formData.order_date,
          branch_id: formData.branch_id,
          department_id: formData.department_id,
          position_id: formData.position_id,
        });
      }

      showAlert(t("success"), "success");
      onSuccess();
      setTimeout(handleClose, 1500);
    } catch (err) {
      showAlert(t("error"), "error");
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

        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.topRow}>
        {imagePreview ? (
          <div className={styles.previewPhoto}>
            <img
              src={imagePreview}
              alt="Selected"
              className={`${
                formData.status ? styles.active : styles.terminated
              }`}
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

      <div className={styles.addOrderBtnWrapper}>
        <button
          type="button"
          className={`${styles.showAllEmploymentBtn} ${styles.btn} `}
          onClick={() => handleLeftPanel("list", "employmentWorkScheduleList")}
        >
          <svg
            width="18"
            height="18"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1024 1024"
          >
            <path d="M960 96H704V32q0-13-9.5-22.5T672 0t-22.5 9.5T640 32v64H384V32q0-13-9.5-22.5T352 0t-22.5 9.5T320 32v64H64q-27 0-45.5 18.5T0 160v800q0 17 8.5 32t23.5 23.5t32 8.5h896q27 0 45.5-19t18.5-45V160q0-18-8.5-32.5t-23.5-23t-32-8.5zm0 864H64V160h256v32q0 13 9.5 22.5T352 224t22.5-9.5T384 192v-32h256v32q0 13 9.5 22.5T672 224t22.5-9.5T704 192v-32h256v800zM736 512h64q13 0 22.5-9.5T832 480v-64q0-13-9.5-22.5T800 384h-64q-13 0-22.5 9.5T704 416v64q0 13 9.5 22.5T736 512zm0 256h64q13 0 22.5-9.5T832 736v-64q0-13-9.5-22.5T800 640h-64q-13 0-22.5 9.5T704 672v64q0 13 9.5 22.5T736 768zM544 640h-64q-13 0-22.5 9.5T448 672v64q0 5 1.5 10t4.5 9t7 7t9 4.5t10 1.5h64q13 0 22.5-9.5T576 736v-64q0-4-1-8.5t-3-8t-5-6.5t-6.5-5t-8-3t-8.5-1zm0-256h-64q-13 0-22.5 9.5T448 416v64q0 13 9.5 22.5T480 512h64q13 0 22.5-9.5T576 480v-64q0-7-2.5-12.5t-7-10t-10-7T544 384zm-256 0h-64q-13 0-22.5 9.5T192 416v64q0 13 9.5 22.5T224 512h64q13 0 22.5-9.5T320 480v-64q0-7-2.5-12.5t-7-10t-10-7T288 384zm0 256h-64q-13 0-22.5 9.5T192 672v64q0 13 9.5 22.5T224 768h64q13 0 22.5-9.5T320 736v-64q0-4-1-8.5t-3-8t-5-6.5t-6.5-5t-8-3t-8.5-1z" />
          </svg>
          {t("employeeWorkScheduleHistory")}
        </button>
      </div>

      <h4>Редактирование текущего приказа</h4>
      <div className={styles.orderSectionWrapper}>
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

      <div className={styles.addOrderBtnWrapper}>
        <button
          type="button"
          className={`${styles.showAllEmploymentBtn} ${styles.btn} `}
          onClick={() => handleLeftPanel("list", "employmentOrdersList")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 1024 1024"
          >
            <path d="M952.08 1.552L529.039 116.144c-10.752 2.88-34.096 2.848-44.815-.16L72.08 1.776C35.295-8.352-.336 18.176-.336 56.048V834.16c0 32.096 24.335 62.785 55.311 71.409l412.16 114.224c11.025 3.055 25.217 4.751 39.937 4.751c10.095 0 25.007-.784 38.72-4.528l423.023-114.592c31.056-8.4 55.504-39.024 55.504-71.248V56.048c.016-37.84-35.616-64.464-72.24-54.496zM479.999 956.943L71.071 843.887c-3.088-.847-7.408-6.496-7.408-9.712V66.143L467.135 177.68c3.904 1.088 8.288 1.936 12.864 2.656v776.608zm480.336-122.767c0 3.152-5.184 8.655-8.256 9.503L544 954.207v-775.92c.592-.144 1.2-.224 1.792-.384L960.32 65.775v768.4h.016zM641.999 366.303c2.88 0 5.81-.367 8.69-1.184l223.935-63.024c17.025-4.816 26.945-22.465 22.16-39.473s-22.56-26.88-39.472-22.16l-223.936 63.025c-17.024 4.816-26.944 22.464-22.16 39.472c3.968 14.128 16.815 23.344 30.783 23.344zm.002 192.001c2.88 0 5.81-.368 8.69-1.185l223.935-63.024c17.025-4.816 26.945-22.465 22.16-39.473c-4.783-17.008-22.56-26.88-39.472-22.16l-223.936 63.025c-17.024 4.816-26.944 22.464-22.16 39.457c3.968 14.127 16.815 23.36 30.783 23.36zm.002 192c2.88 0 5.81-.368 8.69-1.185l223.935-63.024c17.025-4.816 26.945-22.465 22.16-39.473s-22.56-26.88-39.472-22.16L633.38 687.487c-17.024 4.816-26.944 22.464-22.16 39.472c3.968 14.113 16.815 23.345 30.783 23.345zM394.629 303.487l-223.934-63.025c-16.912-4.72-34.688 5.152-39.473 22.16s5.12 34.656 22.16 39.473l223.937 63.024a31.827 31.827 0 0 0 8.687 1.184c13.968 0 26.815-9.215 30.783-23.343c4.784-16.993-5.12-34.657-22.16-39.473zm.002 191.999l-223.934-63.025c-16.912-4.72-34.689 5.152-39.473 22.16s5.12 34.656 22.16 39.473l223.936 63.024a31.827 31.827 0 0 0 8.688 1.184c13.968 0 26.815-9.215 30.783-23.343c4.784-16.993-5.12-34.657-22.16-39.473zm.002 191.999L170.699 624.46c-16.912-4.72-34.689 5.152-39.473 22.16s5.12 34.656 22.16 39.473l223.936 63.024a31.827 31.827 0 0 0 8.688 1.184c13.968 0 26.815-9.215 30.783-23.343c4.784-17.008-5.12-34.657-22.16-39.473z" />
          </svg>
          {t("showAllEmploymentOrders")}
        </button>

        {formData.status ? (
          <>
            <button
              type="button"
              className={`${styles.transferBtn} ${styles.btn} `}
              onClick={() => handleLeftPanel("transfer", "addEmploymentOrder")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 1050 1100"
              >
                <path d="m402.304 505.856l39.264-55.248l-134.304-183.28H2.736v64h271.488zm516.479-174.528l-77.536 69.535c-9.344 8.945-12.368 23.44-3.025 32.368l5.472 8.065c9.376 8.944 24.496 8.944 33.824 0l127.744-115.504c.176-.16.384-.193.544-.336l8.464-8.096c4.672-4.496 7.008-10.368 6.976-16.288c.032-5.872-2.304-11.776-6.976-16.224l-8.464-8.096c-.16-.16-.336-.225-.544-.368L875.534 157.952c-9.36-8.945-24.464-8.945-33.84 0l-5.471 8.064c-9.36 8.944-6.32 23.408 3.023 32.336l76.048 68.976h-231.76l-409.312 576H2.734v64h304.512l409.328-576zm87.027 521.44c-.16-.16-.337-.226-.545-.37l-129.728-118.43c-9.36-8.944-24.464-8.944-33.84 0l-5.471 8.064c-9.36 8.945-6.32 23.409 3.023 32.336l76.336 69.233l-199.008-.273L602.145 666.32l-39.28 55.248l120.656 185.76l234.944.288l-77.216 69.248c-9.344 8.945-12.368 23.44-3.025 32.368l5.472 8.065c9.376 8.944 24.496 8.944 33.824 0l127.744-115.504c.176-.16.384-.192.544-.336l8.464-8.096c4.672-4.496 7.008-10.368 6.976-16.288c.032-5.872-2.304-11.776-6.976-16.224z" />
              </svg>
              {t("transferEmployee")}
            </button>

            <button
              type="button"
              className={`${styles.terminateBtn} ${styles.btn} `}
              onClick={() => handleLeftPanel("terminate", "addEmploymentOrder")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 1024 1024"
              >
                <path d="M512 0C229.232 0 0 229.232 0 512c0 282.784 229.232 512 512 512c282.784 0 512-229.216 512-512C1024 229.232 794.784 0 512 0zm0 961.008c-247.024 0-448-201.984-448-449.01c0-247.024 200.976-448 448-448s448 200.977 448 448s-200.976 449.01-448 449.01zm181.008-630.016c-12.496-12.496-32.752-12.496-45.248 0L512 466.752l-135.76-135.76c-12.496-12.496-32.752-12.496-45.264 0c-12.496 12.496-12.496 32.752 0 45.248L466.736 512l-135.76 135.76c-12.496 12.48-12.496 32.769 0 45.249c12.496 12.496 32.752 12.496 45.264 0L512 557.249l135.76 135.76c12.496 12.496 32.752 12.496 45.248 0c12.496-12.48 12.496-32.769 0-45.249L557.248 512l135.76-135.76c12.512-12.512 12.512-32.768 0-45.248z" />
              </svg>
              {t("terminateEmployee")}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`${styles.hireBtn} ${styles.btn} `}
            onClick={() => handleLeftPanel("hire", "addEmploymentOrder")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
            >
              <path d="M13 4v7h7v2h-7v7h-2v-7H4v-2h7V4h2Z" />
            </svg>
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
      >
        <p></p>
      </CenterModal>
    </form>
  );
};

export default EditEmployee;
