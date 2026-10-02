import { useEffect } from "react";

import { useImagePreviewStore } from "../stores/imagePreviewStore";
import { Icons } from "../icons/icons";
import styles from "./ImagePreviewModal.module.scss";

const ImagePreviewModal = () => {
  const { src, close } = useImagePreviewStore();

  useEffect(() => {
    if (!src) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [src, close]);

  if (!src) return null;

  return (
    <div className={styles.overlay} onClick={close}>
      <button className={styles.closeBtn} onClick={close}>
        {Icons.clear}
      </button>
      <img
        src={src}
        alt=""
        className={styles.image}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

export default ImagePreviewModal;
