import styles from "./NotFoundPage.module.scss";

function NotFound() {
  return (
    <div className={styles.container}>
      <h1>404 - Страница не найдена</h1>
      <p> К сожалению, страница, которую вы ищете, не существует.</p>
    </div>
  );
}

export default NotFound;
