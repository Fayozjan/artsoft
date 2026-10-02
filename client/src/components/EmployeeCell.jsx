import { useImagePreviewStore } from "../stores/imagePreviewStore";
import { useHideBranch } from "../hooks/useHideBranch";
import styles from "./EmployeeCell.module.scss";

export default function EmployeeCell({
  photo,
  lastName,
  firstName,
  middleName,
  fullName,
  id,
  branch,
  department,
  position,
  active = true,
  compact = false,
  hidePhoto = false,
  alwaysShowBranch = false, // показывать филиал даже в режиме одного филиала (списки чужих сотрудников)
  previewable = true, // false — клик по фото не открывает превью (ячейка внутри кликабельной строки)
}) {
  const photoUrl = photo ? `/api/employees/image/${photo}` : null;

  const cleanName = fullName
    ? fullName.replace(/\s+\(?\d+\)?$/, "")
    : [lastName, firstName, middleName].filter(Boolean).join(" ");

  const initials = fullName
    ? cleanName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : [lastName, firstName]
        .filter(Boolean)
        .map((n) => n[0].toUpperCase())
        .join("");

  const isInactive = active === false;
  const openImagePreview = useImagePreviewStore((s) => s.open);

  const hideBranch = useHideBranch() && !alwaysShowBranch;

  return (
    <div className={`${styles.empCell} ${compact ? styles.compact : ""}`}>
      {!hidePhoto && (
        <div className={`${styles.empAvatar} ${isInactive ? styles.inactive : ""}`}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="employee"
              className={styles.empPhoto}
              onClick={previewable ? () => openImagePreview(photoUrl) : undefined}
              style={previewable ? { cursor: "pointer" } : undefined}
            />
          ) : (
            <div className={`${styles.empInitials} ${isInactive ? styles.inactiveInitials : ""}`}>
              {initials}
            </div>
          )}
        </div>
      )}
      <div className={styles.empInfo}>
        <span className={styles.empName}>
          {cleanName}
          {id != null && <span className={styles.empId}> ({id})</span>}
        </span>
        <span className={styles.empSub}>
          {[hideBranch ? null : branch, department, position]
            .filter(Boolean)
            .join(" / ")}
        </span>
      </div>
    </div>
  );
}
