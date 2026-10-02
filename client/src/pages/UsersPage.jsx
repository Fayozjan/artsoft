import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { usePermissions } from "../hooks/usePermissions";
import { useAlertStore } from "../stores/alertStore";

import {
  deleteUserById,
  getUsers,
  getLoginLockouts,
  unlockUserLogin,
} from "../api";

import Button from "../components/Button";
import Badge from "../components/Badge";
import AddUser from "../components/AddUser";
import EditUser from "../components/EditUser";
import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import SortArrow from "../components/SortArrow";
import OverlaySidebar from "../components/OverlaySidebar";
import CenterModal from "../components/CenterModal";
import TableFilter from "../components/TableFilter";
import DownloadButton from "../components/DownloadButton";

import Search from "../components/Search";
import styles from "./UsersPage.module.scss";
import { ActionCell, ActionButton } from "../components/ActionButtons";
import { Users, UserCheck, UserX, Lock, Unlock } from "lucide-react";
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

const accessLevelMap = {
  absolute: "access_absolute",
  branch: "access_branch",
  department: "access_department",
};

const viewModeMap = {
  absolute: "allBranches",
  branch: "byBranch",
};

const UsersPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [totalMenus, setTotalMenus] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  // Настройки логина (доступные меню, дополнительные настройки, настройки телеграм
  // приложения) — второй сайдбар слева от формы (leftPanel). Форма рисует в него через
  // портал: sideHost — узел панели, sideName — чьё содержимое сейчас в ней (остаётся
  // до конца анимации закрытия).
  const [sideName, setSideName] = useState(null); // "access" | "extra" | "telegram"
  const [sideOpen, setSideOpen] = useState(false);
  const [sideHost, setSideHost] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lockouts, setLockouts] = useState({});
  const [sortField, setSortField] = useState("username");
  const [sortOrder, setSortOrder] = useState("asc");
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

  const [formData, setFormData] = useState({
    search: "",
    status: "",
  });


  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);
  const { showAlert } = useAlertStore();

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
      await deleteUserById(itemId);
      showAlert(t("success"), "success");
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(t("error"), "error");
    }
  };

  // Активные блокировки входа: ключ — username в нижнем регистре
  const fetchLockouts = async () => {
    try {
      const list = await getLoginLockouts();
      setLockouts(
        Object.fromEntries(list.map((l) => [l.username.toLowerCase(), l])),
      );
    } catch (err) {
      console.error("Ошибка при получении блокировок:", err.message);
    }
  };

  const handleUnlock = async (item) => {
    try {
      await unlockUserLogin(item.id);
      showAlert(t("loginUnlocked"), "success");
      fetchLockouts();
    } catch (err) {
      console.error("Ошибка при снятии блокировки:", err);
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
      const { data, pagination, totalMenus } = await getUsers({
        page,
        pageSize: size,
        filters,
      });
      setData(data);
      setTotalMenus(totalMenus ?? 0);
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
    setSideOpen(false);
  }, [modalType]);

  useEffect(() => {
    fetchData(currentPage);
    fetchLockouts();
  }, [currentPage, pageSize]);

  // блокировки истекают сами — подтягиваем, чтобы метка не висела просроченной
  useEffect(() => {
    const id = setInterval(fetchLockouts, 60_000);
    return () => clearInterval(id);
  }, []);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 50);
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

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData);
  };

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  const sidePanel = (name) => ({
    host: sideHost,
    isOpen: sideOpen && sideName === name,
    isCurrent: sideName === name,
    toggle: () => {
      if (sideOpen && sideName === name) {
        setSideOpen(false);
        return;
      }
      setSideName(name);
      setSideOpen(true);
    },
    close: () => setSideOpen(false),
  });
  const sidePanels = {
    access: sidePanel("access"),
    extra: sidePanel("extra"),
    telegram: sidePanel("telegram"),
  };

  return (
    <div className={styles.usersPage}>
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
                    icon={Users}
                    color="#6366f1"
                    label={t("users")}
                    value={totalItems}
                  />
                  <StatWidget
                    icon={UserCheck}
                    color="#10b981"
                    label={t("activeCount")}
                    value={data.filter((x) => x.status === "active").length}
                    sub={`/ ${data.length}`}
                    progress={
                      data.length > 0
                        ? (data.filter((x) => x.status === "active").length /
                            data.length) *
                          100
                        : 0
                    }
                  />
                  <StatWidget
                    icon={UserX}
                    color="#ef4444"
                    label={t("inactiveCount")}
                    value={data.filter((x) => x.status !== "active").length}
                    sub={`/ ${data.length}`}
                  />
                </div>
              </div>
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

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

              <div
                className={styles.refreshBtn}
                onClick={() => {
                  fetchData();
                  fetchLockouts();
                }}
              >
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
                    onClick={() => handleSort("username")}
                  >
                    <span className={styles.headerContent}>
                      {t("username")}
                      <SortArrow
                        active={sortField === "username"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("employeeFullName")}>
                    <span className={styles.headerContent}>
                      {t("employee")}
                      <SortArrow
                        active={sortField === "employeeFullName"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("access_level")}>
                    <span className={styles.headerContent}>
                      {t("access")}
                      <SortArrow
                        active={sortField === "access_level"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("view_mode")}>
                    <span className={styles.headerContent}>
                      {t("viewMode")}
                      <SortArrow
                        active={sortField === "view_mode"}
                        order={sortOrder}
                      />
                    </span>
                  </th>
                  <th onClick={() => handleSort("menuCount")}>
                    <span className={styles.headerContent}>
                      {t("menusAllowed")}
                      <SortArrow
                        active={sortField === "menuCount"}
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
                      <td>{item.username}</td>
                      <td>{item.employeeFullName}</td>
                      <td>
                        {accessLevelMap[item.access_level]
                          ? t(accessLevelMap[item.access_level])
                          : "—"}
                      </td>
                      <td>
                        {viewModeMap[item.view_mode]
                          ? t(viewModeMap[item.view_mode])
                          : "—"}
                      </td>
                      <td>
                        {item.menuCount ?? 0}
                        {totalMenus > 0 && (
                          <span className={styles.menuCountTotal}>
                            {" "}
                            / {totalMenus}
                          </span>
                        )}
                      </td>
                      <td className={styles.statusTd}>
                        <div className={styles.statusCell}>
                          <Badge text={item.status} />
                          {lockouts[item.username?.toLowerCase()] && (
                            <span
                              className={styles.lockBadge}
                              title={t("loginLockedUntil", {
                                time: new Date(
                                  lockouts[item.username.toLowerCase()].lockedUntil,
                                ).toLocaleTimeString(),
                              })}
                            >
                              <Lock size={12} />
                              {lockouts[item.username.toLowerCase()]
                                .retryAfterMinutes}{" "}
                              {t("minutesShort")}
                            </span>
                          )}
                        </div>
                      </td>
                      {
                        <ActionCell
                          item={item}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          onEdit={handleEditClick}
                          onDelete={handleDeleteClick}
                          extra={
                            canEdit &&
                            lockouts[item.username?.toLowerCase()] && (
                              <ActionButton
                                onClick={() => handleUnlock(item)}
                                icon={<Unlock size={16} />}
                                label={t("unlockLogin")}
                                variant="unlock"
                              />
                            )
                          }
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
        title={modalType === "add" ? t("addUser") : t("editUser")}
        width="600px"
        leftPanel={{
          isOpen: sideOpen,
          // таблице прав нужна ширина: пять колонок с чекбоксами
          // (она же в «Настройки телеграм приложения» → «Доступные меню»)
          width: ["access", "telegram"].includes(sideName) ? "560px" : "440px",
          children: <div ref={setSideHost} />,
        }}
      >
        {modalType === "add" && (
          <AddUser
            sidePanels={sidePanels}
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              setTimeout(() => setModalType(null), 500);
              fetchData();
            }}
          />
        )}
        {modalType === "edit" && (
          <EditUser
            sidePanels={sidePanels}
            id={selectedItem}
            handleClose={() => setModalType(null)}
            onSuccess={() => {
              setTimeout(() => setModalType(null), 500);
              fetchData();
            }}
          />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default UsersPage;
