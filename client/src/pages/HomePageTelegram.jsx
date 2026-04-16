import { useState, useEffect, useCallback, useRef } from "react";
import HomeTelegram from "../components/HomeTelegram";
import Loading from "../components/Loading";
import { useAuthStore } from "../stores/authStore";
import { getAttendance, getAttendanceByEmployeeId } from "../api/attendance";
import { getActiveBranches } from "../api/branches";

// ─── Helpers (employee stats) ────────────────────────────────────────────────

const parseDuration = (str) => {
  if (!str) return 0;
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
};

const getActiveScheduleHistory = (history = [], refDate = new Date()) => {
  if (!history?.length) return null;
  return (
    [...history]
      .sort((a, b) => new Date(b.date_from) - new Date(a.date_from))
      .find((h) => {
        const from = new Date(h.date_from);
        const to = h.date_to ? new Date(h.date_to) : null;
        return from <= refDate && (!to || to >= refDate);
      }) || null
  );
};

const buildMonthStats = (month, referenceDate) => {
  const sessions = month?.sessions || {};
  const sessionList = Object.values(sessions);
  const totalMinutes = sessionList.reduce(
    (s, sess) => s + parseDuration(sess.workDuration),
    0,
  );
  const earlyLeaveCount = sessionList.filter(
    (s) => s.earlyLeave && s.earlyLeave !== "00:00",
  ).length;
  const earlyLeaveMinutes = sessionList.reduce(
    (s, sess) => s + parseDuration(sess.earlyLeave || "00:00"),
    0,
  );
  const onTimeLeaveCount = sessionList.filter(
    (s) =>
      s.lastExit &&
      (!s.earlyLeave || s.earlyLeave === "00:00") &&
      (!s.lateLeave || s.lateLeave === "00:00"),
  ).length;
  const lateTotalMinutes = sessionList.reduce(
    (s, sess) => s + parseDuration(sess.late || "00:00"),
    0,
  );
  const lateLeaveCount = sessionList.filter(
    (s) => s.lateLeave && s.lateLeave !== "00:00",
  ).length;
  const lateLeaveMinutes = sessionList.reduce(
    (s, sess) => s + parseDuration(sess.lateLeave || "00:00"),
    0,
  );
  const lateCount = sessionList.filter(
    (s) => s.late && s.late !== "00:00",
  ).length;
  const breakReturnLateCount = sessionList.filter(
    (s) => s.breakReturnLate && s.breakReturnLate !== "00:00",
  ).length;
  const breakReturnLateMinutes = sessionList.reduce(
    (s, sess) => s + parseDuration(sess.breakReturnLate || "00:00"),
    0,
  );
  const todayKey = referenceDate.toISOString().slice(0, 10);
  const pastNoExitCount = Object.entries(sessions).filter(
    ([date, s]) => !s.lastExit && s.hadAttendance && date !== todayKey,
  ).length;

  const workedDays = month.workedDays ?? 0;
  const scheduledDays = month.scheduledDays ?? 0;
  const scheduledDaysToDate = month.scheduledDaysToDate ?? scheduledDays;
  const scheduledMinutes = month.scheduledMinutes ?? 0;

  return {
    workedDays,
    totalDays: scheduledDays,
    totalMinutes,
    scheduledMinutes,
    lateCount,
    lateTotalMinutes,
    extraMinutes: 0,
    absentDays: Math.max(0, scheduledDaysToDate - workedDays),
    onTimeLeave: onTimeLeaveCount,
    earlyLeave: earlyLeaveCount,
    earlyLeaveMinutes,
    lateLeaveCount,
    lateLeaveMinutes,
    breakReturnLateCount,
    breakReturnLateMinutes,
    pastNoExitCount,
  };
};

// ─── Admin data mapper ───────────────────────────────────────────────────────

const mapBranchAttendance = (data, branchId, branchInfo) => {
  const employees = data.employees || [];
  const present = data.present || [];
  const absent = data.absent || [];
  const late = data.late || [];
  const inside = data.inside || [];
  const left = data.left || [];

  const branch =
    data.branches?.find((b) => b.id === branchId) || branchInfo || {};

  // server returns branchId (camelCase) from getActiveDepartments
  const branchDepts = (data.departments || []).filter(
    (d) => (d.branchId ?? d.branch_id) === branchId,
  );

  const departments = branchDepts
    .map((dept) => {
      // employees only have departmentName (no department_id in formatted shape)
      const totalInDept = employees.filter(
        (e) => e.departmentName === dept.name,
      ).length;
      const presentInDept = present.filter(
        (e) => e.departmentName === dept.name,
      ).length;
      return {
        id: dept.id,
        name: dept.name,
        present: presentInDept,
        total: totalInDept,
      };
    })
    .filter((d) => d.total > 0);

  return {
    branch: {
      id: branch.id,
      name: branch.name || "—",
      address: branch.address || "—",
      totalEmployees: employees.length,
      departmentCount: branchDepts.length,
    },
    stats: {
      total: employees.length,
      present: present.length,
      absent: absent.length,
      late: late.length,
      inside: inside.length,
      left: left.length,
    },
    departments,
    employeeLists: { all: employees, present, absent, late, inside, left },
  };
};

// ─── Page ────────────────────────────────────────────────────────────────────

