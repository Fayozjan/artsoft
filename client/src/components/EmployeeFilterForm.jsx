import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useFilterDataStore } from "../stores/filterDataStore";
import { useAuthStore } from "../stores/authStore";

import SelectWithSearch from "../components/SelectWithSearch";

import styles from "./EmployeeFilter.module.scss";

const EmployeeFilterForm = ({
  filters = ["branch", "department", "position"],
  accessLevel,
  formData,
  setFormData,
  required = [],
}) => {
  const { branches, departments, positions, fetchAllData } =
    useFilterDataStore();

  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const { t } = useTranslation();

  const requiredFields = Array.isArray(required) ? required : [required];

  // загрузка данных
  useEffect(() => {
    if (!branches.length || !departments.length || !positions.length) {
      fetchAllData();
    }
  }, [branches.length, departments.length, positions.length, fetchAllData]);

  // фильтрация отделов
  const filteredDepartments = useMemo(() => {
    if (viewMode === "branch") {
      return departments.filter(
        (dep) => Number(dep.branchId) === Number(activeBranchId),
      );
    }

    if (formData.branch_id) {
      return departments.filter(
        (dep) => Number(dep.branchId) === Number(formData.branch_id),
      );
    }

    return departments;
  }, [departments, formData.branch_id, viewMode, activeBranchId]);

  return (
    <>
      {filters.includes("branch") &&
        accessLevel !== "department" &&
        viewMode !== "branch" && (
          <div>
            <span className={styles.label}>Филиал</span>
            <SelectWithSearch
              value={formData.branch_id}
              options={branches}
              data="branch"
              placeholder={t("selectBranch")}
              setFormData={setFormData}
              required={requiredFields.includes("branch")}
              disabled={!!formData.department_id}
              noMatches={t("noMatches")}
            />
          </div>
        )}

      {filters.includes("department") && (
        <div>
          <span className={styles.label}>Отдел</span>
          <SelectWithSearch
            value={formData.department_id}
            options={filteredDepartments}
            data="department"
            placeholder={t("selectDepartment")}
            setFormData={setFormData}
            required={requiredFields.includes("department")}
            noMatches={t("noMatches")}
          />
        </div>
      )}

      {filters.includes("position") && accessLevel !== "department" && (
        <div>
          <span className={styles.label}>Должность</span>
          <SelectWithSearch
            value={formData.position_id}
            options={positions}
            data="position"
            placeholder={t("selectPosition")}
            setFormData={setFormData}
            required={requiredFields.includes("position")}
            noMatches={t("noMatches")}
          />
        </div>
      )}
    </>
  );
};

export default EmployeeFilterForm;
