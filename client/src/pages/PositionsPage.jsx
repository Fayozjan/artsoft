import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { deletePositionById, getPositions, importPositionsExcel } from "../api";
import { usePermissions } from "../hooks/usePermissions";
import { downloadPositionImportTemplate } from "../utils/DocGenerator";

import Button from "../components/Button";
import Badge from "../components/Badge";
import AddPosition from "../components/AddPosition";
import EditPosition from "../components/EditPosition";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import SortArrow from "../components/SortArrow";

import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import TableFilter from "../components/TableFilter";
import DownloadButton from "../components/DownloadButton";

import styles from "./PositionsPage.module.scss";
import Search from "../components/Search";
import { Briefcase, Users, CheckCircle } from "lucide-react";

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
import { ActionCell } from "../components/ActionButtons";
import { Icons } from "../icons/icons";
import { useWidgetsStore } from "../stores/widgetsStore";

const PositionsPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importFileRef = useRef(null);
  const importMenuRef = useRef(null);
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
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const { showAlert } = useAlertStore();

  const [formData, setFormData] = useState({
    search: "",
    status: "",
  });


  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const handleEditClick = (id) => {
    setSelectedItem(id);
    setModalType("edit");
  };

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      await deletePositionById(itemId);
      showAlert(t("success"), "success");
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(t("error"), "error");
    }
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedItem(null);
  };

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const { data, pagination } = await getPositions({
        page,
        pageSize: size,
        filters,
      });
      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prevPage) =>
      Math.min(prevPage, Math.ceil(totalItems / size)),
    );
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Пустые значения идут в конец
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Преобразование к числу, если возможно
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      const isNumberA = !isNaN(aNum);
      const isNumberB = !isNaN(bNum);

      if (isNumberA && isNumberB) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Сравнение как строки
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  useEffect(() => {
    if (!showImportMenu) return;
    const handleClickOutside = (e) => {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) {
        setShowImportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showImportMenu]);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImportLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await importPositionsExcel(fd);
      setImportResult(result);
      fetchData(currentPage, formData, pageSize);
    } catch (err) {
      showAlert(err.response?.data?.error || t("errorOccurred"), "error");
    } finally {
      setImportLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData);
  };

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  return (
    <div className={styles.positionsPage}>
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
                icon={Briefcase}
                color="#6366f1"
                label={t("totalPositionsLabel")}
                value={totalItems}
              />
              <StatWidget
                icon={Users}
                color="#10b981"
                label={t("employees")}
                value={data.reduce((a, b) => a + (b.employees_count || 0), 0)}
              />
              <StatWidget
                icon={CheckCircle}
                color="#3b82f6"
                label={t("activeCount")}
                value={data.filter((x) => x.status === "active").length}
                sub={`/ ${data.length}`}
              />
                </div>
              </div>
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search
                formData={formData}
                setFormData={setFormData}
                onSearch={handleSearch}
              />

              <TableFilter
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
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
              {canAdd && (
                <Button text={t("add")} onClick={() => setModalType("add")} />
              )}

              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>

              <div className={styles.importMenuWrapper} ref={importMenuRef}>
                <button
                  className={styles.importMenuBtn}
                  type="button"
                  disabled={importLoading}
                  onClick={() => !importLoading && setShowImportMenu((v) => !v)}
                >
                  {importLoading && <span className={styles.spinner} />}
                  {importLoading
                    ? (t("loading") || "Загрузка...")
                    : (t("importExcel") || "Импортировать данные")}
                </button>
                {showImportMenu && !importLoading && (
                  <div className={styles.importMenuDropdown}>
                    <button
                      className={styles.importMenuItem}
                      onClick={async () => {
                        setShowImportMenu(false);
                        try {
                          const { data: allPositions } = await getPositions({ page: 1, pageSize: 99999, filters: {} });
                          downloadPositionImportTemplate(allPositions || [], t);
                        } catch (err) {
                          showAlert(err.response?.data?.error || t("errorOccurred"), "error");
                        }
                      }}
                    >
                      {t("downloadTemplate") || "Скачать шаблон"}
                    </button>
                    <button
                      className={styles.importMenuItem}
                      onClick={() => {
                        setShowImportMenu(false);
                        importFileRef.current?.click();
                      }}
                    >
                      {t("importData") || "Импортировать"}
                    </button>
                  </div>
                )}
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={handleImportFile}
                />
              </div>
            </div>
          </div>
          <div className={styles.tableContainer} onScroll={handleTableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th
                    className={styles.table_name_header}
                    onClick={() => handleSort("name")}
                  >
                    <span className={styles.headerContent}>
                      {t("name")}
                      <SortArrow
                        active={sortField === "name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("id")}>
                    <span className={styles.headerContent}>
                      ID
                      <SortArrow
                        active={sortField === "id"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("employees_count")}>
                    <span className={styles.headerContent}>
                      {t("employees")}
                      <SortArrow
                        active={sortField === "employees_count"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      {t("status")}
                      <SortArrow
                        active={sortField === "status"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  {(canEdit || canDelete) && <th>{t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {data?.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.id}</td>
                      <td>{item.employees_count}</td>
                      <td>
                        <Badge text={item.status} />
                      </td>
                      {
                        <ActionCell
                          item={item}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onEdit={handleEditClick}
                          onDelete={handleDeleteClick}
                        />
                      }
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11">{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CenterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAccept={() => handleDelete(selectedItem)}
        title={t("areYouSureDelete")}
      />
      <OverlaySidebar
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={modalType === "add" ? t("addPosition") : t("editPosition")}
        width="500px"
      >
        {modalType === "add" && (
          <AddPosition
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
              setTimeout(handleCloseModal, 500);
            }}
          />
        )}
        {modalType === "edit" && (
          <EditPosition
            id={selectedItem}
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
              setTimeout(handleCloseModal, 500);
            }}
          />
        )}
      </OverlaySidebar>

      {importResult && (
        <div className={styles.importOverlay} onClick={() => setImportResult(null)}>
          <div className={styles.importModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.importModalHeader}>
              <span>{t("importResult") || "Результат импорта"}</span>
              <button onClick={() => setImportResult(null)}>{Icons.clear}</button>
            </div>
            <div className={styles.importModalBody}>
              <p>✓ {t("created") || "Создано"}: <strong>{importResult.created ?? 0}</strong></p>
              <p>✓ {t("updated") || "Обновлено"}: <strong>{importResult.updated ?? 0}</strong></p>
              <p>— {t("unchanged") || "Без изменений"}: <strong>{importResult.unchanged ?? 0}</strong></p>
              {importResult.errors?.length > 0 && (
                <>
                  <p style={{ color: "#ef4444", marginTop: 12 }}>
                    ✗ {t("errors") || "Ошибок"}: <strong>{importResult.errors.length}</strong>
                  </p>
                  <ul style={{ fontSize: 13, color: "#ef4444", paddingLeft: 16, marginTop: 4 }}>
                    {importResult.errors.map((e, i) => (
                      <li key={i}>{t("row")} {e.row}: {e.error || e.code}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionsPage;
