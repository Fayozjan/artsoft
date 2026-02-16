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

const EditUser = ({ id, handleClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    employee_id: "",
    access_level: "",
    branch_access: [],
    department_access: [],
    status: true,
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
      const [
        userRes,
        employeesRes,
        branchesRes,
        departmentsRes,
        userMenu,
        allMenus,
      ] = await Promise.all([
        getUser(id),
        EmployeeService.getActive(),
        getActiveBranches(),
        getActiveDepartments(),
        getUserMenu(),
        getMenus(),
      ]);

      setUserMenus(userMenu);
      setAllMenus(allMenus);

      setState({
        employees: employeesRes.data || employeesRes,
        branches: branchesRes.data || branchesRes,
        departments: departmentsRes.data || departmentsRes,
        loading: false,
        showPassword: false,
      });

      setFormData((prev) => ({
        ...prev,
        username: userRes.data.username || "",
        access_level: userRes.data.access_level || "",
        employee_id: userRes.data.employee_id || "",
        status: userRes.data.status ?? true,
        branch_access: userRes.data.branch_access || [],
        department_access: userRes.data.department_access || [],
        menu: userRes.data.menu || [],
      }));
    } catch (error) {
      console.error(error);
      showAlert("Ошибка при загрузке данных", "error");
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
        branch_access: [],
        department_access: [],
      }),
    }));
  };

  // Обновление меню
  const handleMenuChange = useCallback((newMenuData) => {
    setFormData((prev) => ({
      ...prev,
      menu: newMenuData,
    }));
  }, []);

  const handleBranchesChange = (selected) => {
    setFormData((prevData) => ({
      ...prevData,
      branch_access: selected,
      department_access: [],
    }));
  };

  const handleDepartmentChange = (selected) => {
    setFormData((prevData) => ({
      ...prevData,
      branch_access: [],
      department_access: selected,
    }));
  };

  const handleShowPassword = () => {
    setState((prev) => ({ ...prev, showPassword: !prev.showPassword }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await editUser({ id, data: formData });

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
              aria-label="Показать пароль"
            >
              {state.showPassword ? "Скрыть" : "Показать"}
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
            <option value="absolute">Полный доступ</option>
            <option value="branch">Филиал</option>
            <option value="department">Отдел</option>
          </select>
        </div>

        <div>
          <label>Статус</label>
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
              Филиалы
              <span className={styles.sticker}>
                {formData.branch_access.length || 0}
              </span>
            </label>
            <MultiSelectBranches
              options={state.branches}
              selected={formData.branch_access}
              onChange={handleBranchesChange}
              required
            />
          </div>
        )}

        {formData.access_level === "department" && (
          <div>
            <label className={styles.label}>
              Отделы
              <span className={styles.sticker}>
                {formData.department_access.length || 0}
              </span>
            </label>
            <MultiSelectDepartments
              options={state.departments}
              selected={formData.department_access}
              onChange={handleDepartmentChange}
              required
            />
          </div>
        )}
      </div>

      <PermissionsManager
        allMenus={allMenus}
        userMenus={userMenus}
        onChange={(updatedMenu) => handleMenuChange(updatedMenu)}
      />
    </form>
  );
};

export default EditUser;
