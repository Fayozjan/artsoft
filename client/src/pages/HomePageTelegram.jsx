import HomeTelegram from "../components/HomeTelegram";
import { useAuthStore } from "../stores/authStore";

const HomePageTelegram = () => {
  const { access } = useAuthStore();

  if (
    access?.access_level === "employee" ||
    access?.personal_menus?.includes("home")
  ) {
    return (
      <HomeTelegram
        role="employee"
        employee={{
          name: "Алишер Камолов",
          position: "Frontend-разработчик",
          department: "Разработка",
          branch: "Главный офис",
          schedule: "09:00 – 18:00",
        }}
        shift={{
          status: "inside",
          checkIn: "09:04",
          checkOut: null,
          workedMinutes: 312,
          lateMinutes: 4,
          extraMinutes: 0,
        }}
        monthStats={{
          workedDays: 8,
          totalDays: 22,
          totalMinutes: 3690,
          lateCount: 3,
          extraMinutes: 260,
          absentDays: 1,
          onTimeLeave: 6,
          earlyLeave: 1,
        }}
        onMonthChange={({ month, year }) => fetchMonthStats(month, year)}
      />
    );
  }

  return (
    <HomeTelegram
      role="admin"
      branch={{
        name: "Главный офис",
        address: "ул. Амира Темура, 12",
        totalEmployees: 87,
        departmentCount: 6,
      }}
      stats={{
        total: 87,
        present: 62,
        absent: 18,
        late: 7,
        inside: 54,
        left: 8,
        leftEarly: 3,
        onTime: 6,
      }}
      departments={[
        { name: "Разработка", present: 16, total: 20 },
        { name: "Продажи", present: 13, total: 15 },
      ]}
    />
  );
};

export default HomePageTelegram;
