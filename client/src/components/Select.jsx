import React, { useRef, useState, useEffect } from 'react';
import styles from '../styles/Select.module.scss';

const Select = ({ options, setFormData }) => {
  const [selectedItems, setSelectedItems] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const toggleSelect = () => setIsOpen((prev) => !prev);

  const handleItemClick = (value) => {
    setSelectedItems((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  // Обновляем formData при изменении selectedItems
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      door: selectedItems,
    }));
  }, [selectedItems, setFormData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className={styles.multiSelectContainer}>
      <div onClick={toggleSelect} className={styles.selectBox}>
        {selectedItems.length > 0 ? selectedItems.join(', ') : 'Выберите ...'}
      </div>
      {isOpen && (
        <div className={styles.dropdown}>
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => handleItemClick(option.value)}
              className={`${styles.item} ${
                selectedItems.includes(option.value) ? styles.selected : ''
              }`}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Select;
