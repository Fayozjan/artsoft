import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { FacePassesService } from "../api";
import { usePermissions } from "../hooks/usePermissions";
import { useAlertStore } from "../stores/alertStore";

import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import FacePassesTable from "../components/FacePassesTable";
import FacePassesFilter from "../components/FacePassesFilter";
import FacePassesColumnToggle from "../components/FacePassesColumnToggle";
import DownloadButton from "../components/DownloadButton";
import CenterModal from "../components/CenterModal";
import OverlaySidebar from "../components/OverlaySidebar";
import EditFacePassTime from "../components/EditFacePassTime";

import Search from "../components/Search";
import styles from "./FacePassesPageWeb.module.scss";
import { ScanFace, LogIn, LogOut } from "lucide-react";
import { Icons } from "../icons/icons";
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

const FacePassesPageWeb = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const { showAlert } = useAlertStore();

  const currentPath = window.location.pathname;
  const { canEdit, canDelete } = usePermissions(currentPath);

  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
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

  const [visibleColumns, setVisibleColumns] = useState({
    location: false,
    source: false,
  });

  const today = new Date().toISOString().slice(0, 10);

  const initialFormData = {
    start_date: `${today}T00:00`,
    end_date: `${today}T23:59`,
    branch_id: null,
    department_id: null,
    position_id: null,
    direction: "",
    source: "",
    selectedDoorIds: [],
  };

  const [formData, setFormData] = useState({
    start_date: `${today}T00:00`,
    end_date: `${today}T23:59`,
    branch_id: null,
    department_id: null,
    position_id: null,
    direction: "",
    source: "",
    selectedDoorIds: [],
  });


  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);

    try {
      const { data, pagination } = await FacePassesService.getFacePasses({
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

  const handleDelete = async () => {
    try {
      await FacePassesService.deleteFacePass(deleteItem.id);
      showAlert(t("success"), "success");
      setDeleteItem(null);
      fetchData();
    } catch (err) {
      console.error("Ошибка при удалении события посещаемости:", err.message);
      showAlert(t("error"), "error");
    }
  };

  return (
    <div className={styles.facePassesPages}>
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
                icon={ScanFace}
                color="#6366f1"
                label={t("totalFacePassesLabel")}
                value={totalItems}
              />
              <StatWidget
                icon={LogIn}
                color="#10b981"
                label={t("entry")}
                value={data.filter((x) => x.direction === "entry").length}
              />
              <StatWidget
                icon={LogOut}
                color="#ef4444"
                label={t("exit")}
                value={data.filter((x) => x.direction === "exit").length}
              />
                </div>
              </div>
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

              <FacePassesFilter
                initialFormData={initialFormData}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
              />
              <FacePassesColumnToggle
                visibleColumns={visibleColumns}
                onChange={setVisibleColumns}
              />
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
          <FacePassesTable
            onScroll={handleTableScroll}
            data={data}
            currentPage={currentPage}
            pageSize={pageSize}
            visibleColumns={visibleColumns}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={setEditItem}
            onDelete={setDeleteItem}
          />
        </div>
      )}

      <CenterModal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onAccept={handleDelete}
        tag={t("deletion")}
      />

      <OverlaySidebar
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        width="400px"
      >
        {editItem && (
          <EditFacePassTime
            item={editItem}
            handleClose={() => setEditItem(null)}
            onSuccess={() => fetchData()}
          />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default FacePassesPageWeb;
