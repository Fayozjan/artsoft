import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import Modal from "./Modal";
import Loading from "./Loading";

import { useAlertStore } from "../stores/alertStore";

import {
  getActiveBranches,
  getActivePositions,
  getEmploymentOrdersByEmployeeId,
  editEmploymentOrderById,
  deleteEmploymentOrderById,
} from "../api";

import {
  downloadHiredDoc,
  downloadTerminationDoc,
  downloadTransferDoc,
} from "../utils/downloadDoc";

import styles from "./EmploymentOrdersTimeline.module.scss";
import { useTranslation } from "react-i18next";

const EVENT_LABELS = {
  hire: "Найм",
  transfer: "Перевод",
  leave: "Отпуск",
  terminate: "Увольнение",
};

const EmploymentOrdersTimeline = ({
  employeeId,
  employeeData,
  handleClose,
  updateEmployeeDataFunction,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [employmentOrders, setEmploymentOrders] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [branches, setBranches] = useState([]);
  const [positions, setPositions] = useState([]);
  const { showAlert } = useAlertStore();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const sortedOrders = useMemo(() => {
    return [...employmentOrders].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);

      if (dateA.getTime() !== dateB.getTime()) {
        return dateB - dateA;
      }

      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [employmentOrders]);

  const fetchReferences = useCallback(async () => {
    try {
      const [branchesRes, positionsRes] = await Promise.all([
        getActiveBranches(),
        getActivePositions(),
      ]);
      setBranches(branchesRes.data || []);
      setPositions(positionsRes.data || []);
    } catch (err) {
      console.error("Ошибка при загрузке справочников:", err);
    }
  }, []);

  const fetchEmploymentOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getEmploymentOrdersByEmployeeId(employeeId);
      if (response?.success) {
        setEmploymentOrders(response.data || []);
      }
    } catch (err) {
      console.error("Ошибка при получении списка приказов:", err);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchEmploymentOrders();
    fetchReferences();
  }, [fetchEmploymentOrders, fetchReferences]);

  const handleDeleteClick = (id) => {
    setDeletingId(id);
  };

  const confirmDelete = async (id) => {
    setLoading(true);
    try {
      const res = await deleteEmploymentOrderById(id);
      if (res.success) {
        setEmploymentOrders((prev) => prev.filter((item) => item.id !== id));
        showAlert(t("success"), "success");
      }
    } catch (error) {
      showAlert(t("error"), "error");
    } finally {
      setDeletingId(null);
      setLoading(false);
      updateEmployeeDataFunction();
    }
  };

  const cancelDelete = () => {
    setDeletingId(null);
  };

  const handleDownload = (item) => {
    const lastHire = employmentOrders.find(
      (order) => order.event_type === "hired",
    );

    switch (item.event_type) {
      case "hired":
        downloadHiredDoc(item);
        break;
      case "termination":
        downloadTerminationDoc(item, lastHire);
        break;
      case "transfer":
      case "promotion":
        downloadTransferDoc(item, lastHire, employeeData);
        break;
      default:
        console.warn("Неизвестный тип события для скачивания");
    }
  };

  // Вход в режим редактирования
  const startEditing = (item) => {
    setEditingId(item.id);
    setEditFormData({
      order_number: item.order_number || "",
      date: item.date ? item.date.split("T")[0] : "",
      branch_id: item.branch_id || "",
      department_id: item.department_id || "",
      position_id: item.position_id || "",
      note: item.note || "",
      type: item.type,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({
      ...prev,
      [name]: value,
      // Сбрасываем отдел, если меняется филиал
      ...(name === "branch_id" ? { department_id: "" } : {}),
    }));
  };

  const handleInlineSave = async (id) => {
    try {
      const res = await editEmploymentOrderById(id, editFormData);

      if (res?.success) {
        showAlert(t("success"), "success");

        // 🔹 обновляем запись локально
        setEmploymentOrders((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, ...editFormData } : item,
          ),
        );

        // 🔹 даём глазу время
        setTimeout(() => {
          setEditingId(null);
          fetchEmploymentOrders();
          updateEmployeeDataFunction();
        }, 200);
      }
    } catch (error) {
      showAlert(t("error"), "error");
    }
  };

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.header}>
        <svg
          onClick={() => handleClose()}
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 304 384"
        >
          <path
            fill="#000000"
            d="M299 73L179 192l120 119l-30 30l-120-119L30 341L0 311l119-119L0 73l30-30l119 119L269 43z"
          />
        </svg>
      </div>

      <div className={styles.timelineWrapper}>
        {sortedOrders.length > 0
          ? sortedOrders.map((item, index) => (
              <div key={item.id} className={styles.timeline_item}>
                <div className={styles.timeline_date}>
                  {item.date
                    ? format(new Date(item.date), "dd MMM yyyy", { locale: ru })
                    : "---"}
                </div>

                <div className={styles.timeline_path}>
                  <div className={`${styles.dot} ${styles[item.type]}`} />
                  {index !== employmentOrders.length - 1 && (
                    <div className={styles.line} />
                  )}
                </div>

                <div className={styles.timelineContent}>
                  <div
                    className={`${styles.card} ${deletingId === item.id ? styles.isDeleting : ""}`}
                  >
                    {deletingId === item.id ? (
                      <div className={styles.deleteConfirmOverlay}>
                        <p>Удалить запись?</p>
                        <div className={styles.deleteActions}>
                          <button
                            onClick={() => confirmDelete(item.id)}
                            className={styles.confirmBtn}
                          >
                            Да
                          </button>
                          <button
                            onClick={cancelDelete}
                            className={styles.cancelBtn}
                          >
                            Нет
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className={styles.card_header}>
                      <h4 className={`${styles.title} ${styles[item.type]}`}>
                        {EVENT_LABELS[item.type] || item.type}
                      </h4>
                      <div className={styles.operations}>
                        <button
                          onClick={() => startEditing(item)}
                          title="Редактировать"
                        >
                          <svg width="16" height="16" viewBox="0 0 18 18">
                            <path
                              d="M0,14.2 L0,18 L3.8,18 L14.8,6.9 L11,3.1 L0,14.2 Z M17.7,4 C18.1,3.6 18.1,3 17.7,2.6 L15.4,0.3 C15,-0.1 14.4,-0.1 14,0.3 L12.2,2.1 L16,5.9 L17.7,4 Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDownload(item)}
                          title="Скачать"
                        >
                          <svg width="18" height="14" viewBox="0 0 24 16">
                            <path
                              d="M19.4,6 C18.7,2.6 15.7,0 12,0 C9.1,0 6.6,1.6 5.4,4 C2.3,4.4 0,6.9 0,10 C0,13.3 2.7,16 6,16 L19,16 C21.8,16 24,13.8 24,11 C24,8.4 21.9,6.2 19.4,6 Z M17,9 L12,14 L7,9 L10,9 L10,5 L14,5 L14,9 L17,9 L17,9 Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item.id)}
                          className={styles.deleteBtn}
                          title="Удалить"
                        >
                          <svg width="14" height="16" viewBox="0 0 14 18">
                            <path
                              d="M1,16 C1,17.1 1.9,18 3,18 L11,18 C12.1,18 13,17.1 13,16 L13,4 L1,4 L1,16 L1,16 Z M14,1 L10.5,1 L9.5,0 L4.5,0 L3.5,1 L0,1 L0,3 L14,3 L14,1 L14,1 Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className={styles.card_body}>
                      {editingId === item.id ? (
                        <div className={styles.inlineEditForm}>
                          <p>
                            <span>Дата:</span>
                            <input
                              type="date"
                              name="date"
                              className={styles.inlineInput}
                              value={editFormData.date}
                              onChange={handleInputChange}
                              onFocus={(e) => e.target.showPicker?.()}
                              required
                            />
                          </p>

                          <p>
                            <span>Приказ:</span>
                            <input
                              type="text"
                              name="order_number"
                              className={styles.inlineInput}
                              placeholder="№"
                              value={editFormData.order_number}
                              onChange={handleInputChange}
                            />
                          </p>

                          {editFormData.type !== "terminate" && (
                            <>
                              <p>
                                <span>Филиал:</span>
                                <select
                                  name="branch_id"
                                  className={styles.inlineSelect}
                                  value={editFormData.branch_id}
                                  onChange={handleInputChange}
                                  required
                                >
                                  <option value="">{t("select")}</option>
                                  {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                              </p>

                              <p>
                                <span>Отдел:</span>
                                <select
                                  name="department_id"
                                  className={styles.inlineSelect}
                                  value={editFormData.department_id}
                                  onChange={handleInputChange}
                                  disabled={!editFormData.branch_id}
                                  required
                                >
                                  <option value="">{t("select")}</option>
                                  {editFormData.branch_id &&
                                    branches
                                      .find(
                                        (b) =>
                                          b.id ===
                                          Number(editFormData.branch_id),
                                      )
                                      ?.departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                          {d.name}
                                        </option>
                                      ))}
                                </select>
                              </p>

                              <p>
                                <span>Должность:</span>
                                <select
                                  name="position_id"
                                  className={styles.inlineSelect}
                                  value={editFormData.position_id}
                                  onChange={handleInputChange}
                                  required
                                >
                                  <option value="">{t("select")}</option>
                                  {positions.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </p>
                            </>
                          )}

                          <p className={styles.note}>
                            <span>Заметка:</span>
                            <input
                              name="note"
                              className={styles.inlineInput}
                              value={editFormData.note}
                              onChange={handleInputChange}
                            />
                          </p>

                          <div className={styles.editActions}>
                            <button
                              onClick={() => handleInlineSave(item.id)}
                              className={styles.saveBtn}
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className={styles.cancelBtn}
                            >
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {item.order_number && (
                            <p>
                              <span>Приказ:</span> №{item.order_number}
                            </p>
                          )}
                          {item.branches?.name && (
                            <p>
                              <span>Филиал:</span> {item.branches.name}
                            </p>
                          )}
                          {item.departments?.name && (
                            <p>
                              <span>Отдел:</span> {item.departments.name}
                            </p>
                          )}
                          {item.positions?.name && (
                            <p>
                              <span>Должность:</span> {item.positions.name}
                            </p>
                          )}
                          {item.note && (
                            <p className={styles.note}>
                              <i>{item.note}</i>
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          : !loading && <div className={styles.empty}>История пуста</div>}
      </div>

      {showDeleteModal && (
        <Modal
          onClose={() => setShowDeleteModal(false)}
          onAccept={confirmDelete}
          title="Удаление записи"
          message="Вы уверены, что хотите удалить эту запись из истории?"
        />
      )}

      {alert.show && (
        <Alert message={alert.message} onClose={closeAlert} type={alert.type} />
      )}

      {loading && <Loading />}
    </div>
  );
};

export default EmploymentOrdersTimeline;
