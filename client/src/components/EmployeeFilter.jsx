import { useState, useRef, useEffect } from "react";
import EmployeeFilterForm from "./EmployeeFilterForm";
import styles from "./EmployeeFilter.module.scss";

const EmployeeFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);

  const initialFormData = {
    branch_id: "",
    department_id: "",
    employee_id: "",
    position_id: "",
    gender: "",
    status: "",
  };

  const statusOptions = [
    { label: t("all"), value: "" },
    { label: t("active"), value: true },
    { label: t("terminated"), value: false },
  ];

  const activeCount = Object.entries(formData).filter(
    ([key, value]) => key !== "search" && value !== ""
  ).length;

  const wrapperRef = useRef(null);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleReset = () => {
    setFormData(initialFormData);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEsc = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    document.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
      document.removeEventListener("scroll", handleScroll);
    };
  }, [isOpen]);

  return (
    <div ref={wrapperRef} className={styles.filterToggle}>
      <div
        className={`${styles.toggleBtn} + ${activeCount ? styles.active : ""}`}
        onClick={toggleOpen}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="200"
          height="200"
          viewBox="0 0 32 32"
        >
          <path
            fill="none"
            stroke="#000000"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M2 5s4-2 14-2s14 2 14 2L19 18v9l-6 3V18L2 5Z"
          />
        </svg>
        <span>Фильтры</span>
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <EmployeeFilterForm
              filters={["branch", "department", "employee", "position"]}
              formData={formData}
              setFormData={setFormData}
            />

            <div className={styles.statusChips}>
              {statusOptions.map((option) => (
                <div
                  key={option.value === "" ? "all" : option.value.toString()}
                  className={`${styles.chip} ${
                    formData.status === option.value ? styles.active : ""
                  }`}
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, status: option.value }))
                  }
                >
                  {option.label}
                </div>
              ))}
            </div>

            <div className={styles.genderRadio}>
              <label>
                <input
                  type="radio"
                  name="gender"
                  value=""
                  checked={formData.gender === ""}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, gender: "" }))
                  }
                />
                Все
              </label>

              <label>
                <input
                  type="radio"
                  name="gender"
                  value="male"
                  checked={formData.gender === "male"}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, gender: "male" }))
                  }
                />
                Муж
              </label>

              <label>
                <input
                  type="radio"
                  name="gender"
                  value="female"
                  checked={formData.gender === "female"}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, gender: "female" }))
                  }
                />
                Жен
              </label>
            </div>

            <div className={styles.actions}>
              <button type="button" onClick={handleReset}>
                {t("clearAll")}
              </button>
              <button type="submit">{t("apply")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default EmployeeFilter;
