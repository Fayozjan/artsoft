import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useProductionAccess } from "../hooks/useProductionAccess";
import {
  getOperationById,
  addOperation,
  editOperationById,
  getActiveOperationTypes,
  EmployeeService,
} from "../api";

import EmployeeSelect from "./EmployeeSelect";
import Button from "./Button";
import Loading from "./Loading";
import { Icons } from "../icons/icons";
import styles from "./AddOperation.module.scss";

const emptyItem = () => ({
  employee_id: "",
  operation_type_id: "",
  quantity: "",
  rate: "",
  comment: "",
});

const AddOperation = ({ id, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const { filterOperationTypes } = useProductionAccess();
  const [allOperationTypes, setAllOperationTypes] = useState([]);
  // Только операции, доступные логину (задаёт администратор)
  const operationTypes = useMemo(
    () => filterOperationTypes(allOperationTypes),
    [allOperationTypes, filterOperationTypes],
  );
  const [header, setHeader] = useState({
    document_number: "",
    operation_date: new Date().toISOString().slice(0, 10),
    order_number: "",
    comment: "",
  });
  const [items, setItems] = useState([emptyItem()]);

  const loadRefData = useCallback(async () => {
    try {
      const [employeesRes, typesRes] = await Promise.all([
        EmployeeService.getActive(),
        getActiveOperationTypes(),
      ]);
      setEmployees(employeesRes.data || []);
      setAllOperationTypes(typesRes.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadData = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await getOperationById(id);
      const data = res.data;
      setHeader({
        document_number: data.document_number || "",
        operation_date: (data.operation_date || "").slice(0, 10),
        order_number: data.order_number || "",
        comment: data.comment || "",
      });
      setItems(
        (data.items || []).length > 0
          ? data.items.map((it) => ({
              employee_id: it.employee_id ?? "",
              operation_type_id: it.operation_type_id ?? "",
              quantity: it.quantity ?? "",
              rate: it.rate ?? "",
              comment: it.comment || "",
            }))
          : [emptyItem()],
      );
    } catch (err) {
      console.error(err);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [id, isEdit]);

  useEffect(() => {
    loadRefData();
    loadData();
  }, [loadRefData, loadData]);

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeader((prev) => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, e) => {
    const { name, value } = e.target;
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [name]: value } : item)),
    );
  };

  const handleItemEmployeeChange = (index, employeeId) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, employee_id: employeeId } : item)),
    );
  };

  // Расценка подставляется из цены типа операции, но остаётся редактируемой вручную.
  const handleItemTypeChange = (index, e) => {
    const typeId = e.target.value;
    const type = operationTypes.find((t) => String(t.id) === String(typeId));
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, operation_type_id: typeId, rate: type?.price ?? item.rate }
          : item,
      ),
    );
  };

  const addRow = () => setItems((prev) => [...prev, emptyItem()]);

  const removeRow = (index) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const totalAmount = useMemo(
    () =>
      items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0), 0),
    [items],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const validItems = items.filter((item) => Number(item.quantity) > 0);
    if (validItems.length === 0) {
      showAlert(t("error"), "error");
      return;
    }

    setSaving(true);
    try {
      const { document_number, ...headerPayload } = header;
      const payload = { ...headerPayload, items };
      const res = isEdit
        ? await editOperationById(id, payload)
        : await addOperation(payload);

      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      onSuccess?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {saving && <Loading />}

      <div className={styles.header}>
        <h2>
          {isEdit ? t("editOperation") : t("addOperation")}
          {isEdit && header.document_number && (
            <span className={styles.headerDocNumber}>№ {header.document_number}</span>
          )}
        </h2>
        <span onClick={handleClose} style={{ display: "flex", cursor: "pointer" }}>
          {Icons.clear}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.row}>
          <div>
            <label>{t("date")} <span className={styles.req}>*</span></label>
            <input
              type="date"
              name="operation_date"
              value={header.operation_date}
              onChange={handleHeaderChange}
              onFocus={(e) => e.target.showPicker?.()}
              required
            />
          </div>
          <div>
            <label>{t("customerOrderNumber")}</label>
            <input
              type="text"
              name="order_number"
              value={header.order_number}
              onChange={handleHeaderChange}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.full}>
            <label>{t("comment")}</label>
            <textarea
              name="comment"
              value={header.comment}
              onChange={handleHeaderChange}
              rows={2}
            />
          </div>
        </div>

        <div className={styles.itemsHeader}>
          <h3>{t("lineItems")}</h3>
          <button type="button" className={styles.addRowBtn} onClick={addRow}>
            {Icons.plus} {t("addItemRow")}
          </button>
        </div>

        <div className={styles.itemsTableWrap}>
          <table className={styles.itemsTable}>
            <thead>
              <tr>
                <th>{t("employee")}</th>
                <th>{t("operationType")}</th>
                <th>{t("quantity")}</th>
                <th>{t("rate")}</th>
                <th>{t("amount")}</th>
                <th>{t("comment")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td style={{ minWidth: 220 }}>
                    <EmployeeSelect
                      value={item.employee_id}
                      onChange={(employeeId) => handleItemEmployeeChange(index, employeeId)}
                      employees={employees}
                      placeholder={t("employee")}
                    />
                  </td>
                  <td>
                    <select
                      name="operation_type_id"
                      value={item.operation_type_id}
                      onChange={(e) => handleItemTypeChange(index, e)}
                      required
                    >
                      <option value="">—</option>
                      {operationTypes.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      name="quantity"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, e)}
                      required
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="rate"
                      value={item.rate}
                      onChange={(e) => handleItemChange(index, e)}
                    />
                  </td>
                  <td className={styles.amountCell}>
                    {((Number(item.quantity) || 0) * (Number(item.rate) || 0)).toFixed(2)}
                  </td>
                  <td>
                    <input
                      type="text"
                      name="comment"
                      value={item.comment}
                      onChange={(e) => handleItemChange(index, e)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.removeRowBtn}
                      onClick={() => removeRow(index)}
                      title={t("removeItemRow")}
                    >
                      {Icons.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.totalAmount}>
          {t("totalAmount")}: {totalAmount.toFixed(2)}
        </span>
        <Button text={t("save")} type="submit" loading={saving} />
      </div>
    </form>
  );
};

export default AddOperation;
