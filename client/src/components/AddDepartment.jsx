import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { addDepartment, getActiveBranches, getActivePositions } from "../api";
import { saveStaffingPositions } from "../api/staffingPosition";

import Button from "./Button";
import StaffingPicker from "./StaffingPicker";

import styles from "./AddDepartment.module.scss";

const AddDepartment = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({ name: "", branch_id: "" });
  const [branches, setBranches] = useState([]);
  const [allPositions, setAllPositions] = useState([]);
  const [staffing, setStaffing] = useState([]);

  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(false);
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) i18n.changeLanguage(userSettings.language);
  }, [userSettings, i18n]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [branchRes, posRes] = await Promise.all([
          getActiveBranches(),
          getActivePositions(),
        ]);
        if (branchRes.success) setBranches(branchRes.data);
        if (posRes.success) setAllPositions(posRes.data);
      } catch (error) {
        showAlert(t("error"), "error");
        setTimeout(() => handleClose(), 1500);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (branches?.length === 1) {
      setFormData((prev) => ({ ...prev, branch_id: branches[0].id }));
    }
  }, [branches]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "branch_id" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await addDepartment(formData);
      if (res.success && res.data?.id) {
        if (staffing.length > 0) {
          await saveStaffingPositions(res.data.id, staffing.map(({ position_id, headcount }) => ({ position_id, headcount })));
        }
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addDepartment} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addDepartment")}</h2>
        <Button text={t("save")} type="submit" />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("name")} <span style={{ color: "red" }}>*</span></label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("branch")} <span style={{ color: "red" }}>*</span></label>
          <select name="branch_id" value={formData.branch_id} onChange={handleChange} required>
            <option value="" disabled>{t("select")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <StaffingPicker allPositions={allPositions} staffing={staffing} onChange={setStaffing} />
    </form>
  );
};

export default AddDepartment;
