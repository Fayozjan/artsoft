import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { getVehiclePasses } from "../api/vehiclePasses";

import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import VehiclePassesFilter from "../components/VehiclePassesFilter";
import DownloadButton from "../components/DownloadButton";
import VehiclePassesTable from "../components/VehiclePassesTable";
import { Icons } from "../icons/icons";

import Search from "../components/Search";
import styles from "./VehiclePassesPageWeb.module.scss";
import { Car, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useWidgetsStore } from "../stores/widgetsStore";

const StatWidget = ({ icon: Icon, color, label, value, sub, progress }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div
        className={styles.statWidgetIcon}
        style={{ background: color + "18" }}
      >
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>
          {value}
          {sub && <span className={styles.statWidgetSub}> {sub}</span>}
        </span>
      </div>
    </div>
    {progress != null && (
      <div className={styles.statWidgetProgressTrack}>
        <div
          className={styles.statWidgetProgressFill}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: color,
          }}
        />
      </div>
    )}
  </div>
);

const VehiclePassesPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [viewType, setViewType] = useState("card");
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const [widgetsScrollHidden, setWidgetsScrollHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleTableScroll = (e) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // мало данных — почти нечего скроллить, скрытие виджета меняет
    // высоту tableContainer и вызывает бесконечный hide/show (мигание)
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll < 40) {
      setWidgetsScrollHidden(false);
      return;
    }

    const delta = scrollTop - lastScrollTop;
    if (scrollTop <= 0) {
      setWidgetsScrollHidden(false);
    } else if (delta > 8) {
      setWidgetsScrollHidden(true);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const initialFormData = {
    start_date: `${today}T00:00`,
    end_date: `${today}T23:59`,
    branch_id: null,
    selectedGateIds: [],
  };

  const [formData, setFormData] = useState({
    start_date: `${today}T00:00`,
    end_date: `${today}T23:59`,
    branch_id: null,
    direction: "",
    selectedGateIds: [],
  });


  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);

    try {
      const { data, pagination } = await getVehiclePasses({
        page,
        pageSize: size,
        filters,
      });

      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (err) {
      console.error("Ошибка загрузки данных посещаемости:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  // Обработчик отправки формы
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData, pageSize);
  };

  // Обработчик смены страницы
  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
      }
    },
    [totalPages],
  );

  // Обработчик изменения размера страницы
  const handleChangePageSize = useCallback((e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  const handleViewChange = (type) => {
    setViewType(type);
  };

  return (
    <div className={styles.vehiclePassesPages}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {widgetsVisible && data.length > 0 && (
            <div
              className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
            >
              <div className={styles.statsGridInner}>
                <div className={styles.statsGrid}>
                  <StatWidget
                    icon={Car}
                    color="#6366f1"
                    label={t("totalPassesLabel")}
                    value={totalItems}
                  />
                  <StatWidget
                    icon={ArrowDownToLine}
                    color="#10b981"
                    label={t("forward")}
                    value={data.filter((x) => x.direction === "forward").length}
                  />
                  <StatWidget
                    icon={ArrowUpFromLine}
                    color="#f59e0b"
                    label={t("reverse")}
                    value={data.filter((x) => x.direction === "reverse").length}
                  />
                </div>
              </div>
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

              <VehiclePassesFilter
                initialFormData={initialFormData}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
              />

              <div className={styles.viewModeToggle}>
                <button
                  type="button"
                  className={viewType === "row" ? styles.active : ""}
                  title={t("listView")}
                  onClick={() => handleViewChange("row")}
                >
                  {Icons.list}
                  <span>{t("listView")}</span>
                </button>
                <button
                  type="button"
                  className={viewType === "card" ? styles.active : ""}
                  title={t("cardView")}
                  onClick={() => handleViewChange("card")}
                >
                  {Icons.card}
                  <span>{t("cardView")}</span>
                </button>
              </div>
            </div>

            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
            />

            <div className={styles.buttonsWrapper}>
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>

              {data.length > 0 && (
                <DownloadButton
                  text={t("save")}
                  // onClick={() => exportEmployeesToExcel(data)}
                />
              )}
            </div>
          </div>
          <VehiclePassesTable
            onScroll={handleTableScroll}
            data={data}
            currentPage={currentPage}
            pageSize={pageSize}
            viewType={viewType}
          />
        </div>
      )}
    </div>
  );
};

export default VehiclePassesPage;
