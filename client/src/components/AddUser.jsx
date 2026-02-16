import axios from "axios";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
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

const AddUser = ({ cancelButton }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    employee_id: "",
    access_level: "",
    branches: [],
    departments: [],
  });

  const { showAlert } = useAlertStore();

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

  // Получение данных при первой загрузке
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeeRes, branchesRes, departmentsRes, userMenu, allMenus] =
          await Promise.all([
            EmployeeService.getActive(),
            getActiveBranches(),
            getActiveDepartments(),
            getUserMenu(),
            getMenus(),
          ]);

        setUserMenus(userMenu);
        setAllMenus(allMenus);

        setState({
          employee: employeeRes.data || employeeRes,
          branches: branchesRes.data || branchesRes,
          departments: departmentsRes.data || departmentsRes,
          loading: false,
          showPassword: false,
        });
      } catch (error) {
        console.error(error);
        showAlert("Ошибка при загрузке данных", "error");
        setTimeout(() => handleClose(), 1500);
      }
    };

    fetchData();
  }, []);

  // Обновление данных в форме
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Обновление меню
  const handleMenuChange = (newMenuData) => {
    setFormData((prev) => ({
      ...prev,
      menu: newMenuData,
    }));
  };

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

    try {
      const res = await axios.post(`/api/logins/add`, formData);

      if (res.data.success) {
        showAlert("Успешно", "success");
        setTimeout(() => cancelButton(), 1500);
      }
    } catch (error) {
      showAlert("Ошибка", "error");
    }
  };

  return (
    <form className={styles.addUser} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addPosition")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>Название</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>Пароль</label>
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
            >
              {state.showPassword ? "Скрыть" : "Показать"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>Пользователь</label>
          <SelectEmployee
            data="person"
            options={state.persons}
            setFormData={setFormData}
            defaultValue={formData.person_id}
          />
        </div>

        <div>
          <label>Доступ</label>
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
      </div>

      <div className={styles.row}>
        {formData.access_level === "branch" && (
          <div>
            <label className={styles.label}>
              Филиалы
              <span className={styles.sticker}>
                {formData.branches.length || 0}
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
              Отделы
              <span className={styles.sticker}>
                {formData.departments.length || 0}
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

      <PermissionsManager
        allMenus={allMenus}
        userMenus={userMenus}
        onChange={(updatedMenu) => handleMenuChange(updatedMenu)}
      />
    </form>
  );
};

export default AddUser;
