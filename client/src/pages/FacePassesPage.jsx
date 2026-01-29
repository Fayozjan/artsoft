import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getFacePasses } from "../api";

import Pagination from "../components/Pagination";
import Loading from "../components/Loading";
import TableHrEvents from "../components/TableHrEvents";
import FacePassesFilter from "../components/FacePassesFilter";
import DownloadButton from "../components/DownloadButton";

import styles from "./FacePassesPage.module.scss";

const FacePassesPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const { t } = useTranslation();

  const today = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    start_date: `${today} 00:00`,
    end_date: `${today} 23:59`,
    branch_id: null,
    department_id: null,
    position_id: null,
    direction: "",
    selectedDoorIds: [],
  });

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize
  ) => {
    setLoading(true);

    try {
      const { data, pagination } = await getFacePasses({
        page,
        pageSize: size,
        filters,
      });

      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (err) {
      console.error("Ошибка загрузки данных посещаемости:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  // Обработчик отправки формы
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData, pageSize);
  };

  // Обработчик смены страницы
  const handlePageChange = useCallback(
    (newPage) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
      }
    },
    [totalPages]
  );

  // Обработчик изменения размера страницы
  const handleChangePageSize = useCallback((e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, formData, pageSize);
  };

  return (
    <div className={styles.facePassesPages}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <div className={styles.searchInput}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="19"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#000000"
                    d="M15.096 5.904a6.5 6.5 0 1 0-9.192 9.192a6.5 6.5 0 0 0 9.192-9.192ZM4.49 4.49a8.5 8.5 0 0 1 12.686 11.272l5.345 5.345l-1.414 1.414l-5.345-5.345A8.501 8.501 0 0 1 4.49 4.49Z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder={t("search")}
                  value={formData.search || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />

                {formData.search && (
                  <svg
                    className={styles.clearBtn}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        search: "",
                      }));
                    }}
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="18"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="none"
                      stroke="#000000"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </div>

              <FacePassesFilter
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
              />
            </div>

            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
            />

            <div className={styles.buttonsWrapper}>
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="200"
                  height="200"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="#000000"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"
                  />
                </svg>

                <span>Обновить данные</span>
              </div>

              {data.length > 0 && (
                <DownloadButton
                  text={t("save")}
                  // onClick={() => exportEmployeesToExcel(data)}
                />
              )}
            </div>
          </div>
          <TableHrEvents
            data={data}
            currentPage={currentPage}
            pageSize={pageSize}
          />
        </div>
      )}
    </div>
  );
};

export default FacePassesPage;
