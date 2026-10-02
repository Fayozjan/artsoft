import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, ChevronRight, Briefcase } from "lucide-react";

import { getDepartmentsStaffingOverview } from "../api/departments";
import Loading from "./Loading";

import styles from "./DepartmentCards.module.scss";

const DepartmentCards = ({ onSelect, search = "", onScroll }) => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getDepartmentsStaffingOverview();
        const sorted = [...(res.data || [])].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
        );
        setData(sorted);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (dept) =>
        (dept.name || "").toLowerCase().includes(q) ||
        (dept.branch_name || "").toLowerCase().includes(q),
    );
  }, [data, search]);

  if (loading) return <Loading />;

  return (
    <div className={styles.cardsContainer} onScroll={onScroll}>
      {!filteredData.length ? (
        <div className={styles.noData}>{t("noData")}</div>
      ) : (
      <div className={styles.departmentList}>
        {filteredData.map((dept) => {
          const planned = dept.planned || 0;
          const actual = dept.actual || 0;
          const fillPct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
          const isOver = planned > 0 && actual > planned;
          const vacancies = dept.vacancies || 0;

          return (
            <div
              className={styles.departmentRow}
              key={dept.id}
              onClick={() => onSelect(dept)}
            >
              <div className={styles.departmentRowIcon}>
                <Building2 size={13} strokeWidth={2} />
              </div>

              <div
                className={styles.departmentRowTitles}
                title={[dept.name, dept.branch_name].filter(Boolean).join(" · ")}
              >
                <span className={styles.departmentRowName}>{dept.name}</span>
                <span className={styles.departmentRowBranch}>{dept.branch_name}</span>
              </div>

              <div className={styles.departmentRowTrack}>
                <div
                  className={`${styles.departmentRowFill} ${isOver ? styles.over : ""}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>

              {vacancies > 0 && (
                <div className={styles.departmentRowVacancies}>
                  <Briefcase size={11} strokeWidth={2.2} />
                  {vacancies} {t("vacancies")}
                </div>
              )}

              <div className={styles.departmentRowStats}>
                <span className={styles.departmentRowStatsCaption}>{t("planPrefix")}</span>
                <span className={styles.departmentRowStatPlanned}>{planned}</span>
                <span className={styles.departmentRowStatSep}>/</span>
                <span
                  className={`${styles.departmentRowStatValue} ${isOver ? styles.over : ""}`}
                >
                  {actual}
                </span>
                <span className={styles.departmentRowStatsCaption}>{t("actualLabel")}</span>
              </div>

              <ChevronRight size={14} className={styles.departmentRowChevron} />
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default DepartmentCards;
