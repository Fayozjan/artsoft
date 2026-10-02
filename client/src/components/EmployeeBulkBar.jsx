import { useTranslation } from "react-i18next";
import {
  CalendarClock,
  DoorOpen,
  PencilLine,
  ScanFace,
  UserMinus,
  Trash2,
  X,
} from "lucide-react";

import styles from "./EmployeeBulkBar.module.scss";

// Панель массовых действий над выделенными сотрудниками.
// Показывается только когда что-то выделено — над таблицей.
const EmployeeBulkBar = ({
  count,
  canEdit,
  canDelete,
  onChangeSchedule,
  onAssignDoors,
  onEditPlacement,
  onSyncFaceDevices,
  onTerminate,
  onDelete,
  onClear,
}) => {
  const { t } = useTranslation();

  if (!count) return null;

  return (
    <div className={styles.bulkBar}>
      <span className={styles.count}>
        {t("selectedEmployees")}: <b>{count}</b>
      </span>

      <div className={styles.actions}>
        {canEdit && (
          <button type="button" className={styles.action} onClick={onChangeSchedule}>
            <CalendarClock size={15} />
            {t("bulkChangeWorkSchedule")}
          </button>
        )}

        {canEdit && (
          <button type="button" className={styles.action} onClick={onAssignDoors}>
            <DoorOpen size={15} />
            {t("bulkAssignDoors")}
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            className={styles.action}
            onClick={onEditPlacement}
          >
            <PencilLine size={15} />
            {t("bulkEditPlacement")}
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            className={styles.action}
            onClick={onSyncFaceDevices}
          >
            <ScanFace size={15} />
            {t("bulkSyncFaceDevices")}
          </button>
        )}

        {canEdit && (
          <button
            type="button"
            className={`${styles.action} ${styles.warn}`}
            onClick={onTerminate}
          >
            <UserMinus size={15} />
            {t("bulkTerminate")}
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            className={`${styles.action} ${styles.danger}`}
            onClick={onDelete}
          >
            <Trash2 size={15} />
            {t("delete")}
          </button>
        )}
      </div>

      <button type="button" className={styles.clear} onClick={onClear}>
        <X size={14} />
        {t("clearSelection")}
      </button>
    </div>
  );
};

export default EmployeeBulkBar;
