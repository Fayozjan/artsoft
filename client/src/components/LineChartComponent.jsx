import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Line } from "react-chartjs-2";
import { Card } from "react-bootstrap";
import styles from "./LineChartComponent.module.scss";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Регистрация компонентов
ChartJS.register(
  CategoryScale, // Шкала категорий
  LinearScale, // Шкала для оси Y (по умолчанию)
  PointElement, // Точки на графике
  LineElement, // Линия на графике
  Title, // Заголовок
  Tooltip, // Подсказки
  Legend // Легенда
);

const Dash = () => {
  const { t } = useTranslation();
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [lateToday, setLateToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [attendanceData, setAttendanceData] = useState([]);

  // Здесь можно запросить данные с сервера (например, через fetch или axios)
  useEffect(() => {
    // Пример запросов на сервер
    setTotalEmployees(150); // Пример
    setPresentToday(130); // Пример
    setLateToday(10); // Пример
    setAbsentToday(10); // Пример

    setAttendanceData([
      // Пример динамики за неделю
      { day: "Mon", count: 120 },
      { day: "Tue", count: 125 },
      { day: "Wed", count: 130 },
      { day: "Thu", count: 135 },
      { day: "Fri", count: 130 },
      { day: "Sat", count: 100 },
      { day: "Sun", count: 95 },
    ]);
  }, []);

  const chartData = {
    labels: attendanceData.map((item) => item.day),
    datasets: [
      {
        label: t("weeklyAttendanceLabel"),
        data: attendanceData.map((item) => item.count),
        borderColor: "rgba(75, 192, 192, 1)",
        tension: 0.4,
        fill: false,
      },
    ],
  };

  return (
    <div className={styles.dash}>
      <div className={styles.cards}>
        <Card>
          <Card.Body>
            <Card.Title>{t("totalEmployeesCount")}</Card.Title>
            <Card.Text>{totalEmployees}</Card.Text>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <Card.Title>{t("presentToday")}</Card.Title>
            <Card.Text>{presentToday}</Card.Text>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <Card.Title>{t("lateTodayLabel")}</Card.Title>
            <Card.Text>{lateToday}</Card.Text>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <Card.Title>{t("absentTodayLabel")}</Card.Title>
            <Card.Text>{absentToday}</Card.Text>
          </Card.Body>
        </Card>
      </div>

      <div className={styles.chart}>
        <Line data={chartData} />
      </div>
    </div>
  );
};

export default Dash;
