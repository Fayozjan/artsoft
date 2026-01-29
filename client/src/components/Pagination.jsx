import styles from "./Pagination.module.scss";

const Pagination = ({
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  handleChangePageSize,
  handlePageChange,
}) => {
  const getDisplayedRecordsInfo = () => {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    return { start, end };
  };

  return (
    <div className={styles.pagination}>
      {totalItems > 50 && (
        <div className={styles.pageSize}>
          <select onChange={handleChangePageSize} value={pageSize}>
            <option>50</option>
            <option>100</option>
            <option>200</option>
            <option>300</option>
            <option>400</option>
            <option>500</option>
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
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="200"
                  height="200"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#000000"
                    d="m9.55 12l7.35 7.35q.375.375.363.875t-.388.875q-.375.375-.875.375t-.875-.375l-7.7-7.675q-.3-.3-.45-.675t-.15-.75q0-.375.15-.75t.45-.675l7.7-7.7q.375-.375.888-.363t.887.388q.375.375.375.875t-.375.875L9.55 12Z"
                  />
                </svg>
              </div>

              <div
                className={styles.arrow}
                onClick={() => handlePageChange(currentPage + 1)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="200"
                  height="200"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#000000"
                    d="m14.475 12l-7.35-7.35q-.375-.375-.363-.888t.388-.887q.375-.375.888-.375t.887.375l7.675 7.7q.3.3.45.675t.15.75q0 .375-.15.75t-.45.675l-7.7 7.7q-.375.375-.875.363T7.15 21.1q-.375-.375-.375-.888t.375-.887L14.475 12Z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Pagination;
