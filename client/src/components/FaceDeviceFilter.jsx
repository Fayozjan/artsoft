import { useState, useRef, useEffect } from "react";

import { getActiveDoors } from "../api";

import SelectWithSearch from "./SelectWithSearch";
import SegmentedGroup, {
  statusSegments,
  directionSegments,
} from "./SegmentedGroup";
import { Icons } from "../icons/icons";

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
        {Icons.filter}
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

            <SegmentedGroup
              label={t("direction")}
              options={directionSegments(t)}
              value={formData.direction}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, direction: val }))
              }
            />

            <SegmentedGroup
              label={t("status")}
              options={statusSegments(t)}
              value={formData.status}
              onChange={(val) =>
                setFormData((prev) => ({ ...prev, status: val }))
              }
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

export default FaceDeviseFilter;
