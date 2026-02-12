import { useTranslation } from "react-i18next";

import styles from "./Search.module.scss";
import { Icons } from "../icons/icons";

const Search = ({ formData, setFormData, handleSearch }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.searchInput}>
      <span onClick={handleSearch}>{Icons.search}</span>
      <input
        type="text"
        placeholder={t("search")}
        value={formData?.search || ""}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            search: e.target.value,
          }))
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleSearch();
          }
        }}
      />

      {formData.search && (
        <span
          className={styles.clearBtn}
          onClick={() => {
            const newFormData = { ...formData, search: "" };
            setFormData(newFormData);
            handleSearch(newFormData);
          }}
        >
          {Icons.clear}
        </span>
      )}
    </div>
  );
};

export default Search;
