import styles from "./AttendanceReportConfig.module.scss";
import ChatIdsInput from "./ChatIdsInput";

// Конфиг-под-форма для task_type = "database_backup".
const DatabaseBackupConfig = ({ config, onChange, failedChatIds }) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.row}>
        <div>
          <ChatIdsInput
            value={config.chat_ids}
            onChange={(chat_ids) => onChange({ ...config, chat_ids })}
            failedIds={failedChatIds}
          />
        </div>
      </div>
    </div>
  );
};

export default DatabaseBackupConfig;
