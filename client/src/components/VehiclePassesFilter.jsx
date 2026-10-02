import { useState, useRef, useEffect, useCallback } from "react";

import { getActiveGates } from "../api";
import { Icons } from "../icons/icons";

import MultiSelectDoors from "./MultiSelectDoors";
import EmployeeFilterForm from "./EmployeeFilterForm";

import styles from "./VehiclePassesFilter.module.scss";

const SegmentedGroup = ({ label, options, value, onChange }) => {
  const activeIdx = options.findIndex((o) => o.value === value);
  return (
    <div className={styles.segmentedGroup}>
      <span className={styles.segmentedLabel}>{label}</span>
      <div className={styles.segmentedTrack}>
        <div
          className={styles.segmentedSlider}
          style={{
            width: `calc(${100 / options.length}% - 4px)`,
            left: `calc(${activeIdx * (100 / options.length)}% + 2px)`,
          }}
        />
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.segmentedBtn} ${value === opt.value ? styles.segmentedBtnActive : ""}`}
            style={{ color: value === opt.value ? opt.color : undefined }}
            onClick={() => onChange(opt.value)}
          >
            <span style={{ color: opt.color, display: "flex", alignItems: "center" }}>
              {opt.icon}
            </span>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

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
        {Icons.filter}
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <div className={styles.row}>
              <div>
                <h2>{t("filterFrom")}</h2>
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
                <h2>{t("filterTo")}</h2>
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
              <h2>{t("gates")}</h2>
              <MultiSelectDoors
                options={gates}
                selected={formData.selectedGateIds || []}
                placeholder={t("selectGates")}
                onChange={handleGateChange}
              />
            </div>

            <SegmentedGroup
              label={t("direction")}
              options={[
                { value: "", label: t("all"), color: "#6b7280", icon: Icons.dot },
                { value: "forward", label: t("forward"), color: "#16a34a", icon: Icons.arrowForward },
                { value: "reverse", label: t("reverse"), color: "#dc2626", icon: Icons.arrowBack },
              ]}
              value={formData.direction}
              onChange={(val) => setFormData((prev) => ({ ...prev, direction: val }))}
            />

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
