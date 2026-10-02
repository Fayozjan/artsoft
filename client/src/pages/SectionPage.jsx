import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getUserMenu } from "../api";
import { getMenuIcon } from "../icons/menuIcons";
import Loading from "../components/Loading";

import styles from "./SectionPage.module.scss";

// Раздел без своей страницы (hr, finance, canteen, settings) — вместо 404
// показываем его подстраницы плиткой: значок сверху, название снизу (как в
// нижнем меню телеграм-версии на планшете).
const SectionPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [menuData, setMenuData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUserMenu()
      .then(setMenuData)
      .catch(() => setMenuData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;

  const menu = menuData.find((item) => item.path === location.pathname);
  const children = (menu?.children || [])
    .filter((child) => child.permissions?.view)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        {children.map((child) => (
          <Link key={child.id} to={child.path} className={styles.tile}>
            <span className={styles.tileIcon}>{getMenuIcon(child.name)}</span>
            <span className={styles.tileLabel}>{t(child.name)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SectionPage;
