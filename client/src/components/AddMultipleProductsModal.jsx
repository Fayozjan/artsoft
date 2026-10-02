import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { Icons } from "../icons/icons";
import styles from "./AddMultipleProductsModal.module.scss";

// Кол-во/упаковки — те же текстовые инпуты, что и в строке документа (не
// number: там пробелы-разрядники не отобразить), сырое значение без пробелов в стейте.
const parseNumericInput = (raw) => {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
};
const formatNumberInput = (raw) => {
  if (raw === "" || raw === null || raw === undefined) return "";
  const [intPart, decPart] = String(raw).split(".");
  const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return decPart !== undefined ? `${groupedInt}.${decPart}` : groupedInt;
};

// Сколько единиц в одной упаковке — чисто справочное число (qty/qty_packages),
// на складе эти два отдельно введённых остатка не обязаны делиться ровно,
// поэтому округляем для показа, а не храним как отдельное поле.
const perPackageText = (stockQty, stockPackages) => {
  if (stockQty == null || !stockPackages) return "—";
  const ratio = Number(stockQty) / Number(stockPackages);
  if (!Number.isFinite(ratio)) return "—";
  return formatNumberInput(Math.round(ratio * 100) / 100);
};

// Таблица-чекбокс-список поверх того же набора options, что и обычный
// SearchableSelect строки (товар/партия + характеристики + остаток/упаковки) —
// по "Добавить" разом добавляет в документ строку на каждую отмеченную позицию
// с уже введённым количеством/кол-вом упаковок (см. handleAddMultiple в
// AddStockPicking, который строит сами строки из выбранных id + qty + packages).
const AddMultipleProductsModal = ({
  isOpen,
  onClose,
  onConfirm,
  options = [],
  initialSelectedIds = [],
  initialQtyById = {},
  initialPackagesById = {},
}) => {
  const { t } = useTranslation();
  const [portalContainer, setPortalContainer] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [qtyById, setQtyById] = useState({});
  const [packagesById, setPackagesById] = useState({});

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => document.body.removeChild(container);
  }, []);

  // Сброс поиска при каждом новом открытии; выбор/количества стартуют с того,
  // что уже стоит в строке (клик по заполненному товару открывает модалку с
  // ним отмеченным и готовым количеством — не пустым списком).
  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIds(initialSelectedIds);
      setQtyById(initialQtyById);
      setPackagesById(initialPackagesById);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Каждое слово запроса должно найтись хоть где-то (имя/описание партии/
  // характеристики) — "вафельный л" находит товар и по названию, и по
  // характеристике сразу, а не только по точному вхождению всей строки целиком.
  const filteredOptions = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => {
      const haystack = [o.name, o.inlineNote, o.categoryName].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [options, search]);

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.some((v) => String(v) === String(id))
        ? prev.filter((v) => String(v) !== String(id))
        : [...prev, id],
    );
  };

  // "Выбрать все" (чекбокс в шапке) действует на то, что сейчас видно (с
  // учётом поиска) — уже отмеченные вне текущей выдачи не трогает; повторный
  // клик, когда вся видимая выдача отмечена, снимает отметку с неё же.
  const allFilteredSelected =
    filteredOptions.length > 0 &&
    filteredOptions.every((o) => selectedIds.some((v) => String(v) === String(o.id)));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => prev.filter((v) => !filteredOptions.some((o) => String(o.id) === String(v))));
    } else {
      setSelectedIds((prev) => {
        const existing = new Set(prev.map(String));
        const toAdd = filteredOptions.filter((o) => !existing.has(String(o.id))).map((o) => o.id);
        return [...prev, ...toAdd];
      });
    }
  };

  // Ввод количества/упаковок прямо тут отмечает позицию сам по себе — не
  // нужно сначала ставить галочку, потом искать поле количества отдельно.
  const makeQtyHandler = (setter) => (id, raw, max) => {
    const parsed = parseNumericInput(raw);
    const next = max != null && Number(parsed) > max ? String(max) : parsed;
    setter((prev) => ({ ...prev, [id]: next }));
    if (next && !selectedIds.some((v) => String(v) === String(id))) {
      setSelectedIds((prev) => [...prev, id]);
    }
  };
  const handleQtyChange = makeQtyHandler(setQtyById);
  const handlePackagesChange = makeQtyHandler(setPackagesById);

  const handleConfirm = () => {
    if (!selectedIds.length) return;
    onConfirm(selectedIds.map((id) => ({ id, qty: qtyById[id] || "", packages: packagesById[id] || "" })));
  };

  if (!portalContainer || !isOpen) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>{t("pickingAddMultipleTitle")}</h3>

        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>{Icons.search}</span>
          <input
            type="text"
            autoComplete="off"
            autoFocus
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search") + "..."}
          />
        </div>

        {filteredOptions.length > 0 && (
          <div className={styles.listHeader}>
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              title={t("selectAll")}
            />
            <span>{t("product")}</span>
            <span className={styles.colRight}>{t("pickingColBalance")}</span>
            <span className={styles.colRight}>{t("pickingColPerPackage")}</span>
            <span>{t("quantity")}</span>
            <span>{t("pickingQtyPackages")}</span>
          </div>
        )}

        <ul className={styles.list}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const checked = selectedIds.some((v) => String(v) === String(option.id));
              return (
                <li
                  key={option.id}
                  className={checked ? styles.selected : ""}
                  onClick={() => toggle(option.id)}
                >
                  <input type="checkbox" checked={checked} readOnly />
                  <span className={styles.optionMain}>
                    <span className={styles.optionName}>
                      {option.name}
                      {option.inlineNote && (
                        <span className={styles.optionNote}> ({option.inlineNote})</span>
                      )}
                    </span>
                    {option.categoryName && (
                      <span className={styles.optionCategory}>{option.categoryName}</span>
                    )}
                  </span>
                  <span className={styles.colValue}>
                    {option.stockQty != null ? formatNumberInput(option.stockQty) : "—"}
                  </span>
                  <span className={styles.colValue}>
                    {perPackageText(option.stockQty, option.stockPackages)}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.qtyInput}
                    placeholder={t("quantity")}
                    value={formatNumberInput(qtyById[option.id] ?? "")}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleQtyChange(option.id, e.target.value, option.maxQty)}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.qtyInput}
                    placeholder={t("pickingQtyPackages")}
                    value={formatNumberInput(packagesById[option.id] ?? "")}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handlePackagesChange(option.id, e.target.value, option.maxPackages)}
                  />
                </li>
              );
            })
          ) : (
            <li className={styles.empty}>{t("noMatches")}</li>
          )}
        </ul>

        <div className={styles.footer}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!selectedIds.length}
          >
            {Icons.plus}
            <span>{t("pickingAddSelected", { count: selectedIds.length })}</span>
          </button>
        </div>
      </motion.div>
    </div>,
    portalContainer,
  );
};

export default AddMultipleProductsModal;
