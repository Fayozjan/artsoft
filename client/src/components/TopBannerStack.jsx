import OfflineBanner from "./OfflineBanner";
import AlertBanner from "./AlertBanner";
import styles from "./TopBannerStack.module.scss";

export default function TopBannerStack() {
  return (
    <div className={styles.stack}>
      <OfflineBanner />
      <AlertBanner />
    </div>
  );
}
