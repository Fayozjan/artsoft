import { useState, useEffect, useCallback } from "react";

import { downloadEmployeesAtWorkToExcel } from "../utils/DocGenerator";

import EmployeeFilterForm from "../components/EmployeeFilterForm";
import SearchBtn from "../components/SearchBtn";
import Loading from "../components/Loading";
import AtWorkList from "../components/AtWorkList";
import AtWorkTable from "../components/AtWorkTable";
import AtWorkChart from "../components/AtWorkChart";

import { getAttendance } from "../api";

import styles from "./AttendancePage.module.scss";

function Counter({ start, end }) {
  const [count, setCount] = useState(start);

  useEffect(() => {
    let startTime = Date.now();
    let endTime = startTime + 2000;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (endTime - startTime), 1);
      const value = Math.floor(progress * (end - start) + start);
      setCount(value);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [start, end]);

  return <span>{count}</span>;
}

function filterEmployeesByDepartment(
  arrivedEmployees,
  absentEmployees,
  departmentId
) {
  const idStr = departmentId.toString();

  const arrived = arrivedEmployees.filter(
    (employee) => employee.employeeInfo?.department_id?.toString() === idStr
  );

  const absent = absentEmployees.filter(
    (employee) => employee.department_id?.toString() === idStr
  );

  return {
    department_id: departmentId,
    department_name:
      arrived[0]?.employeeInfo?.department_name ||
      absent[0]?.department_name ||
      "Неизвестный отдел",
    arrived,
    absent,
  };
}

const AttendancePage = () => {
  const [data, setData] = useState([]);
  const [absentEmployees, setAbsentEmployees] = useState([]);
  const [leftEmployees, setLeftEmployees] = useState([]);
  const [allEmployeesCount, setAllEmployeesCount] = useState();
  const [arrivedEmployeesCount, setArrivedEmployeesCount] = useState();
  const [arrivedEmployeesByDepartment, setArrivedEmployeesByDepartment] =
    useState();
  const [onSiteEmployeesCount, setOnSiteEmployeesCount] = useState();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [filteredEmployees, setFilteredEmployees] = useState({});
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [leftEmployeesShow, setLeftEmployeesShow] = useState(false);

  const [formData, setFormData] = useState({
    branch_id: "",
    department_id: "",
  });

  const cards = [
    {
      title: "Всего отделов",
      value: arrivedEmployeesByDepartment?.length,
      color: "#F59E0B",
    },
    { title: "Всего сотрудников", value: allEmployeesCount, color: "#4F46E5" },
    {
      title: "Пришли на работу",
      value: arrivedEmployeesCount,
      color: "#16A34A",
    },
    {
      title: "Не пришли на работу",
      value: absentEmployees.length,
      color: "red",
    },
    { title: "Сейчас на работе", value: onSiteEmployeesCount, color: "green" },
    {
      title: "Ушли с работы",
      value: arrivedEmployeesCount - onSiteEmployeesCount,
      color: "#EF4444",
    },
  ];

  // Обработчик отправки формы
  const handleFormSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await getAttendance({
        formData,
      });

      setData(data.allArrivedEmployees);
      setAllEmployeesCount(data.allActiveEmployeesCount);
      setArrivedEmployeesCount(data.allArrivedEmployees.length);
      setOnSiteEmployeesCount(data.onSiteEmployeesCount);
      setArrivedEmployeesByDepartment(data.arrivedByDepartment);
      setAbsentEmployees(data.absentEmployees);
      setLeftEmployees(data.leftEmployees);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
      setSearchPerformed(true);
    }
  });

  const handleClickDepartment = (id) => {
    setFilteredEmployees(
      filterEmployeesByDepartment(data, absentEmployees, id)
    );
    setModalVisible(true);
  };

  const closeLeftEmployeesShow = useCallback(
    () => setLeftEmployeesShow(false),
    []
  );

  const closeModal = useCallback(() => setModalVisible(false), []);

  return (
    <div className={styles.attendancePage}>
      <div className={styles.header}>
        <form className={styles.filter} onSubmit={handleFormSubmit}>
          <EmployeeFilterForm
            filters={["branch", "department"]}
            formData={formData}
            setFormData={setFormData}
            required={["branch"]}
          />
          <SearchBtn data={data} />
          {data.length > 0 && (
            <button
              className={styles.download}
              type="button"
              onClick={() => downloadEmployeesAtWorkToExcel(data, absentUsers)}
            >
              Скачать
              <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M4.994 10A2.996 2.996 0 0 0 2 12.999V20A2.997 2.997 0 0 0 4.994 23h23.012A2.996 2.996 0 0 0 31 20.001V13A2.997 2.997 0 0 0 28.006 10H4.994ZM7 16.5 5 13h1l1.5 2.625L9 13h1l-2 3.5 2 3.5H9l-1.5-2.625L6 20H5l2-3.5Zm9 2.5v1h-5v-7h1v6h4Zm3.005-6A1.998 1.998 0 0 0 17 15c0 1.105.888 2 2 2h.99c.558 0 1.01.444 1.01 1 0 .552-.443 1-.999 1h-1.002c-.552 0-.999-.456-.999-.996v-.01h-1v.005A2 2 0 0 0 19.005 20h.99A1.998 1.998 0 0 0 22 18c0-1.105-.888-2-2-2h-.99c-.558 0-1.01-.444-1.01-1 0-.552.443-1 .999-1h1.002c.552 0 .999.453.999 1h1a2 2 0 0 0-2.005-2h-.99ZM25 16.5 23 13h1l1.5 2.625L27 13h1l-2 3.5 2 3.5h-1l-1.5-2.625L24 20h-1l2-3.5Z"
                  fill="#0f730b"
                  fill-rule="evenodd"
                  class="fill-157efb"
                ></path>
              </svg>
            </button>
          )}
        </form>
      </div>
      {data.length > 0 ? (
        <div className={styles.container}>
          <div className={styles.dashboard_container}>
            <div className={styles.cardGrid}>
              {cards.map((card, index) => (
                <div
                  key={index}
                  className={styles.card}
                  onClick={
                    index === 5 ? () => setLeftEmployeesShow(true) : undefined
                  }
                >
                  <div className={styles.card_header}>
                    <h3 className={styles.title}>{card.title}</h3>
                  </div>
                  <div className={styles.value} style={{ color: card.color }}>
                    <Counter start={0} end={card.value} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <AtWorkChart
            data={arrivedEmployeesByDepartment}
            handleClickDepartment={handleClickDepartment}
          />

          {modalVisible && filteredEmployees && (
            <AtWorkTable data={filteredEmployees} onClose={closeModal} />
          )}

          {leftEmployeesShow && leftEmployees && (
            <AtWorkList data={leftEmployees} onClose={closeLeftEmployeesShow} />
          )}
        </div>
      ) : (
        searchPerformed && <div className={styles.noRecords}>Нет записей</div>
      )}
      {loading && <Loading />}
    </div>
  );
};

export default AttendancePage;
