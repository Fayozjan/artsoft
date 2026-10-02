import { useState, useRef, useEffect } from "react";

import { getActiveGates } from "../api";

import SelectWithSearch from "./SelectWithSearch";
import SegmentedGroup, {
  statusSegments,
  directionSegments,
} from "./SegmentedGroup";
import { Icons } from "../icons/icons";

import styles from "./FaceDeviceFilter.module.scss";

const AnprCameraFilter = ({ formData, setFormData, onSubmit, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [gates, setGates] = useState([]);

  const initialFormData = {
    gate_id: "",
    direction: "",
    status: "",
    search: "",
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
      const res = await getActiveGates();

      if (res.success) {
        setGates(res.data);
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
              <h2>{t("gates")}</h2>
              <SelectWithSearch
                value={formData.gate_id}
                options={gates}
                data="gate"
                placeholder={t("selectGates")}
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

export default AnprCameraFilter;
