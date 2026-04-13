import { useState, useRef, useEffect, useCallback } from "react";

import { getActiveGates } from "../api";

import MultiSelectDoors from "./MultiSelectDoors";
import EmployeeFilterForm from "./EmployeeFilterForm";

import styles from "./FacePassesFilter.module.scss";

const FacePassesFilter = ({
  initialFormData,
  formData,
  setFormData,
  onSubmit,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [gates, setGates] = useState([]);

  const activeCount = Object.entries(formData).filter(
    ([key, value]) =>
      key !== "search" &&
      value != null &&
      value !== "" &&
      (!Array.isArray(value) || value.length > 0),
  ).length;

  const wrapperRef = useRef(null);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleReset = () => {
    setFormData(initialFormData);
  };

  // Загрузка дверей
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await getActiveGates();
        setGates(data);
      } catch (err) {
        console.error("Ошибка загрузки данных:", err.message);
      }
    };
    fetchData();
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  }, []);

  // Обработчик изменения дверей
  const handleGateChange = (selectedGates) => {
    setFormData((prev) => ({
      ...prev,
      selectedGateIds: selectedGates,
    }));
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
            <div className={styles.row}>
              <div>
                <h2>Дата от</h2>
                <input
                  className={styles.date}
                  id="date_from"
                  type="datetime-local"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              </div>
              <div>
                <h2>Дата до</h2>
                <input
                  className={styles.date}
                  id="date_to"
                  type="datetime-local"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              </div>
            </div>

            <EmployeeFilterForm
              filters={["branch"]}
              formData={formData}
              setFormData={setFormData}
            />

            <div>
              <h2>Ворота</h2>
              <MultiSelectDoors
                options={gates}
                selected={formData.selectedGateIds || []}
                placeholder="Выберите ворота"
                onChange={handleGateChange}
              />
            </div>

            <div>
              <h2>Направление</h2>
              <div className={styles.status}>
                <label>
                  <input
                    type="checkbox"
                    name=""
                    value=""
                    checked={formData.direction === ""}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, direction: "" }))
                    }
                  />
                  Все
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="direction"
                    value="forward"
                    checked={formData.direction === "forward"}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, direction: "forward" }))
                    }
                  />
                  Въезд
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="direction"
                    value="reverse"
                    checked={formData.direction === "reverse"}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, direction: "reverse" }))
                    }
                  />
                  Выезд
                </label>
              </div>
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

export default FacePassesFilter;
