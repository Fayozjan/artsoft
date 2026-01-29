import styles from "./AtWorkChart.module.scss";

const AtWorkChart = ({ data, handleClickDepartment }) => {
  const chartData = data.map((dept) => ({
    name: dept.departmentName,
    id: dept.departmentId,
    total: dept.allEmployeeCount,
    arrived: dept.arrivedEmployeeCount,
    absent: dept.allEmployeeCount - dept.arrivedEmployeeCount,
    present: dept.onSiteEmployeeCount,
    left: dept.arrivedEmployeeCount - dept.onSiteEmployeeCount,
    presencePercentage:
      dept.allEmployeeCount > 0
        ? Math.round((dept.arrivedEmployeeCount / dept.allEmployeeCount) * 100)
        : 0,
  }));

  const handleClick = (e) => {
    const departmentId = e.currentTarget.dataset.id;
    handleClickDepartment(departmentId);
  };

  return (
    <div className={styles.tableWrapper}>
      <h2 className={styles.tableTitle}>Детальная статистика по отделам</h2>
      <div className={styles.tableContainer}>
        <table className={styles.statsTable}>
          <thead>
            <tr>
              <th>№</th>
              <th>Отдел</th>
              <th>Всего</th>
              <th>Пришли</th>
              <th>Не пришли</th>
              <th>Сейчас на работе</th>
              <th>Ушли с работы</th>
              <th>Процент</th>
              <th>Прогресс</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((dept, index) => (
              <tr key={index} data-id={dept.id} onClick={handleClick}>
                <td className={styles.deptName}>{index + 1}</td>
                <td className={styles.deptName}>{dept.name}</td>
                <td className={styles.total}>{dept.total}</td>
                <td className={styles.arrived}>{dept.arrived}</td>
                <td className={styles.absent}>{dept.absent}</td>
                <td className={styles.present}>{dept.present}</td>
                <td className={styles.left}>{dept.left}</td>
                <td>{dept.presencePercentage}%</td>
                <td>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${dept.presencePercentage}%` }}
                    ></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AtWorkChart;
