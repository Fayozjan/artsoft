import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  editUser,
  getUser,
  getActiveBranches,
  getActiveDepartments,
  EmployeeService,
  getMenus,
  getUserMenu,
} from "../api";

import Button from "./Button";
import SelectEmployee from "./SelectEmployee";
import PermissionsManager from "./PermissionsManager";
import MultiSelectDepartments from "./MultiSelectDepartments";
import MultiSelectBranches from "./MultiSelectBranches";

import styles from "./AddUser.module.scss";

const STATIC_MENUS = [
  { key: "home", labelKey: "homeNav" },
  { key: "finance", labelKey: "financeNav" },
  { key: "tasks", labelKey: "tasksNav" },
];

const EditUser = ({ id, handleClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    employee_id: "",
    access_level: "",
    branches: [],
    departments: [],
    status: true,
    telegramId: "",
    view_mode: "branch",
    personal_menus: [],
    ignore_gps_check: false,
  });

  const [userMenus, setUserMenus] = useState();
  const [allMenus, setAllMenus] = useState();

  const [state, setState] = useState({
    employees: [],
    branches: [],
    departments: [],
    loading: true,
    showPassword: false,
  });

  const { t } = useTranslation();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [userRes, employeesRes, branchesRes, departmentsRes, allMenusRes] =
        await Promise.all([
          getUser(id),
          EmployeeService.getActive(),
          getActiveBranches(),
          getActiveDepartments(),
          getMenus(),
        ]);

      const userData = userRes.data;
      const savedMenus = userData.menuAccess || [];

      const menuMap = {};
      savedMenus.forEach((item) => {
        menuMap[item.menu_id] = {
          view: !!item.can_view,
          add: !!item.can_add,
          update: !!item.can_update,
          delete: !!item.can_delete,
        };
      });

      setAllMenus(allMenusRes);
      setUserMenus(
        savedMenus.map((m) => ({
          id: m.menu_id,
          permissions: {
            view: m.can_view,
            add: m.can_add,
            update: m.can_update,
            delete: m.can_delete,
          },
        })),
      );

      setFormData({
        username: userData.username || "",
        employee_id: userData.employee_id || "",
        access_level: userData.access_level || "",
        status: userData.status ?? true,
        branches: userData.branch_access || [], // 👈 branch_access из БД → branches для сервиса
        departments: userData.department_access || [], // 👈 department_access из БД → departments для сервиса
        telegramId: userData.telegram_id || "", // 👈
        view_mode: userData.view_mode || "branch", // 👈
        personal_menus: userData.personal_menus || [], // 👈
        ignore_gps_check: userData.ignore_gps_check ?? false,
        password: "",
        menu: menuMap,
      });

      setState((prev) => ({
        ...prev,
        employees: employeesRes.data || employeesRes,
        branches: branchesRes.data || branchesRes,
        departments: departmentsRes.data || departmentsRes,
        loading: false,
      }));
    } catch (error) {
      console.error(error);
      showAlert(t("error"), "error");
      setTimeout(() => handleClose(), 1500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleChange = ({ target: { name, value } }) => {
    setFormData((prev) => ({
      ...prev,
      [name]: name === "status" ? value === "true" : value,
      ...(name === "access_level" && {
        branches: [],
        departments: [],
      }),
    }));
  };

  const handleMenuChange = useCallback((updatedPermissions) => {
    setFormData((prev) => ({
      ...prev,
      menu: updatedPermissions,
    }));
  }, []);

  const handleBranchesChange = (selected) => {
    setFormData((prevData) => ({
      ...prevData,
      branches: selected,
      departments: [],
    }));
  };

  const handleDepartmentChange = (selected) => {
    setFormData((prevData) => ({
      ...prevData,
      branches: [],
      departments: selected,
    }));
  };

  const handleShowPassword = () => {
    setState((prev) => ({ ...prev, showPassword: !prev.showPassword }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        telegramId: formData.telegramId?.trim() || null,
      };
      const res = await editUser({ id, data: payload });

      if (res.success) {
        showAlert(t("success"), "success");
        setTimeout(handleClose, 1500);
        onSuccess();
      }
    } catch (error) {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.addUser} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editUser")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("username")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>{t("newPassword")}</label>
          <div className={styles.passwordWrapper}>
            <input
              type={state.showPassword ? "text" : "password"}
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={styles.passwordInput}
            />
            <button
              type="button"
              onClick={handleShowPassword}
              className={styles.togglePassword}
              aria-label={t("show")}
            >
              {state.showPassword ? t("hide") : t("show")}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("employee")} <span style={{ color: "red" }}>*</span>
          </label>
          <SelectEmployee
            data="employee"
            options={state.employees}
            setFormData={setFormData}
            defaultValue={formData.employee_id}
          />
        </div>

        <div>
          <label>{t("telegramId")}</label>
          <input
            type="text"
            name="telegramId"
            value={formData.telegramId}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("access")} <span style={{ color: "red" }}>*</span>
          </label>
          <select
            name="access_level"
            value={formData.access_level}
            onChange={handleChange}
          >
            <option value="absolute">{t("fullAccess")}</option>
            <option value="branch">{t("branch")}</option>
            <option value="department">{t("department")}</option>
            <option value="employee">{t("employee")}</option>
          </select>
        </div>

        <div>
          <label>{t("status")}</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        {formData.access_level === "branch" && (
          <div>
            <label className={styles.label}>
              {t("branches")}
              <span className={styles.sticker}>
                {formData.branches?.length || 0}
              </span>
            </label>
            <MultiSelectBranches
              options={state.branches}
              selected={formData.branches}
              onChange={handleBranchesChange}
              required
            />
          </div>
        )}

        {formData.access_level === "department" && (
          <div>
            <label className={styles.label}>
              {t("departments")}
              <span className={styles.sticker}>
                {formData.departments?.length || 0}
              </span>
            </label>
            <MultiSelectDepartments
              options={state.departments}
              selected={formData.departments}
              onChange={handleDepartmentChange}
              required
            />
          </div>
        )}
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("viewMode")}</label>
          <select
            name="view_mode"
            value={formData.view_mode}
            onChange={handleChange}
          >
            <option value="absolute">{t("allBranches")}</option>
            <option value="branch">{t("byBranch")}</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div style={{ flex: "0 0 49%" }}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={formData.ignore_gps_check || false}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  ignore_gps_check: e.target.checked,
                }))
              }
            />
            {t("ignoreGpsCheck")}
          </label>
        </div>
      </div>

      {formData?.access_level !== "employee" && (
        <>
          <PermissionsManager
            allMenus={allMenus}
            userMenus={userMenus}
            onChange={(updatedMenu) => handleMenuChange(updatedMenu)}
          />

          <div className={styles.row}>
            <div>
              <label>{t("personalMenuMode")}</label>
              <div className={styles.checkboxGroup}>
                {STATIC_MENUS.map(({ key, labelKey }) => (
                  <label key={key} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={formData.personal_menus?.includes(key) || false}
                      onChange={(e) => {
                        const current = formData.personal_menus || [];
                        const updated = e.target.checked
                          ? [...current, key]
                          : current.filter((k) => k !== key);
                        setFormData((prev) => ({
                          ...prev,
                          personal_menus: updated,
                        }));
                      }}
                    />
                    {t(labelKey)}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </form>
  );
};

export default EditUser;
