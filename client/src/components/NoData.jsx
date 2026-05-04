import { useTranslation } from "react-i18next";
import styles from "./NoData.module.scss";

const NoData = ({ title }) => {
  const { t } = useTranslation();
  return <div className={styles.noData}>{title ?? t("noDataFiltered")}</div>;
};

export default NoData;
