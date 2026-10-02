import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Factory, Check, Printer, UserCheck, Info } from "lucide-react";

import { getActiveOperationTypes } from "../api";

import styles from "./UserAccessCards.module.scss";

const operationTags = (type) =>
  [
    type.is_first && "operationTagFirst",
    type.is_final && "operationTagFinal",
    type.is_rework && "operationTagRework",
  ].filter(Boolean);

// Меню «Производство» для логина: какие типы операций доступны, можно ли править стикер
// и показывать ли в истории приёма только свои операции.
// value = { operationIds, canEditSticker, ownOnly }; пустой operationIds — доступны все операции.
// menuEnabled: false — у логина нет доступа к меню «Производство» (undefined — не знаем).
const UserProductionSettings = ({ value, onChange, menuEnabled }) => {
  const { t } = useTranslation();
  const { operationIds, canEditSticker, ownOnly } = value;

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  // «Выбранные» с пустым выбором — тоже режим выбора (пока админ отмечает чипы),
  // поэтому режим не выводится из operationIds целиком.
  const [forceSelect, setForceSelect] = useState(false);
  const selecting = forceSelect || operationIds.length > 0;

  useEffect(() => {
    getActiveOperationTypes()
      .then((res) => setTypes(res.data || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const selectedCount = types.filter((type) => operationIds.includes(type.id)).length;

  const setOperationIds = (next) => onChange({ ...value, operationIds: next });

  const chooseAll = () => {
    setForceSelect(false);
    setOperationIds([]);
  };

  const toggleType = (id) =>
    setOperationIds(
      operationIds.includes(id)
        ? operationIds.filter((existing) => existing !== id)
        : [...operationIds, id],
    );

  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.cardIcon}>
          <Factory size={16} />
        </span>
        <div>
          <h3 className={styles.cardTitle}>{t("productionSettingsTitle")}</h3>
          <p className={styles.cardHint}>{t("productionSettingsHint")}</p>
        </div>
      </header>

      <div className={styles.cardBody}>
        {menuEnabled === false && (
          <div className={`${styles.note} ${styles.noteWarn}`}>
            <Info size={14} />
            <span>{t("productionMenuOff")}</span>
          </div>
        )}

        <div className={styles.block}>
          <div className={styles.blockHead}>
            <span className={styles.blockTitle}>{t("productionOperations")}</span>
            <div className={styles.segment} role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={!selecting}
                className={`${styles.segmentBtn} ${!selecting ? styles.segmentActive : ""}`}
                onClick={chooseAll}
              >
                {t("productionOperationsAll")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={selecting}
                className={`${styles.segmentBtn} ${selecting ? styles.segmentActive : ""}`}
                onClick={() => setForceSelect(true)}
              >
                {t("productionOperationsSelected")}
              </button>
            </div>
          </div>

          {!selecting && <p className={styles.blockHint}>{t("productionOperationsHintAll")}</p>}

          {selecting && (
            <>
              <div className={styles.blockHead}>
                <span className={styles.count}>
                  {t("productionOperationsCount", {
                    selected: selectedCount,
                    total: types.length,
                  })}
                </span>
                <span className={styles.links}>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setOperationIds(types.map((type) => type.id))}
                  >
                    {t("productionOperationsSelectAll")}
                  </button>
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setOperationIds([])}
                  >
                    {t("productionOperationsClear")}
                  </button>
                </span>
              </div>

              {!loading && types.length === 0 && (
                <p className={styles.blockHint}>{t("productionOperationsNone")}</p>
              )}

              <div className={styles.chips}>
                {types.map((type) => {
                  const active = operationIds.includes(type.id);
                  return (
                    <label
                      key={type.id}
                      className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                    >
                      <input
                        type="checkbox"
                        className={styles.srOnly}
                        checked={active}
                        onChange={() => toggleType(type.id)}
                      />
                      <span className={styles.chipCheck}>
                        <Check size={10} strokeWidth={3.5} />
                      </span>
                      {type.name}
                      {operationTags(type).map((tag) => (
                        <span key={tag} className={styles.chipTag}>
                          {t(tag)}
                        </span>
                      ))}
                    </label>
                  );
                })}
              </div>

              {selectedCount === 0 && (
                <div className={`${styles.note} ${styles.noteInfo}`}>
                  <Info size={14} />
                  <span>{t("productionOperationsEmpty")}</span>
                </div>
              )}
            </>
          )}
        </div>

        <label className={styles.switchRow}>
          <span className={styles.switchIcon}>
            <Printer size={16} />
          </span>
          <input
            type="checkbox"
            className={styles.srOnly}
            checked={canEditSticker}
            onChange={(e) => onChange({ ...value, canEditSticker: e.target.checked })}
          />
          <span className={styles.switchText}>
            <b>{t("productionStickerEdit")}</b>
            <small>{t("productionStickerEditHint")}</small>
          </span>
          <span className={styles.switch} aria-hidden="true" />
        </label>

        <label className={styles.switchRow}>
          <span className={styles.switchIcon}>
            <UserCheck size={16} />
          </span>
          <input
            type="checkbox"
            className={styles.srOnly}
            checked={Boolean(ownOnly)}
            onChange={(e) => onChange({ ...value, ownOnly: e.target.checked })}
          />
          <span className={styles.switchText}>
            <b>{t("productionOwnOnly")}</b>
            <small>{t("productionOwnOnlyHint")}</small>
          </span>
          <span className={styles.switch} aria-hidden="true" />
        </label>
      </div>
    </section>
  );
};

export default UserProductionSettings;
