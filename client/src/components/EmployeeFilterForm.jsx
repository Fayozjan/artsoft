import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useFilterDataStore } from "../stores/filterDataStore";
import { useAuthStore } from "../stores/authStore";

import SelectWithSearch from "../components/SelectWithSearch";
import SelectEmployee from "../components/SelectEmployee";
import MultiSelectBranches from "../components/MultiSelectBranches";
import MultiSelectDepartments from "../components/MultiSelectDepartments";
import MultiSelectPositions from "../components/MultiSelectPositions";
import MultiSelectEmployees from "../components/MultiSelectEmployees";

import styles from "./EmployeeFilterForm.module.scss";

const EmployeeFilterForm = ({
  filters = ["branch", "department", "position"],
  accessLevel,
  formData,
  setFormData,
  required = [],
  multiple = false,
}) => {
  const { branches, departments, positions, employees, fetchAllData } =
    useFilterDataStore();

  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const { t } = useTranslation();

  const requiredFields = Array.isArray(required) ? required : [required];

  // загрузка данных
  useEffect(() => {
    if (
      !branches.length ||
      !departments.length ||
      !positions.length ||
      !employees.length
    ) {
      fetchAllData();
    }
  }, [
    branches.length,
    departments.length,
    positions.length,
    employees.length,
    fetchAllData,
  ]);

  // фильтрация отделов
  const filteredDepartments = useMemo(() => {
    if (viewMode === "branch") {
      return departments.filter(
        (dep) => Number(dep.branchId) === Number(activeBranchId),
      );
    }

    if (multiple) {
      if (formData.branch_ids?.length) {
        return departments.filter((dep) =>
          formData.branch_ids.map(Number).includes(Number(dep.branchId)),
        );
      }
      return departments;
    }

    if (formData.branch_id) {
      return departments.filter(
        (dep) => Number(dep.branchId) === Number(formData.branch_id),
      );
    }

    return departments;
  }, [
    departments,
    formData.branch_id,
    formData.branch_ids,
    multiple,
    viewMode,
    activeBranchId,
  ]);

  return (
    <>
      {filters.includes("branch") &&
        accessLevel !== "department" &&
        viewMode !== "branch" && (
          <div>
            <span className={styles.label}>{t("branch")}</span>
            {multiple ? (
              <MultiSelectBranches
                options={branches}
                selected={formData.branch_ids || []}
                onChange={(ids) =>
                  setFormData((prev) => ({ ...prev, branch_ids: ids }))
                }
              />
            ) : (
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
            )}
          </div>
        )}

      {filters.includes("department") && (
        <div>
          <span className={styles.label}>{t("department")}</span>
          {multiple ? (
            <MultiSelectDepartments
              options={filteredDepartments}
              selected={formData.department_ids || []}
              onChange={(ids) =>
                setFormData((prev) => ({ ...prev, department_ids: ids }))
              }
            />
          ) : (
            <SelectWithSearch
              value={formData.department_id}
              options={filteredDepartments}
              data="department"
              placeholder={t("selectDepartment")}
              setFormData={setFormData}
              required={requiredFields.includes("department")}
              noMatches={t("noMatches")}
            />
          )}
        </div>
      )}

      {filters.includes("employee") && (
        <div>
          <span className={styles.label}>{t("employee")}</span>
          {multiple ? (
            <MultiSelectEmployees
              options={employees}
              selected={formData.employee_ids || []}
              onChange={(ids) =>
                setFormData((prev) => ({ ...prev, employee_ids: ids }))
              }
              showDepartment={false}
            />
          ) : (
            <SelectEmployee
              data="employee"
              options={employees}
              setFormData={setFormData}
              defaultValue={formData.employee_id}
              placeholder={t("selectEmployee")}
              required={requiredFields.includes("employee")}
              noMatches={t("noMatches")}
            />
          )}
        </div>
      )}

      {filters.includes("position") && accessLevel !== "department" && multiple && (
        <div>
          <span className={styles.label}>{t("position")}</span>
          <MultiSelectPositions
            options={positions}
            selected={formData.position_ids || []}
            onChange={(ids) =>
              setFormData((prev) => ({ ...prev, position_ids: ids }))
            }
          />
        </div>
      )}

      {filters.includes("position") && accessLevel !== "department" && !multiple && (
        <div>
          <span className={styles.label}>{t("position")}</span>
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
