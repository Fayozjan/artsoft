import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import styles from "./Profile.module.scss";
import CenterModal from "./CenterModal";
import OverlaySidebar from "./OverlaySidebar";
import ProfileSettings from "./ProfileSettings";
import { useNavigate } from "react-router-dom";

// Иконки (можно заменить на свою библиотеку)
const IconSettings = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconLogout = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconHelp = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const Profile = ({ type = "full" }) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isMini = type === "mini";
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);

  const [isOpen, setIsOpen] = useState(false);

  const [isProfileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const wrapperRef = useRef(null);

  const loadUser = useAuthStore((state) => state.loadUser);

  useEffect(() => {
    if (!user) {
      loadUser();
    }
  }, []);

  // Закрытие по клику вне
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleToggle = () => setIsOpen((prev) => !prev);

  const handleLogout = () => {
    setIsOpen(false);
    logout(navigate);
  };

  const handleSettings = () => {
    setIsOpen(false);
    setProfileSettingsOpen(true);
  };

  return (
    <div
      ref={wrapperRef}
      className={`${styles.profileWrapper} ${isMini ? styles.mini : ""} ${isOpen ? styles.active : ""}`}
    >
      <div className={`${styles.popup} ${isOpen ? styles.popupVisible : ""}`}>
        <div className={styles.popupHeader}>
          <div className={styles.popupAvatar}>
            {user?.photo ? (
              <img src={`/api/employees/image/${user.photo}`} />
            ) : (
              <span>{user?.first_name?.[0] || "U"}</span>
            )}
          </div>
          <div className={styles.popupUserInfo}>
            <div className={styles.popupName}>
              {user?.first_name} {user?.last_name}
            </div>
            <div className={styles.popupPosition}>
              {user?.position || "Employee"}
            </div>
          </div>
        </div>

        <div className={styles.popupDivider} />

        <div className={styles.popupMenu}>
          <button className={styles.popupItem} onClick={() => handleSettings()}>
            <IconSettings />
            <span>Настройки</span>
          </button>
          <button
            className={styles.popupItem}
            onClick={() => window.open("https://t.me/fayoz7", "_blank")}
          >
            <IconHelp />
            <span>Помощь</span>
          </button>
        </div>

        <div className={styles.popupDivider} />

        <div className={styles.popupMenu}>
          <button
            className={`${styles.popupItem} ${styles.popupItemDanger}`}
            onClick={() => setLogoutModalOpen(true)}
          >
            <IconLogout />
            <span>Выйти</span>
          </button>
        </div>
      </div>

      {/* Триггер */}
      <div className={styles.profile} onClick={handleToggle}>
        <div className={styles.profileAvatar}>
          {user?.photo ? (
            <img src={`/api/employees/image/${user.photo}`} />
          ) : (
            <span>{user?.first_name?.[0] || "U"}</span>
          )}
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.profileName}>{user?.first_name || "User"}</div>
          <div className={styles.profileRole}>
            {user?.position || "Employee"}
          </div>
        </div>
      </div>

      <CenterModal
        isOpen={isLogoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onAccept={handleLogout}
        tag="Выход"
      />

      <OverlaySidebar
        width="400px"
        isOpen={isProfileSettingsOpen}
        onClose={() => setProfileSettingsOpen(false)}
        title="Настройки профиля"
      >
        <ProfileSettings onClose={() => setProfileSettingsOpen(false)} />
      </OverlaySidebar>
    </div>
  );
};

export default Profile;
