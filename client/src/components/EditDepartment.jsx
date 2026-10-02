import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { editDepartmentById, getActiveBranches, getDepartmentById, getActivePositions } from "../api";
import { getStaffingPositions, saveStaffingPositions } from "../api/staffingPosition";

import Button from "./Button";
import StaffingPicker from "./StaffingPicker";

import styles from "./AddDepartment.module.scss";

const EditDepartment = ({ id, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({ name: "", branch_id: null, status: null });
  const [branches, setBranches] = useState([]);
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [allPositions, setAllPositions] = useState([]);
  const [staffing, setStaffing] = useState([]);

  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) i18n.changeLanguage(userSettings.language);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [branchRes, deptRes, posRes, staffingRes] = await Promise.all([
          getActiveBranches(),
          getDepartmentById(id),
          getActivePositions(),
          getStaffingPositions(id),
        ]);
        if (branchRes.success) setBranches(branchRes.data);
        if (deptRes.success) setFormData(deptRes.data);
        if (posRes.success) setAllPositions(posRes.data);
        if (staffingRes.success) {
          setStaffing(
            (staffingRes.data || []).map((s) => ({
              position_id: Number(s.position_id),
              position_name: s.position_name,
              headcount: Number(s.headcount),
            }))
          );
        }
      } catch (error) {
        showAlert(t("error"), "error");
      }
    };
    fetchData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "branch_id" ? Number(value) :
        name === "status" ? value === "true" :
        value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const [deptRes] = await Promise.all([
        editDepartmentById(id, formData),
        saveStaffingPositions(id, staffing.map(({ position_id, headcount }) => ({ position_id, headcount }))),
      ]);
      if (deptRes.success) {
        showAlert(t("success"), "success");
        onSuccess();
      }
    } catch (error) {
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addDepartment} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editDepartment")}</h2>
        <Button text={t("save")} type="submit" />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("name")}</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("branch")}</label>
          <select
            name="branch_id"
            value={formData.branch_id}
            onChange={handleChange}
            onFocus={() => setShowAllBranches(true)}
            required
          >
            {!showAllBranches && formData.branch_id ? (
              <option value={formData.branch_id} disabled>
                {branches.find((b) => b.id === formData.branch_id)?.name}
              </option>
            ) : (
              <option value="" disabled>{t("select")}</option>
            )}
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("status")}</label>
          <select name="status" value={formData.status} onChange={handleChange}>
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>

      <StaffingPicker allPositions={allPositions} staffing={staffing} onChange={setStaffing} />
    </form>
  );
};

export default EditDepartment;
