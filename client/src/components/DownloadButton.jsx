import styles from "./DownloadButton.module.scss";

const DownloadButton = ({ text = "Сохранить", onClick }) => {
  return (
    <button className={styles.downloadBtn} type="button" onClick={onClick}>
      <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4.994 10A2.996 2.996 0 0 0 2 12.999V20A2.997 2.997 0 0 0 4.994 23h23.012A2.996 2.996 0 0 0 31 20.001V13A2.997 2.997 0 0 0 28.006 10H4.994ZM7 16.5 5 13h1l1.5 2.625L9 13h1l-2 3.5 2 3.5H9l-1.5-2.625L6 20H5l2-3.5Zm9 2.5v1h-5v-7h1v6h4Zm3.005-6A1.998 1.998 0 0 0 17 15c0 1.105.888 2 2 2h.99c.558 0 1.01.444 1.01 1 0 .552-.443 1-.999 1h-1.002c-.552 0-.999-.456-.999-.996v-.01h-1v.005A2 2 0 0 0 19.005 20h.99A1.998 1.998 0 0 0 22 18c0-1.105-.888-2-2-2h-.99c-.558 0-1.01-.444-1.01-1 0-.552.443-1 .999-1h1.002c.552 0 .999.453.999 1h1a2 2 0 0 0-2.005-2h-.99ZM25 16.5 23 13h1l1.5 2.625L27 13h1l-2 3.5 2 3.5h-1l-1.5-2.625L24 20h-1l2-3.5Z"
          fill="#0f730b"
          fillRule="evenodd"
        />
      </svg>
      <span>{text}</span>
    </button>
  );
};

export default DownloadButton;
