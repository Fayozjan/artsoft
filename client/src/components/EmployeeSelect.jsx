import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useHideBranch } from "../hooks/useHideBranch";
import TgSheet from "./tg/TgSheet";
import { Icons } from "../icons/icons";
import styles from "./EmployeeSelect.module.scss";

const MAX_VISIBLE = 50;

// Телефон (Telegram): список открывается нижней шторкой, а не выпадашкой. Экраны
// Telegram лежат в обёртке с transform/overflow (ScreenStackRenderer) — position: fixed
// внутри неё привязан к обёртке, и выпадашка съезжает/обрезается. Шторка (TgSheet)
// рендерится порталом в body, поверх стека, и от предков не зависит.
const isPhone = () => Boolean(window.matchMedia?.("(max-width: 640px)").matches);

// Выпадашка выбора сотрудника с поиском по ФИО.
// options: [{ id, employeeFullName, branchName, departmentName }] — EmployeeService.getActive()
// large — крупное поле (форма приёма работы): выше, шрифт больше, как у плиток распределения.
// compact — на телефоне чуть мельче large (строка «сотрудник + количество» должна помещаться).
// bar — поле верхней строки приёма работы: рамка, высота и шрифт как у ScanModeSelect.
// clearable — у выбранного сотрудника есть крестик; сброс = onChange("").
const EmployeeSelect = ({
  value,
  onChange,
  employees = [],
  placeholder,
  disabled,
  large = false,
  compact = false,
  bar = false,
  clearable = false,
}) => {
  const { t } = useTranslation();
  const hideBranch = useHideBranch();
  const [open, setOpen] = useState(false);
  // Режим фиксируется при открытии: шторка на телефоне, выпадашка на ПК.
  const [sheetMode, setSheetMode] = useState(false);
  const [query, setQuery] = useState("");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef();
  const triggerRef = useRef();
  const ref = useRef();

  // Выпадашка закрывается кликом снаружи; у шторки своё затемнение и крестик.
  useEffect(() => {
    if (!open || sheetMode) return;
    const fn = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open, sheetMode]);

  useEffect(() => {
    if (open && !sheetMode) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, sheetMode]);

  const toggle = () => {
    if (disabled) return;
    setSheetMode(isPhone());
    setOpen((v) => !v);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const selected = employees.find((e) => String(e.id) === String(value));

  // employeeFullName начинается с фамилии — сортируем по нему
  const sorted = useMemo(
    () =>
      [...employees].sort((a, b) =>
        (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru"),
      ),
    [employees],
  );

  const filtered = query.trim()
    ? sorted.filter((e) =>
        (e.employeeFullName || "").toLowerCase().includes(query.toLowerCase())
      )
    : sorted;

  // не рендерим весь штат — список тормозит UI, остальное отсекает поиск
  const visible = filtered.slice(0, MAX_VISIBLE);

  const searchInput = (
    <input
      ref={inputRef}
      className={styles.empSelectSearch}
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder={t("search")}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const list = (
    <div className={styles.empSelectList}>
      {visible.length > 0 ? (
        visible.map((emp) => (
          <div
            key={emp.id}
            className={`${styles.empSelectItem} ${
              String(emp.id) === String(value) ? styles.empSelectItemActive : ""
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(emp.id);
              close();
            }}
          >
            <span className={styles.empSelectItemName}>{emp.employeeFullName}</span>
            {((!hideBranch && emp.branchName) || emp.departmentName) && (
              <span className={styles.empSelectItemSub}>
                {[hideBranch ? null : emp.branchName, emp.departmentName]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            )}
          </div>
        ))
      ) : (
        <div className={styles.empSelectEmpty}>{t("noResultsSearch")}</div>
      )}
    </div>
  );

  const hint = filtered.length > visible.length && (
    <div className={styles.empSelectHint}>
      {t("shownOfTotal", { shown: visible.length, total: filtered.length })}
    </div>
  );

  return (
    <div
      ref={ref}
      className={`${styles.empSelect} ${large ? styles.empSelectLarge : ""} ${compact ? styles.empSelectCompact : ""} ${bar ? styles.empSelectBar : ""}`}
    >
      <div
        ref={triggerRef}
        className={`${styles.empSelectTrigger} ${open ? styles.empSelectOpen : ""}`}
        onClick={toggle}
      >
        {selected ? (
          <span className={styles.empSelectValue}>{selected.employeeFullName}</span>
        ) : (
          <span className={styles.empSelectPlaceholder}>{placeholder}</span>
        )}
        {clearable && selected && !disabled && (
          <button
            type="button"
            className={styles.empSelectClear}
            title={t("workAcceptanceRemoveWorker")}
            aria-label={t("workAcceptanceRemoveWorker")}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            {Icons.clear}
          </button>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && !sheetMode && (
        <div
          className={styles.empSelectDropdown}
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 1400,
          }}
        >
          {searchInput}
          {list}
          {hint}
        </div>
      )}

      {/* Поиск закреплён сверху шторки, прокручивается только список. Без автофокуса:
          клавиатура сразу закрыла бы половину списка — поиск открывается тапом. */}
      {sheetMode && (
        // Клики из портала по дереву React всплывают к предкам (форма, модалка) — гасим здесь.
        <div onClick={(e) => e.stopPropagation()}>
          <TgSheet isOpen={open} onClose={close} title={placeholder || t("employee")}>
            <div className={styles.empSheet}>
              <div className={styles.empSheetSearch}>{searchInput}</div>
              {list}
              {hint}
            </div>
          </TgSheet>
        </div>
      )}
    </div>
  );
};

export default EmployeeSelect;
