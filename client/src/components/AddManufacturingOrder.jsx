import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";
import styles from "./AddManufacturingOrder.module.scss";
import { addManufacturingOrder } from "../api";

const AddManufacturingOrder = ({ cancelButton }) => {
  const [formData, setFormData] = useState({
    // Производственный заказ
    receiveDate: "",
    deadline: "",
    client: "",
    branch: "",
    orderNumber: "",
    orderId: "",
    description: "",
    manager: "",
    status: "В обработке",

    // Продукт
    productName: "",
    fabric: "",
    design: "",
    designVariant: "",
    color: "",
    colorVariant: "",
    unit: "",
    quantity: 0,
    gram: "",
    grammage: "",
    price: 0,
    total: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      let updated = { ...prev, [name]: value };

      // Автоматический расчет суммы
      if (name === "quantity" || name === "price") {
        const qty = name === "quantity" ? +value : +updated.quantity;
        const pr = name === "price" ? +value : +updated.price;
        updated.total = qty * pr;
      }

      return updated;
    });
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setIsLoading(true);

      try {
        const res = await addManufacturingOrder({ ...formData });

        if (res.success) {
          showAlert("Заказ успешно добавлен", "success");
          setTimeout(() => cancelButton(), 1500);
        } else {
          console.error("Ошибка в ответе сервера:", res.data);
          showAlert("Ошибка при добавлении заказа", "error");
        }
      } catch (error) {
        console.error("Ошибка при отправке данных:", error);
        showAlert("Ошибка при добавлении заказа", "error");
      } finally {
        setIsLoading(false);
      }
    },
    [formData]
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.add_order}>
        <h1>Добавить производственный заказ</h1>
        <svg
          className={styles.cancelBtn}
          onClick={() => cancelButton()}
          xmlns="http://www.w3.org/2000/svg"
          width="200"
          height="200"
          viewBox="0 0 42 42"
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="m21.002 26.588l10.357 10.604c1.039 1.072 1.715 1.083 2.773 0l2.078-2.128c1.018-1.042 1.087-1.726 0-2.839L25.245 21L36.211 9.775c1.027-1.055 1.047-1.767 0-2.84l-2.078-2.127c-1.078-1.104-1.744-1.053-2.773 0L21.002 15.412L10.645 4.809c-1.029-1.053-1.695-1.104-2.773 0L5.794 6.936c-1.048 1.073-1.029 1.785 0 2.84L16.759 21L5.794 32.225c-1.087 1.113-1.029 1.797 0 2.839l2.077 2.128c1.049 1.083 1.725 1.072 2.773 0l10.358-10.604z"
          />
        </svg>

        <div className={styles.container}>
          <form className={styles.orderForm} onSubmit={handleSubmit}>
            <h2>Производственный заказ</h2>
            <div className={styles.formGroup}>
              <label>Дата получения</label>
              <input
                type="date"
                name="receiveDate"
                value={formData.receiveDate}
                onChange={handleChange}
                required
              />

              <label>Срок</label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                required
              />

              <label>Клиент</label>
              <input
                type="text"
                name="client"
                value={formData.client}
                onChange={handleChange}
                required
              />

              <label>Филиал</label>
              <input
                type="text"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                required
              />

              <label>Номер заказа</label>
              <input
                type="text"
                name="orderNumber"
                value={formData.orderNumber}
                onChange={handleChange}
              />

              <label>ID заказа</label>
              <input
                type="text"
                name="orderId"
                value={formData.orderId}
                onChange={handleChange}
              />

              <label>Описание</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
              ></textarea>

              <label>Менеджер</label>
              <input
                type="text"
                name="manager"
                value={formData.manager}
                onChange={handleChange}
              />

              <label>Статус</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="В обработке">В обработке</option>
                <option value="Выполнен">Выполнен</option>
                <option value="Отменен">Отменен</option>
              </select>
            </div>

            <h2>Продукт</h2>
            <div className={styles.formGroup}>
              <label>Название продукта</label>
              <input
                type="text"
                name="productName"
                value={formData.productName}
                onChange={handleChange}
                required
              />

              <label>Ткань</label>
              <input
                type="text"
                name="fabric"
                value={formData.fabric}
                onChange={handleChange}
              />

              <label>Дизайн</label>
              <input
                type="text"
                name="design"
                value={formData.design}
                onChange={handleChange}
              />

              <label>Вариант дизайна</label>
              <input
                type="text"
                name="designVariant"
                value={formData.designVariant}
                onChange={handleChange}
              />

              <label>Цвет</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
              />

              <label>Вариант цвета</label>
              <input
                type="text"
                name="colorVariant"
                value={formData.colorVariant}
                onChange={handleChange}
              />

              <label>Единица измерения</label>
              <input
                type="text"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
              />

              <label>Количество</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
              />

              <label>Цена</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
              />

              <label>Сумма</label>
              <input
                type="number"
                name="total"
                value={formData.total}
                readOnly
              />

              <label>Грамм</label>
              <input
                type="number"
                name="gram"
                value={formData.gram}
                onChange={handleChange}
              />

              <label>Граммаж</label>
              <input
                type="text"
                name="grammage"
                value={formData.grammage}
                onChange={handleChange}
              />
            </div>

            <div className={styles.buttons}>
              <Button text="Сохранить" type="submit" disabled={isLoading} />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddManufacturingOrder;
