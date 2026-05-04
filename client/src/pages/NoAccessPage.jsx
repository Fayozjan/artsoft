import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import styles from "./NotFoundPage.module.scss";

function NoAccessPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <div className={styles.main}>
        <h1>{t("noAccess")}</h1>
        <button onClick={() => navigate(-1)}>{t("goBack")}</button>
      </div>
    </div>
  );
}

export default NoAccessPage;
