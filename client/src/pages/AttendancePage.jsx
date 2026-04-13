import { useTelegram } from "../hooks/useTelegram";
import AttendancePageWeb from "./AttendancePageWeb";
import AttendancePageTelegram from "./AttendancePageTelegram";

const AttendancePage = () => {
  const { isTelegram } = useTelegram();

  return isTelegram ? <AttendancePageTelegram /> : <AttendancePageWeb />;
};

export default AttendancePage;
