import { useTranslation } from "react-i18next";
import styles from "./NotFoundPage.module.scss";

function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      <h1>{t("notFound")}</h1>
      <p>{t("notFoundMessage")}</p>
    </div>
  );
}

export default NotFoundPage;
