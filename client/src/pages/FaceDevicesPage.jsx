import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { usePermissions } from "../hooks/usePermissions";
import { useAlertStore } from "../stores/alertStore";
import {
  deleteFaceDeviceById,
  getFaceDevices,
  getFaceDevicesOnlineStatus,
  getFaceDevicesCapacity,
} from "../api/index";

import AddFaceDevice from "../components/AddFaceDevice";
import EditFaceDevice from "../components/EditFaceDevice";
import SyncFaceDevicesTime from "../components/SyncFaceDevicesTime";
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

import Search from "../components/Search";
import styles from "./FaceDevicesPage.module.scss";
import { ActionCell } from "../components/ActionButtons";
import { ScanFace, CheckCircle, XCircle, Clock } from "lucide-react";
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
  const { widgetsVisible } = useWidgetsStore();
  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const { showAlert } = useAlertStore();
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [capacity, setCapacity] = useState({});
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

  const handleDeleteClick = (id) => {
    setSelectedItem(id);
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      await deleteFaceDeviceById(itemId);
      showAlert(t("success"), "success");
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(t("error"), "error");
    }
  };

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
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

  useEffect(() => {
    const localIds = data.filter((d) => d.is_local).map((d) => d.id);
    if (localIds.length === 0) {
      setOnlineStatus({});
      return;
    }

    const checkOnline = () => {
      getFaceDevicesOnlineStatus(localIds)
        .then(setOnlineStatus)
        .catch((err) => console.error("Ошибка проверки статуса устройств:", err));
    };

    checkOnline();
    const interval = setInterval(checkOnline, 15000);
    return () => clearInterval(interval);
  }, [data]);

  useEffect(() => {
    const ids = data.map((d) => d.id);
    if (ids.length === 0) {
      setCapacity({});
      return;
    }

    const checkCapacity = () => {
      getFaceDevicesCapacity(ids)
        .then(setCapacity)
        .catch((err) => console.error("Ошибка получения вместимости устройств:", err));
    };

    checkCapacity();
    const interval = setInterval(checkCapacity, 15000);
    return () => clearInterval(interval);
  }, [data]);

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

  const getSortValue = (item, field) =>
    field === "door_name" ? item.door?.name || "" : item[field];

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = getSortValue(a, sortField);
      let bVal = getSortValue(b, sortField);

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

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  return (
    <div className={styles.faceDevicesPage}>
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
                    label={t("totalDevicesLabel")}
                    value={totalItems}
                  />
                  <StatWidget
                    icon={CheckCircle}
                    color="#10b981"
                    label={t("activeCount")}
                    value={data.filter((x) => x.status === "active").length}
                    sub={`/ ${data.length}`}
                  />
                  <StatWidget
                    icon={XCircle}
                    color="#ef4444"
                    label={t("inactiveCount")}
                    value={data.filter((x) => x.status !== "active").length}
                  />
                </div>
              </div>
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

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
              {canAdd && (
                <Button text={t("add")} onClick={() => setModalType("add")} />
              )}

              {canEdit && (
                <button
                  type="button"
                  className={styles.syncTimeBtn}
                  title={t("syncTime")}
                  onClick={() => setModalType("syncTime")}
                >
                  <Clock size={16} />
                  <span>{t("syncTime")}</span>
                </button>
              )}

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
                  <th onClick={() => handleSort("device_ip")}>
                    <span className={styles.headerContent}>
                      {t("ipAddress")}
                      <SortArrow
                        active={sortField === "device_ip"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("mac_address")}>
                    <span className={styles.headerContent}>
                      {t("macAddress")}
                      <SortArrow
                        active={sortField === "mac_address"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("port")}>
                    <span className={styles.headerContent}>
                      {t("port")}
                      <SortArrow
                        active={sortField === "port"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("door_name")}>
                    <span className={styles.headerContent}>
                      {t("door")}
                      <SortArrow
                        active={sortField === "door_name"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("direction")}>
                    <span className={styles.headerContent}>
                      {t("direction")}
                      <SortArrow
                        active={sortField === "direction"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("is_local")}>
                    <span className={styles.headerContent}>
                      {t("localDevice")}
                      <SortArrow
                        active={sortField === "is_local"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th>
                    <span className={styles.headerContent}>
                      {t("availability")}
                    </span>
                  </th>
                  <th>
                    <span className={styles.headerContent}>
                      {t("registeredUsers")}
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
                      <td>{i + 1}</td>
                      <td>{item.name}</td>
                      <td>{item.id}</td>
                      <td>
                        {item.device_ip ? (
                          <a
                            href={`http://${item.device_ip}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.device_ip}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{item.mac_address || "—"}</td>
                      <td>{item.port}</td>
                      <td>{item.door.name}</td>
                      <td>{t(item.direction)}</td>
                      <td>{item.is_local ? t("yes") : t("no")}</td>
                      <td>
                        {item.is_local && (
                          <span
                            className={`${styles.onlineDot} ${
                              onlineStatus[item.id]
                                ? styles.onlineDotGreen
                                : styles.onlineDotRed
                            }`}
                          />
                        )}
                      </td>
                      <td>
                        {capacity[item.id]
                          ? `${capacity[item.id].registered ?? "?"} / ${capacity[item.id].capacity ?? "?"}`
                          : "—"}
                      </td>
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
                    <td colSpan="13">{t("noData")}</td>
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
        {modalType === "syncTime" && (
          <SyncFaceDevicesTime
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
