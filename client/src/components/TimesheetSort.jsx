import SalarySort from "./SalarySort";

const TIMESHEET_SORT_FIELDS = [
  { value: "employeeFullName", labelKey: "fullName" },
  { value: "employeeNumber", labelKey: "employeeNumber" },
  { value: "branchName", labelKey: "branch" },
  { value: "departmentName", labelKey: "department" },
  { value: "positionName", labelKey: "position" },
  { value: "workScheduleName", labelKey: "workSchedule" },
  { value: "totalWorkedDays", labelKey: "workedDays" },
  { value: "totalWorkedHours", labelKey: "workedHours" },
];

const DEFAULT_SORT_BY = "employeeFullName";

const TimesheetSort = ({ sortField, sortOrder, onApply }) => (
  <SalarySort
    sort_by={sortField}
    sort_order={sortOrder}
    onApply={onApply}
    fields={TIMESHEET_SORT_FIELDS}
  />
);

export { DEFAULT_SORT_BY };
export default TimesheetSort;
