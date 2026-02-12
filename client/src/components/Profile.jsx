import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import { getUserInfo } from "../api";
import { Icons } from "../icons/icons";

import ProfileSettings from "./ProfileSettings";
import CenterModal from "./CenterModal";
import OverlaySidebar from "./OverlaySidebar";

import styles from "./Profile.module.scss";

const Profile = ({ type }) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [user, setUser] = useState(null);
  const [profileSettings, setProfileSettings] = useState(false);

  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const userRes = await getUserInfo();
        setUser(userRes);
      } catch (err) {
        console.error("Ошибка загрузки данных пользователя:", err);
      }
    };
    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post("/api/logout");
      logout();
      navigate("/");
    } catch (error) {
      console.error("Ошибка при выходе:", error);
    }
  };

  // Выносим кнопки в отдельную переменную, чтобы не дублировать JSX
  const ActionButtons = (
    <div className={styles.buttons}>
      <span className={styles.iconBtn} onClick={() => setProfileSettings(true)}>
        {Icons.settings}
      </span>
      <span className={styles.iconBtn} onClick={() => setShowModal(true)}>
        {Icons.exit}
      </span>
    </div>
  );

  return (
    <>
      {type === "mini" ? (
        <div className={styles.profile_mini}>{ActionButtons}</div>
      ) : (
        <div className={styles.profile}>
          <div className={styles.userInfo}>
            <p>{user?.first_name || "Имя"}</p>
            <span>{user?.position || "Должность"}</span>
          </div>
          {ActionButtons}
        </div>
      )}

      {/* Общие модалки для обоих типов отображения */}
      <CenterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAccept={handleLogout}
        title="Вы уверены?"
      />

      <OverlaySidebar
        width="400px"
        isOpen={profileSettings}
        onClose={() => setProfileSettings(false)}
        title="Настройки профиля"
      >
        <ProfileSettings onClose={() => setProfileSettings(false)} />
      </OverlaySidebar>
    </>
  );
};

export default Profile;
