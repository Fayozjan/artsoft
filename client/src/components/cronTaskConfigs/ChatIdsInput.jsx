import { useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./AttendanceReportConfig.module.scss";

// Множественный выбор telegram chat_id — ввод значения и добавление в список чипов.
// failedIds — chat_id, не получившие последнюю отправку (из last_run_error), подсвечиваются красным.
const ChatIdsInput = ({ value, onChange, failedIds }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const chatIds = value || [];
  const failedSet = new Set(failedIds || []);

  const addChatId = () => {
    const v = draft.trim();
    if (!v || chatIds.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...chatIds, v]);
    setDraft("");
  };

  const removeChatId = (id) => onChange(chatIds.filter((c) => c !== id));

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addChatId();
    }
  };

  return (
    <div>
      <label>{t("chatIds")}</label>
      <div className={styles.chatIdsInputRow}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addChatId}
          placeholder={t("chatIdHint")}
        />
        <button type="button" className={styles.chatIdsAddBtn} onClick={addChatId}>
          +
        </button>
      </div>
      {chatIds.length > 0 ? (
        <div className={styles.chatIdsList}>
          {chatIds.map((id) => (
            <span
              key={id}
              className={`${styles.chatIdChip} ${failedSet.has(id) ? styles.chatIdChipError : ""}`}
              title={failedSet.has(id) ? t("chatIdUnavailable") : ""}
            >
              {id}
              <button type="button" onClick={() => removeChatId(id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className={styles.chatIdsEmpty}>{t("chatIdsEmptyHint")}</div>
      )}
    </div>
  );
};

export default ChatIdsInput;
