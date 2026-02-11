import { Icons } from "../icons/icons";
import styles from "./Button.module.scss";

const Button = ({
  text,
  onClick,
  type = "button",
  loading = false,
  disabled = false,
}) => {
  const isSubmit = type === "submit";

  const handleClick = (e) => {
    if (loading || disabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (onClick) {
      onClick(e);
    }
  };

  if (isSubmit) {
    return (
      <button
        className={styles.button}
        type="submit"
        disabled={disabled || loading}
      >
        {Icons.save}
        <span>{loading ? "Загрузка..." : text}</span>
      </button>
    );
  }

  return (
    <button
      className={styles.button}
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
    >
      {Icons.plus}
      <span>{loading ? "Загрузка..." : text}</span>
    </button>
  );
};

export default Button;
