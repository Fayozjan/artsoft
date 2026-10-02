import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getPartnerById, editPartnerById, getActivePartnerCategories, getActiveStockLocations } from "../api";

import Button from "./Button";

import styles from "./StockForm.module.scss";

const EditPartner = ({ id, handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    type: "supplier",
    code: "",
    tax_number: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    note: "",
    supplier_location_id: "",
    customer_location_id: "",
    status: "true",
  });

  useEffect(() => {
    getActivePartnerCategories().then((res) => setCategories(res.data || [])).catch(() => setCategories([]));
    getActiveStockLocations().then((res) => setLocations(res.data || [])).catch(() => setLocations([]));

    const fetchData = async () => {
      try {
        const res = await getPartnerById(id);
        if (res.success) {
          setFormData({
            name: res.data.name || "",
            category_id: res.data.category_id ?? "",
            type: res.data.type || "supplier",
            code: res.data.code || "",
            tax_number: res.data.tax_number || "",
            contact_person: res.data.contact_person || "",
            phone: res.data.phone || "",
            email: res.data.email || "",
            address: res.data.address || "",
            note: res.data.note || "",
            supplier_location_id: res.data.supplier_location_id ?? "",
            customer_location_id: res.data.customer_location_id ?? "",
            status: String(res.data.status),
          });
        }
      } catch (error) {
        console.error("Ошибка при загрузке партнёра:", error.message);
        showAlert(t("error"), "error");
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "type") {
      // Тип определяет, с какой ролью партнёр участвует в движениях — сразу
      // подставляем нужную виртуальную локацию (singleton), если поле ещё пустое.
      const supplierLoc = locations.find((l) => l.type === "supplier");
      const customerLoc = locations.find((l) => l.type === "customer");
      setFormData((prev) => ({
        ...prev,
        type: value,
        supplier_location_id:
          (value === "supplier" || value === "both") && !prev.supplier_location_id && supplierLoc
            ? supplierLoc.id
            : prev.supplier_location_id,
        customer_location_id:
          (value === "client" || value === "both") && !prev.customer_location_id && customerLoc
            ? customerLoc.id
            : prev.customer_location_id,
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await editPartnerById(id, formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при обновлении партнёра:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editPartner")}</h2>
        <Button text={t("save")} type="submit" disabled={isLoading} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("name")}</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("partnerType")}</label>
          <select name="type" value={formData.type} onChange={handleChange} disabled={isLoading}>
            <option value="supplier">{t("supplier")}</option>
            <option value="client">{t("client")}</option>
            <option value="both">{t("both")}</option>
          </select>
        </div>
        <div>
          <label>{t("partnerCategory")}</label>
          <select name="category_id" value={formData.category_id ?? ""} onChange={handleChange} disabled={isLoading}>
            <option value="">{t("notSelected")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("internalCode")}</label>
          <input type="text" name="code" value={formData.code} onChange={handleChange} disabled={isLoading} />
        </div>
        <div>
          <label>{t("taxNumber")}</label>
          <input type="text" name="tax_number" value={formData.tax_number} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("contactPerson")}</label>
          <input
            type="text"
            name="contact_person"
            value={formData.contact_person}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>
        <div>
          <label>{t("phone")}</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} disabled={isLoading} />
        </div>
        <div>
          <label>{t("email")}</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("address")}</label>
          <input type="text" name="address" value={formData.address} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>

      {(formData.type === "supplier" || formData.type === "both") && (
        <div className={styles.row}>
          <div>
            <label>{t("supplierAccount")}</label>
            <select
              name="supplier_location_id"
              value={formData.supplier_location_id ?? ""}
              onChange={handleChange}
              disabled={isLoading}
            >
              <option value="">{t("notSelected")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.complete_name || l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(formData.type === "client" || formData.type === "both") && (
        <div className={styles.row}>
          <div>
            <label>{t("customerAccount")}</label>
            <select
              name="customer_location_id"
              value={formData.customer_location_id ?? ""}
              onChange={handleChange}
              disabled={isLoading}
            >
              <option value="">{t("notSelected")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.complete_name || l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className={styles.row}>
        <div>
          <label>{t("note")}</label>
          <textarea name="note" value={formData.note} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("status")}</label>
          <select name="status" value={formData.status} onChange={handleChange} disabled={isLoading}>
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditPartner;
