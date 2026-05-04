import styles from "./LateEmployeesTable.module.scss";

function formatDateLabel(dateStr) {
  if (!dateStr) return "День";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

const GROUP_COLORS = {
  day: { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
  month: { bg: "#fdf4ff", color: "#9333ea", border: "#e9d5ff" },
};

const getGroupLabel = (group, date) => {
  if (group === "day") return formatDateLabel(date);
  if (group === "month") return "За месяц";
  return group;
};

const LateEmployeesTable = ({ columns = [], data = [], date }) => {
  // Build group row: consecutive same-group cols merge, ungrouped get rowSpan=2
  const groupRow = [];
  let i = 0;
  while (i < columns.length) {
    const col = columns[i];
    if (!col.group) {
      groupRow.push({ type: "single", col });
      i++;
    } else {
      let count = 1;
      while (
        i + count < columns.length &&
        columns[i + count].group === col.group
      )
        count++;
      groupRow.push({ type: "group", group: col.group, colSpan: count });
      i += count;
    }
  }

  const groupedCols = columns.filter((c) => c.group);

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          {/* Row 1: group spans */}
          <tr>
            {groupRow.map((entry, idx) => {
              if (entry.type === "single") {
                return (
                  <th key={idx} rowSpan={2} className={styles.thSingle}>
                    <span className={styles.headerContent}>
                      {entry.col.label}
                    </span>
                  </th>
                );
              }
              const c = GROUP_COLORS[entry.group] || {};
              return (
                <th
                  key={idx}
                  colSpan={entry.colSpan}
                  className={styles.thGroup}
                  style={{
                    background: c.bg,
                    color: c.color,
                    borderBottom: `2px solid ${c.border}`,
                  }}
                >
                  {getGroupLabel(entry.group, date)}
                </th>
              );
            })}
          </tr>
          {/* Row 2: sub-column names (only grouped cols) */}
          <tr>
            {groupedCols.map((col, idx) => {
              const c = GROUP_COLORS[col.group] || {};
              return (
                <th
                  key={idx}
                  className={styles.thSub}
                  style={{ borderTop: `1px solid ${c.border}` }}
                >
                  <span className={styles.headerContent}>{col.label}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                Нет данных
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
              <tr key={item.employeeId || rowIdx} className={styles.row}>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} style={col.style}>
                    {col.render
                      ? col.render(item[col.accessor], item, rowIdx)
                      : item[col.accessor]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LateEmployeesTable;
