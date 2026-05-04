import { useState, useRef, useEffect, useCallback } from "react";

import { getActiveDoors, getDoors } from "../api";

import MultiSelectDoors from "./MultiSelectDoors";
import EmployeeFilterForm from "./EmployeeFilterForm";

import styles from "./FacePassesFilterTelegram.module.scss";

const FacePassesFilterTelegram = ({
  initialFormData,
  formData,
  setFormData,
  onSubmit,
  t,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [doors, setDoors] = useState([]);

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
        const { data } = await getDoors();
        setDoors(data);
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
  const handleDoorsChange = (selectedDoors) => {
    setFormData((prev) => ({
      ...prev,
      selectedDoorIds: selectedDoors,
    }));
  };

  useEffect(() => {
    const fetchData = async () => {
      const doors = await getActiveDoors();

      if (doors.success) {
        setDoors(doors.data);
      }
    };

    fetchData();
  }, []);

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
        <span>{t("filters")}</span>
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <div className={styles.row}>
              <div>
                <h2>{t("dateFrom")}</h2>
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
                <h2>{t("dateTo")}</h2>
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
              filters={["branch", "department", "position"]}
              formData={formData}
              setFormData={setFormData}
            />

            <div>
              <h2>{t("door")}</h2>
              <MultiSelectDoors
                options={doors}
                selected={formData.selectedDoorIds}
                onChange={handleDoorsChange}
              />
            </div>

            <div>
              <h2>{t("direction")}</h2>
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
                  {t("all")}
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="direction"
                    value="entry"
                    checked={formData.direction === "entry"}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, direction: "entry" }))
                    }
                  />
                  {t("entry")}
                </label>

                <label>
                  <input
                    type="checkbox"
                    name="direction"
                    value="exit"
                    checked={formData.direction === "exit"}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, direction: "exit" }))
                    }
                  />
                  {t("exit")}
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

export default FacePassesFilterTelegram;
