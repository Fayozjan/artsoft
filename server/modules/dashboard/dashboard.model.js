import { prismaContext } from "../../utils/prismaContext.js";

export const DashboardModel = {
  // ===== SUMMARY =====

  countBranches: async (where = {}) => {
    const prisma = prismaContext.get();
    return prisma.branches.count({ where: { status: true, ...where } });
  },

  countDepartments: async (where = {}) => {
    const prisma = prismaContext.get();
    return prisma.departments.count({ where: { status: true, ...where } });
  },

  countEmployees: async (where = {}) => {
    const prisma = prismaContext.get();
    return prisma.employees.count({ where: { status: true, ...where } });
  },

  countCheckedInToday: async (dayStart, dayEnd, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        direction: "entry",
        employee: { status: true, ...employeeWhere },
      },
      select: { employee_id: true },
      distinct: ["employee_id"],
    });
    return passes.length;
  },

  countCheckedOutToday: async (dayStart, dayEnd, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        direction: "exit",
        employee: { status: true, ...employeeWhere },
      },
      select: { employee_id: true },
      distinct: ["employee_id"],
    });
    return passes.length;
  },

  countTimeOffToday: async (dayStart, dayEnd, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    return prisma.time_off.count({
      where: {
        date_from: { lte: dayEnd },
        date_to: { gte: dayStart },
        employee: { status: true, ...employeeWhere },
      },
    });
  },

  countVehiclePassesToday: async (dayStart, dayEnd) => {
    const prisma = prismaContext.get();
    return prisma.vehicle_passes.count({
      where: { date: { gte: dayStart, lte: dayEnd } },
    });
  },

  countLateToday: async (dayStart, dayEnd, lateHour = 9, lateMinute = 30, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const lateThreshold = new Date(dayStart);
    lateThreshold.setHours(lateHour, lateMinute, 0, 0);
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        direction: "entry",
        employee: { status: true, ...employeeWhere },
      },
      orderBy: { date: "asc" },
      select: { employee_id: true, date: true },
    });
    const firstEntries = {};
    for (const p of passes) {
      if (!firstEntries[p.employee_id]) firstEntries[p.employee_id] = p.date;
    }
    return Object.values(firstEntries).filter((d) => new Date(d) > lateThreshold).length;
  },

  countPositions: async () => {
    const prisma = prismaContext.get();
    return prisma.positions.count({ where: { status: true } });
  },

  countCurrentlyOnSite: async (dayStart, dayEnd, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        employee: { status: true, ...employeeWhere },
      },
      orderBy: { date: "asc" },
      select: { employee_id: true, direction: true },
    });
    const lastAction = {};
    for (const p of passes) lastAction[p.employee_id] = p.direction;
    return Object.values(lastAction).filter((d) => d === "entry").length;
  },

  // ===== ANALYTICS =====

  dailyAttendance: async (days, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const results = await Promise.all(
      days.map(async ({ start, end, label }) => {
        const passes = await prisma.face_passes.findMany({
          where: {
            date: { gte: start, lte: end },
            direction: "entry",
            employee: { status: true, ...employeeWhere },
          },
          select: { employee_id: true },
          distinct: ["employee_id"],
        });
        return { date: label, count: passes.length };
      })
    );
    return results;
  },

  employeesByBranch: async (employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const groups = await prisma.employees.groupBy({
      by: ["branch_id"],
      where: { status: true, ...employeeWhere },
      _count: { id: true },
    });

    if (!groups.length) return [];

    const branchIds = groups.map((g) => g.branch_id).filter(Boolean);
    const branches = await prisma.branches.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });

    const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

    return groups
      .map((g) => ({
        branch: branchMap[g.branch_id] || "—",
        count: g._count.id,
      }))
      .sort((a, b) => b.count - a.count);
  },

  employeesByDepartment: async (employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const groups = await prisma.employees.groupBy({
      by: ["department_id"],
      where: { status: true, ...employeeWhere },
      _count: { id: true },
    });

    if (!groups.length) return [];

    const deptIds = groups.map((g) => g.department_id).filter(Boolean);
    const departments = await prisma.departments.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true },
    });

    const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

    return groups
      .map((g) => ({
        department: deptMap[g.department_id] || "—",
        count: g._count.id,
      }))
      .sort((a, b) => b.count - a.count);
  },

  doorTrafficByHour: async (dayStart, dayEnd, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        employee: { status: true, ...employeeWhere },
      },
      select: { date: true, direction: true },
    });

    const hourMap = {};
    for (let h = 5; h <= 22; h++) {
      hourMap[h] = { hour: `${String(h).padStart(2, "0")}:00`, entry: 0, exit: 0 };
    }

    for (const p of passes) {
      const hour = new Date(p.date).getHours();
      if (hourMap[hour]) {
        if (p.direction === "entry") hourMap[hour].entry++;
        else if (p.direction === "exit") hourMap[hour].exit++;
      }
    }

    return Object.values(hourMap);
  },

  vehicleTrafficByHour: async (dayStart, dayEnd) => {
    const prisma = prismaContext.get();
    let passes = await prisma.vehicle_passes.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      select: { date: true, direction: true },
    });

    if (!passes.length) {
      const latest = await prisma.vehicle_passes.findFirst({
        orderBy: { date: "desc" },
        select: { date: true },
      });
      if (latest) {
        const d = new Date(latest.date);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(start.getTime() + 86400000 - 1);
        passes = await prisma.vehicle_passes.findMany({
          where: { date: { gte: start, lte: end } },
          select: { date: true, direction: true },
        });
      }
    }

    const hourMap = {};
    for (let h = 5; h <= 22; h++) {
      hourMap[h] = { hour: `${String(h).padStart(2, "0")}:00`, entry: 0, exit: 0 };
    }

    for (const p of passes) {
      const hour = new Date(p.date).getHours();
      if (hourMap[hour]) {
        if (p.direction === "entry" || p.direction === "forward") hourMap[hour].entry++;
        else if (p.direction === "exit" || p.direction === "reverse") hourMap[hour].exit++;
      }
    }

    return Object.values(hourMap);
  },

  hiringDynamics: async (months) => {
    const prisma = prismaContext.get();
    const results = await Promise.all(
      months.map(async ({ start, end, label }) => {
        const [hired, terminated] = await Promise.all([
          prisma.employment_orders.count({
            where: { date: { gte: start, lte: end }, type: "hire" },
          }),
          prisma.employment_orders.count({
            where: { date: { gte: start, lte: end }, type: "terminate" },
          }),
        ]);
        return { month: label, hired, terminated };
      })
    );
    return results;
  },

  topDepartmentsByActivity: async (dayStart, dayEnd, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        direction: "entry",
        employee: { status: true, ...employeeWhere },
      },
      select: { employee: { select: { department_id: true } } },
    });

    if (!passes.length) return [];

    const deptCount = {};
    for (const p of passes) {
      const dId = p.employee?.department_id;
      if (dId) deptCount[dId] = (deptCount[dId] || 0) + 1;
    }

    const deptIds = Object.keys(deptCount).map(Number);
    const departments = await prisma.departments.findMany({
      where: { id: { in: deptIds } },
      select: { id: true, name: true, branch_id: true },
    });

    const deptMap = Object.fromEntries(
      departments.map((d) => [d.id, { name: d.name, branchId: d.branch_id }])
    );

    return Object.entries(deptCount)
      .map(([id, count]) => ({
        department: deptMap[Number(id)]?.name || "—",
        branchId: deptMap[Number(id)]?.branchId ?? null,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  },

  branchActivity: async (dayStart, dayEnd, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        employee: { status: true, ...employeeWhere },
      },
      select: { employee: { select: { branch_id: true } } },
    });

    if (!passes.length) return [];

    const branchCount = {};
    for (const p of passes) {
      const bId = p.employee?.branch_id;
      if (bId) branchCount[bId] = (branchCount[bId] || 0) + 1;
    }

    const branchIds = Object.keys(branchCount).map(Number);
    const branches = await prisma.branches.findMany({
      where: { id: { in: branchIds } },
      select: { id: true, name: true },
    });

    const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

    return Object.entries(branchCount)
      .map(([id, count]) => ({ branchId: Number(id), branch: branchMap[Number(id)] || "—", count }))
      .sort((a, b) => b.count - a.count);
  },

  // ===== FEEDS =====

  recentFacePasses: async (limit = 10, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    return prisma.face_passes.findMany({
      where: { employee: { status: true, ...employeeWhere } },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        date: true,
        direction: true,
        photo: true,
        door: { select: { id: true, name: true } },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            photo: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
  },

  recentVehiclePasses: async (limit = 10) => {
    const prisma = prismaContext.get();
    return prisma.vehicle_passes.findMany({
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        date: true,
        plate_number: true,
        photo: true,
        direction: true,
        gate: { select: { id: true, name: true } },
      },
    });
  },

  vehiclePassesToday: async (dayStart, dayEnd, limit = 20) => {
    const prisma = prismaContext.get();
    return prisma.vehicle_passes.findMany({
      where: { date: { gte: dayStart, lte: dayEnd } },
      orderBy: { date: "desc" },
      take: limit,
      select: {
        id: true,
        date: true,
        plate_number: true,
        photo: true,
        direction: true,
        gate: { select: { id: true, name: true } },
      },
    });
  },

  upcomingBirthdays: async (limit = 7, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const employees = await prisma.employees.findMany({
      where: { status: true, ...employeeWhere, date_of_birth: { not: null } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        middle_name: true,
        date_of_birth: true,
        photo: true,
        branch: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return employees
      .filter((e) => e.date_of_birth)
      .map((e) => {
        const dob = new Date(e.date_of_birth);
        let bday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        if (bday < today) {
          bday = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
        }
        const daysLeft = Math.round((bday - today) / 86400000);
        return { ...e, daysLeft };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, limit);
  },

  topLateArrivals: async (dayStart, dayEnd, limit = 5, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        direction: "entry",
        employee: { status: true, ...employeeWhere },
      },
      orderBy: { date: "asc" },
      select: {
        employee_id: true,
        date: true,
        employee: {
          select: {
            first_name: true, last_name: true, photo: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    const seen = new Set();
    const firstEntries = [];
    for (const p of passes) {
      if (!seen.has(p.employee_id)) {
        seen.add(p.employee_id);
        firstEntries.push(p);
      }
    }

    return firstEntries
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, limit)
      .map((p) => ({
        employee_id: p.employee_id,
        arrivalTime: p.date,
        employee: p.employee,
      }));
  },

  topEarlyDepartures: async (dayStart, dayEnd, limit = 5, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const passes = await prisma.face_passes.findMany({
      where: {
        date: { gte: dayStart, lte: dayEnd },
        direction: "exit",
        employee: { status: true, ...employeeWhere },
      },
      orderBy: { date: "desc" },
      select: {
        employee_id: true,
        date: true,
        employee: {
          select: {
            first_name: true, last_name: true, photo: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    const seen = new Set();
    const lastExits = [];
    for (const p of passes) {
      if (!seen.has(p.employee_id)) {
        seen.add(p.employee_id);
        lastExits.push(p);
      }
    }

    return lastExits
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, limit)
      .map((p) => ({
        employee_id: p.employee_id,
        departureTime: p.date,
        employee: p.employee,
      }));
  },

  employeesByPosition: async (employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const groups = await prisma.employees.groupBy({
      by: ["position_id"],
      where: { status: true, ...employeeWhere },
      _count: { id: true },
    });

    if (!groups.length) return [];

    const posIds = groups.map((g) => g.position_id).filter(Boolean);
    const positions = await prisma.positions.findMany({
      where: { id: { in: posIds } },
      select: { id: true, name: true },
    });

    const posMap = Object.fromEntries(positions.map((p) => [p.id, p.name]));

    return groups
      .map((g) => ({
        position: posMap[g.position_id] || "—",
        count: g._count.id,
      }))
      .sort((a, b) => b.count - a.count);
  },

  // ===== FINANCE =====

  financeStats: async (employeeWhere = {}) => {
    const prisma = prismaContext.get();

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const currentSheet = await prisma.payroll_sheets.findFirst({
      where: { month: currentMonth, year: currentYear },
    });

    let payrollFund = 0, payrollPaid = 0, maxSalary = 0, minSalary = 0;
    let latestSheetMonth = null, latestSheetYear = null;

    if (currentSheet) {
      latestSheetMonth = currentSheet.month;
      latestSheetYear = currentSheet.year;
      const itemWhere = {
        sheet_id: currentSheet.id,
        ...(Object.keys(employeeWhere).length ? { employee: { status: true, ...employeeWhere } } : {}),
      };
      const [sheetAgg, minMaxAgg] = await Promise.all([
        prisma.payroll_sheet_items.aggregate({
          where: itemWhere,
          _sum: { net: true, paid_amount: true },
        }),
        prisma.payroll_sheet_items.aggregate({
          where: { ...itemWhere, status: "approved", net: { gt: 0 } },
          _max: { net: true },
          _min: { net: true },
        }),
      ]);
      payrollFund = Number(sheetAgg._sum.net || 0);
      payrollPaid = Number(sheetAgg._sum.paid_amount || 0);
      maxSalary   = Number(minMaxAgg._max.net || 0);
      minSalary   = Number(minMaxAgg._min.net || 0);
    }

    const empRows = await prisma.employees.findMany({
      where: { status: true, ...employeeWhere },
      select: {
        employeeSalaryHistory: {
          orderBy: { date_from: "desc" },
          take: 1,
          select: { amount: true },
        },
      },
    });

    const amounts = empRows
      .map((e) => e.employeeSalaryHistory[0]?.amount)
      .filter((a) => a != null)
      .map(Number)
      .filter((a) => a > 0);

    const avgSalary = amounts.length
      ? Math.round(amounts.reduce((s, a) => s + a, 0) / amounts.length)
      : 0;

    return {
      payrollFund,
      payrollPaid,
      payrollRemaining: Math.max(0, payrollFund - payrollPaid),
      averageSalary: avgSalary,
      maxSalary,
      minSalary,
      latestSheetMonth,
      latestSheetYear,
    };
  },

  recentPayments: async (limit = 10, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const where = Object.keys(employeeWhere).length
      ? { item: { employee: { status: true, ...employeeWhere } } }
      : {};
    return prisma.payroll_payment_logs.findMany({
      where,
      orderBy: { payment_date: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        payment_date: true,
        note: true,
        item: {
          select: {
            employee: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                middle_name: true,
                branch: { select: { name: true } },
                department: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  },

  recentAdvances: async (limit = 10, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    return prisma.salary_advances.findMany({
      where: { employee: { status: true, ...employeeWhere } },
      orderBy: { advance_date: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        advance_date: true,
        note: true,
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
  },

  salaryByBranch: async (employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const employees = await prisma.employees.findMany({
      where: { status: true, ...employeeWhere },
      select: {
        branch_id: true,
        branch: { select: { name: true } },
        employeeSalaryHistory: {
          orderBy: { date_from: "desc" },
          take: 1,
          select: { amount: true },
        },
      },
    });

    const map = {};
    for (const emp of employees) {
      const amount = Number(emp.employeeSalaryHistory[0]?.amount || 0);
      if (!amount || !emp.branch_id) continue;
      if (!map[emp.branch_id]) map[emp.branch_id] = { branch: emp.branch?.name || "—", total: 0 };
      map[emp.branch_id].total += amount;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  },

  salaryByDept: async (employeeWhere = {}) => {
    const prisma = prismaContext.get();
    const employees = await prisma.employees.findMany({
      where: { status: true, ...employeeWhere },
      select: {
        department_id: true,
        department: { select: { name: true } },
        employeeSalaryHistory: {
          orderBy: { date_from: "desc" },
          take: 1,
          select: { amount: true },
        },
      },
    });

    const map = {};
    for (const emp of employees) {
      const amount = Number(emp.employeeSalaryHistory[0]?.amount || 0);
      if (!amount || !emp.department_id) continue;
      if (!map[emp.department_id]) map[emp.department_id] = { department: emp.department?.name || "—", total: 0 };
      map[emp.department_id].total += amount;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  },

  hiringDynamicsByDay: async (days) => {
    const prisma = prismaContext.get();
    const results = await Promise.all(
      days.map(async ({ start, end, label }) => {
        const [hired, terminated] = await Promise.all([
          prisma.employment_orders.count({
            where: { date: { gte: start, lte: end }, type: "hire" },
          }),
          prisma.employment_orders.count({
            where: { date: { gte: start, lte: end }, type: "terminate" },
          }),
        ]);
        return { date: label, hired, terminated };
      })
    );
    return results;
  },

  recentTimeOffs: async (limit = 10, employeeWhere = {}) => {
    const prisma = prismaContext.get();
    return prisma.time_off.findMany({
      where: { employee: { status: true, ...employeeWhere } },
      orderBy: { id: "desc" },
      take: limit,
      select: {
        id: true,
        reason: true,
        type: true,
        date_from: true,
        date_to: true,
        added_at: true,
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            branch: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
    });
  },
};
