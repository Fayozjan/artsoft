import { useState, useEffect, useRef } from "react";
import { Icons } from "../icons/icons";
import styles from "./SelectWithSearch.module.scss";

function SelectWithSearch({
  value,
  options = [],
  setFormData,
  placeholder,
  data,
  disabled,
  required,
  noMatches,
}) {
  const [search, setSearch] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const containerRef = useRef(null);

  // синхронизация с внешним formData
  useEffect(() => {
    if (!value) {
      setSearch("");
      setSelectedOption(null);
      return;
    }

    const opt = options.find((o) => o.id === value);
    if (opt) {
      setSearch(opt.name);
      setSelectedOption(opt);
    }
  }, [value, options]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearch(value);
    setShowOptions(true);

    if (value === "") {
      resetSelection();
    }
  };

  const handleOptionClick = (option) => {
    setFormData((prev) => ({
      ...prev,
      [`${data}_id`]: option.id,
    }));
    setShowOptions(false);
  };

  const resetSelection = () => {
    setFormData((prev) => ({
      ...prev,
      [`${data}_id`]: "",
    }));
  };

  const filteredOptions = options.filter((option) => {
    const name = option?.name?.toLowerCase() || "";
    const searchParts = search.toLowerCase().split(" ");
    return searchParts.some(
      (p) =>
        name.includes(p) ||
        option.id?.toString() === p ||
        option.employee_number?.toString() === p,
    );
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowOptions(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className={styles.selectWithSearch} ref={containerRef}>
      <input
        type="text"
        value={search}
        onChange={handleInputChange}
        onFocus={() => setShowOptions(true)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
      />

      {value && (
        <span className={styles.clearBtn} onClick={resetSelection} style={{ display: "flex", cursor: "pointer" }}>
          {Icons.clear}
        </span>
      )}

      {showOptions && (
        <ul className={styles.optionsList}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <li key={option.id} onClick={() => handleOptionClick(option)}>
                {option.name}
                {data === "employee" && ` ${option.id}`}
              </li>
            ))
          ) : (
            <li className={styles.no_matches}>{noMatches}</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default SelectWithSearch;
