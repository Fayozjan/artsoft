import { getAttendanceByEmployeeId } from "../api";

const DashboardPage = () => {
  const func = async () => {
    const data = await getAttendanceByEmployeeId(4400, { date: "2026-04-09" });
    console.log(data);
  };

  func();

  return <div></div>;
};

export default DashboardPage;
