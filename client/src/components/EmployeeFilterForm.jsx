import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useFilterDataStore } from "../stores/filterDataStore";

import SelectWithSearch from "../components/SelectWithSearch";

const EmployeeFilterForm = ({
  filters = ["branch", "department", "position"],
  accessLevel,
  formData,
  setFormData,
  required = [],
}) => {
  const { branches, departments, positions, fetchAllData } =
    useFilterDataStore();
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  const requiredFields = Array.isArray(required) ? required : [required];

  const [filteredDepartments, setFilteredDepartments] = useState([]);

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  // 1. Загружаем данные при монтировании
  useEffect(() => {
    if (!branches.length || !departments.length || !positions.length) {
      fetchAllData();
    }
  }, []);

  // 2. Фильтруем отделы
  useEffect(() => {
    setFilteredDepartments(
      formData.branch_id
        ? departments.filter(
            (dep) => Number(dep.branchId) === Number(formData.branch_id)
          )
        : departments
    );
  }, [formData.branch_id, departments]);

  console.log("formData", formData);
  console.log("departments", departments);

  return (
    <>
      {filters.includes("branch") && accessLevel !== "department" && (
        <div>
          <h2>Филиал</h2>
          <SelectWithSearch
            value={formData.branch_id}
            options={branches}
            data="branch"
            placeholder={t("selectBranch")}
            setFormData={setFormData}
            required={requiredFields.includes("branch")}
            disabled={formData.department_id ? true : false}
            noMatches={t("noMatches")}
          />
        </div>
      )}

      {filters.includes("department") && (
        <div>
          <h2>Отдел</h2>
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
          <h2>Должность</h2>
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
