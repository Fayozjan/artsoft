import { useState, useRef, useEffect } from "react";

import { getActiveDoors } from "../api";

import SelectWithSearch from "./SelectWithSearch";

import styles from "./FaceDeviceFilter.module.scss";

const FaceDeviseFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [doors, setDoors] = useState([]);

  const initialFormData = {
    door_id: "",
    direction: "",
    status: "",
  };

  const activeCount = Object.entries(formData).filter(
    ([key, value]) => key !== "search" && value !== "",
  ).length;

  const wrapperRef = useRef(null);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  const handleReset = () => {
    setFormData(initialFormData);
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
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </div>

      {isOpen && (
        <div className={styles.filterContent}>
          <form onSubmit={onSubmit}>
            <div>
              <h2>{t("door")}</h2>
              <SelectWithSearch
                value={formData.door_id}
                options={doors}
                data="door"
                placeholder={t("selectDoor")}
                setFormData={setFormData}
                noMatches={t("noMatches")}
              />
            </div>

            <div>
              <h2>{t("direction")}</h2>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
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

                <label className={styles.checkboxLabel}>
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

                <label className={styles.checkboxLabel}>
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

            <div>
              <h2>{t("status")}</h2>
              <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name=""
                    value=""
                    checked={formData.status === ""}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, status: "" }))
                    }
                  />
                  {t("all")}
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="status"
                    value="true"
                    checked={formData.status === "true"}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, status: "true" }))
                    }
                  />
                  {t("true")}
                </label>

                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="status"
                    value="false"
                    checked={formData.status === "false"}
                    onChange={() =>
                      setFormData((prev) => ({ ...prev, status: "false" }))
                    }
                  />
                  {t("false")}
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

export default FaceDeviseFilter;
