import styles from "./Button.module.scss";

const Button = ({
  text,
  onClick,
  type = "button",
  loading = false,
  disabled = false,
}) => {
  return (
    <button
      className={styles.button}
      type={type}
      onClick={loading ? undefined : onClick}
      disabled={disabled || loading}
    >
      {type === "button" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path fill="#ffffff" d="M13 4v7h7v2h-7v7h-2v-7H4v-2h7V4h2Z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path
            fill="#ffffff"
            d="M12 3a1 1 0 0 1 1 1v7.586l1.293-1.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L11 11.586V4a1 1 0 0 1 1-1zM5 8a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-2a1 1 0 1 1 0-2h2a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3h2a1 1 0 0 1 0 2H5z"
          />
        </svg>
      )}

      <span>{loading ? "Загрузка..." : text}</span>
    </button>
  );
};

export default Button;
