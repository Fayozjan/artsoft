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
import SearchableSelect from "./SearchableSelect";
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
  // ждём проверку выданного имущества перед открытием приказа об увольнении
  const [checkingTermination, setCheckingTermination] = useState(false);
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

    const syncDoors = e.nativeEvent.submitter?.name === "sync_doors";

    setLoading(true);

    try {
      await EmployeeService.update(id, { ...formData, sync_doors: syncDoors });

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

            <button type="button" className={styles.deleteBtn} onClick={handleRemoveImage}>{Icons.delete}</button>
          </div>
        ) : (
          <div
            className={`${styles.uploadPhoto} ${
              formData.is_terminated ? styles.terminated : styles.active
            }`}
          >
            <label htmlFor="photo-upload">
              {Icons.uploadPhoto}
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
      </div>

      <div className={styles.row}>
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
        <div>
          <label>&nbsp;</label>
          <button
            type="submit"
            name="sync_doors"
            className={styles.syncDoorBtn}
            disabled={loading}
            title={t("syncWithDoorHint")}
          >
            {Icons.refresh}
            <span>{t("syncWithDoor")}</span>
          </button>
        </div>
      </div>

      {!!formData?.employmentOrders?.length && (
        <div className={styles.orderSectionWrapper}>
          <h4>{t("editCurrentOrder")}</h4>
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
                <SearchableSelect
                  value={formData.position_id}
                  options={positions || []}
                  data="position"
                  placeholder={t("selectPosition")}
                  setFormData={setFormData}
                  required
                  noMatches={t("noMatches")}
                />
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
              disabled={checkingTermination}
              onClick={async () => {
                setCheckingTermination(true);
                try {
                  await handleLeftPanel("terminate", "addEmploymentOrder");
                } finally {
                  setCheckingTermination(false);
                }
              }}
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
        title={t("confirmCloseTitle")}
        text={t("unsavedDataWarning")}
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
