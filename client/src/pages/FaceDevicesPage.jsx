import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { usePermissions } from "../hooks/usePermissions";
import { getFaceDevices } from "../api/index";

import AddFaceDevice from "../components/AddFaceDevice";
import EditFaceDevice from "../components/EditFaceDevice";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import SortArrow from "../components/SortArrow";
import FaceDeviceFilter from "../components/FaceDeviceFilter";
import CenterModal from "../components/CenterModal";
import OverlaySidebar from "../components/OverlaySidebar";
import DownloadButton from "../components/DownloadButton";
import TableIcons from "../icons/tableIcons";

import styles from "./FaceDevicesPage.module.scss";

const FaceDevicesPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();
  const currentPath = window.location.pathname;
  const { canCreate, canEdit, canDelete } = usePermissions(currentPath);
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [formData, setFormData] = useState({
    door_id: "",
    direction: "",
    search: "",
    status: "",
  });

  const handleEditClick = (id) => {
    setSelectedItem(id);
    setModalType("edit");
  };

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize
  ) => {
    setLoading(true);
    try {
      const { data, pagination } = await getFaceDevices({
        page,
        pageSize: size,
        filters,
      });

      setData(data);
      setTotalPages(pagination.totalPages);
      setCurrentPage(pagination.currentPage);
      setTotalItems(pagination.totalItems);
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
      Math.min(prevPage, Math.ceil(totalItems / size))
    );
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Пустые значения идут в конец
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Если поле — IP
      if (sortField === "device_ip") {
        const parseIP = (ip) =>
          ip.split(".").map((octet) => parseInt(octet, 10) || 0);

        const aParts = parseIP(aVal);
        const bParts = parseIP(bVal);

        for (let i = 0; i < 4; i++) {
          if (aParts[i] !== bParts[i]) {
            return sortOrder === "asc"
              ? aParts[i] - bParts[i]
              : bParts[i] - aParts[i];
          }
        }
        return 0;
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

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, formData, pageSize);
  };

  return (
    <div className={styles.faceDevicesPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <div className={styles.searchInput}>
                <svg
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

              <FaceDeviceFilter
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
              {canCreate && (
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
                  <th
                    className={styles.table_name_header}
                    onClick={() => handleSort("name")}
                  >
                    <span className={styles.headerContent}>
                      Имя
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
                  <th onClick={() => handleSort("device_ip")}>
                    <span className={styles.headerContent}>
                      IP адресс
                      <SortArrow
                        active={sortField === "device_ip"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("port")}>
                    <span className={styles.headerContent}>
                      Порт
                      <SortArrow
                        active={sortField === "port"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("door_name")}>
                    <span className={styles.headerContent}>
                      Дверь
                      <SortArrow
                        active={sortField === "door_name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("direction")}>
                    <span className={styles.headerContent}>
                      Направление
                      <SortArrow
                        active={sortField === "direction"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      Статус
                      <SortArrow
                        active={sortField === "status"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  {(canEdit || canDelete) && <th>Действие</th>}
                </tr>
              </thead>
              <tbody>
                {data?.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{i + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.id}</td>
                      <td>{item.device_ip}</td>
                      <td>{item.port}</td>
                      <td>{item.door.name}</td>
                      <td>{item.direction === "entry" ? "Вход" : "Выход"}</td>
                      <td>
                        <Badge text={item.status} />
                      </td>
                      {(canEdit || canDelete) && (
                        <td className={styles.actions}>
                          {canEdit && (
                            <TableIcons.edit
                              onClick={() => handleEditClick(item.id)}
                            />
                          )}
                          {canDelete && (
                            <TableIcons.delete
                              onClick={() => handleEditClick(item.id)}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11">Нет данных</td>
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
        title="Вы уверены, что хотите удалить?"
      />
      <OverlaySidebar
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        width="500px"
      >
        {modalType === "add" && (
          <AddFaceDevice
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              fetchData();
            }}
          />
        )}
        {modalType === "edit" && (
          <EditFaceDevice
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

export default FaceDevicesPage;