const HomePageTelegram = () => {
  const { access, userSettings } = useAuthStore();
  const isEmployee =
    access?.access_level === "employee" ||
    access?.personal_menus?.includes("home");

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // ── Employee state ──────────────────────────────────────────────────────────
  const [empInfo, setEmpInfo] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [monthStats, setMonthStats] = useState(null);

  // ── Admin state ─────────────────────────────────────────────────────────────
  const [adminLoading, setAdminLoading] = useState(false);
  const [availableBranches, setAvailableBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [branchData, setBranchData] = useState(null);
  const [allBranchesData, setAllBranchesData] = useState(null);

  const viewMode = userSettings?.viewMode || "branch";
  const adminInitialized = useRef(false);

  // init branches list + default selected branch (runs once when access loads)
  useEffect(() => {
    if (isEmployee || !access || adminInitialized.current) return;
    adminInitialized.current = true;

    const defaultId =
      userSettings?.activeBranchId || access.branches?.[0]?.id || null;

    if (access.branches?.length > 0) {
      setAvailableBranches(access.branches);
      setSelectedBranchId(defaultId);
    } else {
      // super-admin: no branch restriction → fetch all active branches
      getActiveBranches().then((res) => {
        const branches = res.data || [];
        setAvailableBranches(branches);
        setSelectedBranchId(defaultId || branches[0]?.id || null);
      });
    }
  }, [access, isEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch branch-mode data
  useEffect(() => {
    if (isEmployee || viewMode !== "branch" || !selectedBranchId) return;

    setAdminLoading(true);
    getAttendance({ filters: { date: todayStr, branch_id: selectedBranchId } })
      .then((res) => {
        const branchInfo = availableBranches.find(
          (b) => b.id === selectedBranchId,
        );
        setBranchData(mapBranchAttendance(res.data, selectedBranchId, branchInfo));
      })
      .finally(() => setAdminLoading(false));
  }, [isEmployee, viewMode, selectedBranchId, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch absolute-mode data
  useEffect(() => {
    if (isEmployee || viewMode !== "absolute" || !availableBranches.length) return;

    setAdminLoading(true);
    Promise.all(
      availableBranches.map((b) =>
        getAttendance({ filters: { date: todayStr, branch_id: b.id } }).then(
          (res) => mapBranchAttendance(res.data, b.id, b),
        ),
      ),
    )
      .then(setAllBranchesData)
      .finally(() => setAdminLoading(false));
  }, [isEmployee, viewMode, availableBranches, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Employee data fetching ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isEmployee || !access?.employee_id) return;

    getAttendanceByEmployeeId(access.employee_id, { date: todayStr }).then(
      (res) => {
        const { employee, today: todayData, month } = res.data;

        const fullName = [
          employee.last_name,
          employee.first_name,
          employee.middle_name,
        ]
          .filter(Boolean)
          .join(" ");
        const activeHistory = getActiveScheduleHistory(
          employee.employeeScheduleHistory,
        );
        const schedule = activeHistory?.workSchedule?.name || "—";
        setEmpInfo({
          id: employee.id,
          name: fullName,
          photo: employee.photo,
          position: employee.position?.name,
          department: employee.department?.name,
          branch: employee.branch?.name,
          schedule,
        });

        const todaySession = todayData.sessions?.[todayData.date];

        let status = "absent";

        if (todaySession) {
          const lastEvent =
            todaySession.events && todaySession.events.length > 0
              ? todaySession.events[todaySession.events.length - 1]
              : null;

          if (lastEvent && lastEvent.direction === "entry") {
            status = "inside";
          } else if (!todaySession.lastExit) {
            status = "inside";
          } else if (
            todaySession.earlyLeave &&
            todaySession.earlyLeave !== "00:00"
          ) {
            status = "leftEarly";
          } else {
            status = "left";
          }
        }

        setShiftData({
          status,
          checkIn: todaySession?.firstEntry ?? null,
          checkOut: todaySession?.lastExit ?? null,
          workDuration: todaySession?.workDuration ?? null,
          scheduledIn: todaySession.scheduleStart ?? null,
          scheduledOut: todaySession.scheduleEnd ?? null,
          late: todaySession.late ?? null,
          breakReturnLate: todaySession.breakReturnLate ?? null,
          lateLeave: todaySession.lateLeave,
        });

        setMonthStats(buildMonthStats(month, today));
      },
    );
  }, [isEmployee, access?.employee_id, todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMonthChange = useCallback(
    ({ month, year }) => {
      if (!access?.employee_id) return;
      const refDate = new Date(`${year}-${String(month).padStart(2, "0")}-15`);
      const dateParam = refDate.toISOString().slice(0, 10);
      getAttendanceByEmployeeId(access.employee_id, { date: dateParam }).then(
        (res) => {
          const { month: monthData } = res.data;
          setMonthStats(buildMonthStats(monthData, refDate));
        },
      );
    },
    [access?.employee_id],
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!access) return <Loading />;

  if (isEmployee) {
    return (
      <HomeTelegram
        role="employee"
        employee={empInfo}
        shift={shiftData}
        monthStats={monthStats}
        onMonthChange={handleMonthChange}
      />
    );
  }

  return (
    <HomeTelegram
      role="admin"
      viewMode={viewMode}
      loading={adminLoading}
      // branch mode
      branch={branchData?.branch}
      stats={branchData?.stats}
      departments={branchData?.departments}
      employeeLists={branchData?.employeeLists}
      branches={availableBranches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      // absolute mode
      allBranchesData={allBranchesData}
    />
  );
};

export default HomePageTelegram;
