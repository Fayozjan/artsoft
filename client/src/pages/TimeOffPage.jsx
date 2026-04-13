import { useState, useEffect, useCallback } from "react";
import { DateTime } from "luxon";

import { deleteTimeOff, getTimeOff } from "../api";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../hooks/usePermissions";
import { downloadPermissionPdf } from "../utils/DocGenerator";
import { useAlertStore } from "../stores/alertStore";

import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import Button from "../components/Button";
import SortArrow from "../components/SortArrow";
import TimeOffFilter from "../components/TimeOffFilter";
import DownloadButton from "../components/DownloadButton";
import CenterModal from "../components/CenterModal";
import OverlaySidebar from "../components/OverlaySidebar";
import AddTimeOff from "../components/AddTimeOff";
import EditTimeOff from "../components/EditTimeOff";

import styles from "./TimeOffPage.module.scss";
import { formatIsoToLocalDateTime } from "../utils/date";
import { ActionCell } from "../components/ActionButtons";

const TimeOffPage = () => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [sortField, setSortField] = useState("date_from");
  const [sortOrder, setSortOrder] = useState("asc");

  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const now = DateTime.now().setZone("Asia/Tashkent");

  const [formData, setFormData] = useState({
    date_from: now.startOf("month").toFormat("yyyy-MM-dd 00:00"),
    date_to: now.toFormat("yyyy-MM-dd 23:59"),
    branch_id: null,
    department_id: null,
    position_id: null,
  });

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    setData([]);
    try {
      const { data, pagination } = await getTimeOff({
        page,
        pageSize: size,
        filters,
      });
      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (err) {
      console.error("Ошибка при загрузке списка разрещений:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка данных
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

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, formData, pageSize);
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Пустые значения идут в конец
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Если сортируем по времени события
      if (sortField === "date_from") {
        const aDate = new Date(aVal);
        const bDate = new Date(bVal);

        if (!isNaN(aDate) && !isNaN(bDate)) {
          return sortOrder === "asc" ? aDate - bDate : bDate - aDate;
        }
      }

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
        ? String(aVal).localeCompare(String(bVal), "ru", {
            sensitivity: "base",
          })
        : String(bVal).localeCompare(String(aVal), "ru", {
            sensitivity: "base",
          });
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

  const handleEditClick = (itemId) => {
    setSelectedItem(itemId);
    setModalType("edit");
  };

  const handleDeleteClick = (itemId) => {
    setSelectedItem(itemId);
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      await deleteTimeOff(itemId);
      showAlert(t("success"), "success");
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(t("error"), "error");
    }
  };

  return (
    <div className={styles.timeOffPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <div className={styles.searchInput}>
                <svg
                  onClick={() => handleSearch()}
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="19"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#000000"
                    d="M15.096 5.904a6.5 6.5 0 1 0-9.192 9.192a6.5 6.5 0 0 0 9.192-9.192ZM4.49 4.49a8.5 8.5 0 0 1 12.686 11.272l5.345 5.345l-1.414 1.414l-5.345-5.345A8.501 8.501 0 0 1 4.49 4.49Z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder={t("search")}
                  value={formData.search || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />

                {formData.search && (
                  <svg
                    className={styles.clearBtn}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        search: "",
                      }));
                    }}
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="18"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="none"
                      stroke="#000000"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </div>

              <TimeOffFilter
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="200"
                  height="200"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="#000000"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"
                  />
                </svg>

                <span>Обновить данные</span>
              </div>

              {data.length > 0 && (
                <DownloadButton
                  text={t("save")}
                  // onClick={() => exportEmployeesToExcel(data)}
                />
              )}
            </div>
          </div>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th onClick={() => handleSort("id")}>
                    <span className={styles.headerContent}>
                      Номер
                      <SortArrow
                        active={sortField === "id"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th
                    className={styles.table_name_header}
                    onClick={() => handleSort("employeeFullName")}
                  >
                    <span className={styles.headerContent}>
                      ФИО
                      <SortArrow
                        active={sortField === "employeeFullName"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("branch_name")}>
                    <span className={styles.headerContent}>
                      Филиал
                      <SortArrow
                        active={sortField === "branch_name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("department_name")}>
                    <span className={styles.headerContent}>
                      Отдел
                      <SortArrow
                        active={sortField === "department_name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("position_name")}>
                    <span className={styles.headerContent}>
                      Должность
                      <SortArrow
                        active={sortField === "position_name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th>Тип</th>
                  <th>Причина</th>
                  <th onClick={() => handleSort("date_from")}>
                    <span className={styles.headerContent}>
                      Дата от
                      <SortArrow
                        active={sortField === "date_from"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("date_to")}>
                    <span className={styles.headerContent}>
                      Дата до
                      <SortArrow
                        active={sortField === "date_to"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("is_company_paid")}>
                    <span className={styles.headerContent}>
                      За счет компании
                      <SortArrow
                        active={sortField === "is_company_paid"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("creatorFullName")}>
                    <span className={styles.headerContent}>
                      Добавил
                      <SortArrow
                        active={sortField === "creatorFullName"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th>{(canEdit || canDelete) && t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{(currentPage - 1) * pageSize + i + 1}</td>
                      <td>{item.id}</td>
                      <td>{item.employeeFullName}</td>
                      <td>{item.branch_name}</td>
                      <td>{item.department_name}</td>
                      <td>{item.position_name}</td>
                      <td>{t(item.type)}</td>
                      <td>{item.reason}</td>
                      <td>
                        {item.type === "hour"
                          ? formatIsoToLocalDateTime(item.date_from)
                          : formatIsoToLocalDate(item.date_from)}
                      </td>
                      <td>
                        {item.type === "hour"
                          ? formatIsoToLocalDateTime(item.date_to)
                          : formatIsoToLocalDate(item.date_to)}
                      </td>
                      <td>{item.is_company_paid === true ? "Да" : "Нет"}</td>
                      <td>{item.creatorFullName}</td>
                      {
                        <ActionCell
                          item={item}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onDownload={downloadPermissionPdf}
                          onEdit={handleEditClick}
                          onDelete={handleDeleteClick}
                        />
                      }
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="12">Нет данных</td>
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
        tag="Удаление"
      />

      <OverlaySidebar
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={modalType === "add" ? t("addHoliday") : t("editHoliday")}
        width="500px"
      >
        {modalType === "add" && (
          <AddTimeOff
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
            }}
          />
        )}
        {modalType === "edit" && (
          <EditTimeOff
            id={selectedItem}
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
            }}
          />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default TimeOffPage;
