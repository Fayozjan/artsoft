import { Icons } from "../icons/icons";
import styles from "./Pagination.module.scss";

const Pagination = ({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  handleChangePageSize,
  handlePageChange,
  centered = false, // по центру и покрупнее — для узких боковых панелей
}) => {
  const getDisplayedRecordsInfo = () => {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    return { start, end };
  };

  return (
    <div className={`${styles.pagination} ${centered ? styles.centered : ""}`}>
      {totalItems > 50 && (
        <div className={styles.pageSize}>
          <select onChange={handleChangePageSize} value={pageSize}>
            <option>50</option>
            <option>100</option>
            <option>200</option>
            <option>300</option>
            <option>400</option>
            <option>500</option>
            <option>1000</option>
          </select>
        </div>
      )}

      {totalPages > 1 && (
        <>
          <div className={styles.pageCounts}>
            {`${getDisplayedRecordsInfo().start} - ${
              getDisplayedRecordsInfo().end
            } / ${totalItems}`}
          </div>
          <div className={styles.pageControls}>
            <div className={styles.currentPage}>
              <span>{currentPage}</span>
              <span>/</span>
              <span>{totalPages}</span>
            </div>

            <div className={styles.arrows}>
              <div
                className={styles.arrow}
                onClick={() => handlePageChange(currentPage - 1)}
              >
                {Icons.pageLeft}
              </div>

              <div
                className={styles.arrow}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                {Icons.pageRight}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Pagination;
