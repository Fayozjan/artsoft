import { useNavigate } from "react-router-dom";

import styles from "./NotFoundPage.module.scss";

function NotFound() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1); // Навигация на предыдущую страницу
  };

  return (
    <div className={styles.container}>
      <div className={styles.main}>
        <h1>К сожалению, у вас нет доступа.</h1>
        <button onClick={handleGoBack}>Назад</button>
      </div>
    </div>
  );
}

export default NotFound;
