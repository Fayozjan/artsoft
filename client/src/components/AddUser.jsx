import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  getActiveBranches,
  getActiveDepartments,
  EmployeeService,
  getMenus,
  getUserMenu,
  addUser,
} from "../api";

import Button from "./Button";
import SelectEmployee from "./SelectEmployee";
import UserMenuAccess from "./UserMenuAccess";
import MultiSelectDepartments from "./MultiSelectDepartments";
import MultiSelectBranches from "./MultiSelectBranches";

import UserExtraSettings from "./UserExtraSettings";
import UserTelegramSettings from "./UserTelegramSettings";
import UserFormSaveBar from "./UserFormSaveBar";
import { menuTreeToMap } from "../utils/menuPermissions";

import styles from "./AddUser.module.scss";

// mobile — вид формы для Telegram (экран на всю ширину, поля в столбик)
const AddUser = ({ handleClose, onSuccess, sidePanels, mobile }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    employee_id: "",
    access_level: "absolute",
    ignore_gps_check: false,
    settings: { sidebarPosition: "left", startPage: "/home" },
    production_operation_ids: [],
    can_edit_sticker: true,
    production_own_only: false,
    telegram_work_punch: false,
    telegram_menu: null,
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
            getUserMenu({ platform: "web" }),
            getMenus(),
          ]);

        setUserMenus(userMenu);
        setAllMenus(allMenus);
        // Таблица прав показывает права текущего пользователя как стартовые —
        // сохраняем ровно то, что в ней видно, даже если её не открывали.
        setFormData((prev) => ({ ...prev, menu: menuTreeToMap(userMenu) }));

        setState({
          employees: employeeRes.data || employeeRes,
          branches: branchesRes.data || branchesRes,
          departments: departmentsRes.data || departmentsRes,
          loading: false,
          showPassword: false,
        });
      } catch (error) {
        console.error(error);
        showAlert(t("error"), "error");
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
      const payload = {
        ...formData,
        telegramId: formData.telegramId?.trim() || null,
      };
      const res = await addUser(payload);

      if (res.success) {
        showAlert(t("success"), "success");
        setTimeout(handleClose, 1500);
        onSuccess();
      }
    } catch (error) {
      showAlert(t("error"), "error");
    }
  };

  return (
    <form
      className={`${styles.addUser} ${mobile ? styles.mobile : ""}`}
      onSubmit={handleSubmit}
    >
      <div className={styles.header}>
        <h2>{t("addUser")}</h2>
        {!mobile && <Button text={t("save")} type={"submit"} />}
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("username")}</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label>{t("password")}</label>
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
              {state.showPassword ? t("hide") : t("show")}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("employee")}</label>
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
            value={formData.telegramId || ""}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("access")}</label>
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

        {formData.access_level === "branch" && (
          <div>
            <label className={styles.label}>
              {t("branches")}
              <span className={styles.sticker}>
                {formData?.branches?.length || 0}
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
                {formData?.departments?.length || 0}
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
          <UserMenuAccess
            panel={sidePanels?.access}
            allMenus={allMenus}
            userMenus={userMenus}
            menu={formData.menu}
            onChange={(updatedMenu) => handleMenuChange(updatedMenu)}
          />

          <UserExtraSettings
            panel={sidePanels?.extra}
            formData={formData}
            setFormData={setFormData}
            allMenus={allMenus}
          />
        </>
      )}

      <UserTelegramSettings
        panel={sidePanels?.telegram}
        allMenus={allMenus}
        formData={formData}
        setFormData={setFormData}
        menuSettingsEnabled={formData?.access_level !== "employee"}
      />

      {mobile && <UserFormSaveBar />}
    </form>
  );
};

export default AddUser;
