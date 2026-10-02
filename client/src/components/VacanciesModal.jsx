import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, X, Search, ChevronDown, ChevronRight } from "lucide-react";

import { getStaffingPositions } from "../api/staffingPosition";
import styles from "./VacanciesModal.module.scss";

export default function VacanciesModal({ isOpen, onClose, departments }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [positionData, setPositionData] = useState({});
  const [positionLoading, setPositionLoading] = useState({});
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    setPortalContainer(el);
    return () => document.body.removeChild(el);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setExpandedId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const vacancyDepts = useMemo(
    () => (departments || []).filter((d) => (d.vacancies || 0) > 0),
    [departments],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return vacancyDepts;
    const q = search.toLowerCase();
    return vacancyDepts.filter(
      (d) =>
        (d.name || "").toLowerCase().includes(q) ||
        (d.branch_name || "").toLowerCase().includes(q),
    );
  }, [vacancyDepts, search]);

  const totalVacancies = vacancyDepts.reduce((s, d) => s + (d.vacancies || 0), 0);

  const handleExpand = async (deptId) => {
    if (expandedId === deptId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(deptId);
    if (positionData[deptId]) return;
    setPositionLoading((prev) => ({ ...prev, [deptId]: true }));
    try {
      const res = await getStaffingPositions(deptId);
      setPositionData((prev) => ({ ...prev, [deptId]: res.data || [] }));
    } catch {
      // silent
    } finally {
      setPositionLoading((prev) => ({ ...prev, [deptId]: false }));
    }
  };

  if (!portalContainer) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIcon}>
                  <Briefcase size={20} color="#f59e0b" strokeWidth={2} />
                </div>
                <div className={styles.headerText}>
                  <h2 className={styles.title}>{t("vacancies")}</h2>
                  <span className={styles.subtitle}>{t("vacanciesSubtitle")}</span>
                </div>
              </div>
              <div className={styles.headerRight}>
                <div className={styles.totalBadge}>{totalVacancies}</div>
                <button className={styles.closeBtn} onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder={t("vacanciesSearchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <AnimatePresence>
                {search && (
                  <motion.button
                    className={styles.clearSearch}
                    onClick={() => setSearch("")}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.12 }}
                  >
                    <X size={12} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {filtered.length > 0 && (
              <div className={styles.listMeta}>
                <span>
                  {filtered.length} {t("departmentsShort")}
                </span>
                <span>
                  {t("vacanciesCountShort", {
                    count: filtered.reduce((s, d) => s + (d.vacancies || 0), 0),
                  })}
                </span>
              </div>
            )}

            <div className={styles.list}>
              {filtered.length === 0 ? (
                <div className={styles.empty}>
                  <Briefcase size={32} strokeWidth={1.5} />
                  <span>{t("vacanciesNotFound")}</span>
                </div>
              ) : (
                filtered.map((dept) => {
                  const isExpanded = expandedId === dept.id;
                  const positions = positionData[dept.id];
                  const loading = positionLoading[dept.id];
                  const vacancyPositions = positions?.filter((p) => Number(p.vacancies) > 0);

                  return (
                    <div key={dept.id} className={styles.deptBlock}>
                      <div
                        className={`${styles.deptRow} ${isExpanded ? styles.deptRowExpanded : ""}`}
                        onClick={() => handleExpand(dept.id)}
                      >
                        <span className={styles.chevron}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        <div className={styles.deptInfo}>
                          <span className={styles.deptName}>{dept.name}</span>
                          <span className={styles.branchName}>{dept.branch_name}</span>
                        </div>
                        <div className={styles.deptMeta}>
                          <div className={styles.vacancyBadge}>
                            <Briefcase size={10} />
                            {dept.vacancies}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            className={styles.positionList}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            style={{ overflow: "hidden" }}
                          >
                            {loading ? (
                              <div className={styles.positionLoading}>
                                <span className={styles.loadingDot} />
                                <span className={styles.loadingDot} />
                                <span className={styles.loadingDot} />
                              </div>
                            ) : !vacancyPositions || vacancyPositions.length === 0 ? (
                              <div className={styles.positionEmpty}>{t("noPositionsData")}</div>
                            ) : (
                              vacancyPositions.map((p, i) => (
                                <div key={p.position_id ?? i} className={styles.positionRow}>
                                  <span className={styles.positionName}>{p.position_name}</span>
                                  <div className={styles.positionStats}>
                                    <span className={styles.posVacancyBadge}>
                                      {Number(p.vacancies)}
                                    </span>
                                  </div>
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
}
