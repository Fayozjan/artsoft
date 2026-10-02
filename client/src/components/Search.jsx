import { useRef } from "react";
import { useTranslation } from "react-i18next";

import styles from "./Search.module.scss";
import { Icons } from "../icons/icons";

const Search = ({ formData, setFormData, onSearch }) => {
  const { t } = useTranslation();
  const debounceTimer = useRef(null);
  const pendingData = useRef(formData);

  const scheduleSearch = (data) => {
    pendingData.current = data;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(
      () => onSearch(pendingData.current),
      1000,
    );
  };

  const fireSearch = (data) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    onSearch(data);
  };

  const handleChange = (e) => {
    const next = { ...formData, search: e.target.value };
    setFormData(next);
    scheduleSearch(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") fireSearch(pendingData.current ?? formData);
  };

  const handleClear = () => {
    const next = { ...formData, search: "" };
    setFormData(next);
    fireSearch(next);
  };

  return (
    <div className={styles.searchInput}>
      <span onClick={() => fireSearch(pendingData.current ?? formData)}>
        {Icons.search}
      </span>
      <input
        type="text"
        placeholder={t("search")}
        value={formData?.search || ""}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {formData?.search && (
        <span className={styles.clearBtn} onClick={handleClear}>
          {Icons.clear}
        </span>
      )}
    </div>
  );
};

export default Search;
