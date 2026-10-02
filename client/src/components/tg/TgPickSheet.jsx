import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import TgSheet from "./TgSheet";
import { IconSearch, IconClose, IconCheck } from "./tgIcons";
import ui from "./TgUi.module.scss";
import styles from "./TgPickSheet.module.scss";

// Строки дорисовываются порциями — весь штат разом на телефоне тормозит.
const PAGE_SIZE = 80;

// Шторка мультивыбора: поиск, «выбрать все» и список строк с галочкой. Выбор правится
// во временной копии и уходит в onChange только по «Применить» — закрытие шторки его отменяет.
// options: [{ id, title, subtitle? }]; selected — массив id тех же типов, что и в options.
// single — выбор одного варианта: повторный тап снимает выбор, «выбрать все» скрыто.
export default function TgPickSheet({ isOpen, onClose, title, subtitle, options, selected, onChange, single = false }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(selected);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(selected);
    setSearch("");
    setLimit(PAGE_SIZE);
  }, [isOpen]);

  const draftSet = useMemo(() => new Set(draft), [draft]);

  // Выбранные, которых нет среди вариантов (отключены / нет доступа), в списке не показываем,
  // но из выбора не теряем: «Применить» вернёт их обратно.
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => `${option.title} ${option.subtitle || ""}`.toLowerCase().includes(query));
  }, [options, search]);

  const visible = filtered.slice(0, limit);
  const filteredIds = filtered.map((option) => option.id);
  const allChecked = filteredIds.length > 0 && filteredIds.every((id) => draftSet.has(id));

  const toggle = (id) =>
    setDraft((prev) => {
      if (single) return prev.includes(id) ? [] : [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });

  // Действует на то, что сейчас отфильтровано: нашли поиском — выбрали все найденные.
  const toggleAll = () => {
    if (allChecked) {
      const drop = new Set(filteredIds);
      setDraft((prev) => prev.filter((id) => !drop.has(id)));
    } else {
      setDraft((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  };

  const apply = () => {
    onChange(draft);
    onClose();
  };

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <div className={ui.btnRow}>
          <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={() => setDraft([])} disabled={draft.length === 0}>
            {t("clearAll")}
          </button>
          <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={apply}>
            {t("apply")}
            {draft.length > 0 && <span className={styles.applyCount}>{draft.length}</span>}
          </button>
        </div>
      }
    >
      <div className={styles.searchBox}>
        <span className={styles.searchIcon}>
          <IconSearch />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("search")}
          enterKeyHint="search"
          autoComplete="off"
        />
        {search && (
          <button type="button" className={styles.clearBtn} onClick={() => setSearch("")} aria-label="clear">
            <IconClose />
          </button>
        )}
      </div>

      {!single && filtered.length > 0 && (
        <button type="button" className={styles.row} onClick={toggleAll}>
          <span className={`${styles.check} ${allChecked ? styles.checkOn : ""}`}>{allChecked && <IconCheck />}</span>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>{t("selectAll")}</span>
          </span>
        </button>
      )}

      <div className={styles.list}>
        {visible.length === 0 ? (
          <p className={styles.empty}>{t("noResultsSearch")}</p>
        ) : (
          visible.map((option) => {
            const checked = draftSet.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                className={`${styles.row} ${checked ? styles.rowOn : ""}`}
                onClick={() => toggle(option.id)}
              >
                <span className={`${styles.check} ${checked ? styles.checkOn : ""}`}>{checked && <IconCheck />}</span>
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{option.title}</span>
                  {option.subtitle && <span className={styles.rowSub}>{option.subtitle}</span>}
                </span>
              </button>
            );
          })
        )}

        {filtered.length > visible.length && (
          <button type="button" className={styles.more} onClick={() => setLimit((prev) => prev + PAGE_SIZE)}>
            {t("shownOfTotal", { shown: visible.length, total: filtered.length })}
          </button>
        )}
      </div>
    </TgSheet>
  );
}
