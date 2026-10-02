import { Icons } from "../icons/icons";
import { useTranslation } from "react-i18next";
import styles from "./Button.module.scss";

const Button = ({
  text,
  onClick,
  type = "button",
  loading = false,
  disabled = false,
  icon, // свой значок вместо дефолтного (дискета у submit, плюс у обычной); false — без значка
  variant, // "light" — светлая кнопка (белый фон), чтобы отличалась от основной
  title, // подсказка; нужна, когда text пустой и кнопка — только значок
}) => {
  const { t } = useTranslation();
  const isSubmit = type === "submit";
  const className = variant === "light" ? `${styles.button} ${styles.light}` : styles.button;

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
        className={className}
        type="submit"
        disabled={disabled || loading}
        title={title}
        aria-label={title}
      >
        {icon === false ? null : icon ? (
          <span className={styles.icon}>{icon}</span>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="200"
            height="200"
            viewBox="0 0 28 28"
          >
            <path d="M6.25 4.5A1.75 1.75 0 0 0 4.5 6.25v15.5A1.75 1.75 0 0 0 6 23.482V16.25A2.25 2.25 0 0 1 8.25 14h11.5A2.25 2.25 0 0 1 22 16.25v7.232a1.75 1.75 0 0 0 1.5-1.732V8.786c0-.465-.184-.91-.513-1.238l-2.535-2.535a1.75 1.75 0 0 0-1.238-.513H19v4.25A2.25 2.25 0 0 1 16.75 11h-6.5A2.25 2.25 0 0 1 8 8.75V4.5H6.25Zm3.25 0v4.25c0 .414.336.75.75.75h6.5a.75.75 0 0 0 .75-.75V4.5h-8Zm11 19v-7.25a.75.75 0 0 0-.75-.75H8.25a.75.75 0 0 0-.75.75v7.25h13ZM3 6.25A3.25 3.25 0 0 1 6.25 3h12.965a3.25 3.25 0 0 1 2.298.952l2.535 2.535c.61.61.952 1.437.952 2.299V21.75A3.25 3.25 0 0 1 21.75 25H6.25A3.25 3.25 0 0 1 3 21.75V6.25Z" />
          </svg>
        )}
        <span>{loading ? t("loading") : text}</span>
      </button>
    );
  }

  return (
    <button
      className={className}
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      title={title}
      aria-label={title}
    >
      {icon === false ? null : icon ? <span className={styles.icon}>{icon}</span> : Icons.plus}
      {(loading || text) && <span>{loading ? t("loading") : text}</span>}
    </button>
  );
};

export default Button;
