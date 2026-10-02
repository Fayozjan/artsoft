import { prismaContext } from "../../utils/prismaContext.js";
import dotenv from "dotenv";
import { parseDateOnly } from "./employee.helpers.js";

dotenv.config();

export async function addEmployeeRaw(body) {
  const prisma = prismaContext.get();

  const { id, first_name, branch_id, status } = body;

  if (!Number.isInteger(id)) {
    throw new Error(`addEmployeeRaw: некорректный id: ${id}`);
  }

  // ON CONFLICT — вставка идемпотентна: параллельные вызовы для одного id
  // не падают с 23505, а просто ничего не делают
  const inserted = await prisma.$executeRaw`
    INSERT INTO employees (id, first_name, branch_id, status)
    VALUES (${id}, ${first_name}, ${branch_id}, ${status})
    ON CONFLICT (id) DO NOTHING
  `;

  if (inserted > 0) {
    // явный id не двигает sequence автоинкремента —
    // синхронизируем, иначе обычный create позже упадёт с тем же 23505
    await prisma.$queryRaw`
      SELECT setval(
        pg_get_serial_sequence('employees', 'id'),
        GREATEST((SELECT MAX(id) FROM employees), 1)
      )
    `;
  }

  return inserted > 0;
}

export const EmployeeModel = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();
    return prisma.employees.create({ data });
  },

  update: async (id, data) => {
    const prisma = prismaContext.get();

    return prisma.employees.update({
      where: { id: Number(id) },
      data,
    });
  },

  getAll: async (where = {}, skip = 0, take = 50, sort_by = "last_name", sort_order = "asc") => {
    const prisma = prismaContext.get();

    const order = sort_order === "desc" ? "desc" : "asc";
    const SORT_MAP = {
      last_name:       { last_name: order },
      employee_number: { employee_number: order },
      status:          { status: order },
      date_of_birth:   { date_of_birth: order },
      branch:          { branch: { name: order } },
      department:      { department: { name: order } },
      position:        { position: { name: order } },
    };
    const orderBy = SORT_MAP[sort_by] ?? { last_name: order };

    const [data, total] = await Promise.all([
      prisma.employees.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          branch: true,
          department: true,
          position: true,
          workSchedule: true,
        },
      }),
      prisma.employees.count({ where }),
    ]);

    return { data, total };
  },

  // Уволенные для повторного приёма — список: минимум полей, последний приказ даёт дату увольнения
  findRehireCandidates: async (where, take) => {
    const prisma = prismaContext.get();

    const [data, total] = await Promise.all([
      prisma.employees.findMany({
        where,
        take,
        orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
        select: {
          id: true,
          last_name: true,
          first_name: true,
          middle_name: true,
          pinfl: true,
          photo: true,
          branch: { select: { name: true } },
          department: { select: { name: true } },
          position: { select: { name: true } },
          employmentOrders: {
            orderBy: { date: "desc" },
            take: 1,
            select: { type: true, date: true },
          },
        },
      }),
      prisma.employees.count({ where }),
    ]);

    return { data, total };
  },

  // Данные уволенного для формы приёма — только личные и рабочие поля, без зарплат и истории
  findRehireCandidate: async (where) => {
    const prisma = prismaContext.get();

    return prisma.employees.findFirst({
      where,
      select: {
        id: true,
        status: true,
        employee_number: true,
        last_name: true,
        first_name: true,
        middle_name: true,
        gender: true,
        date_of_birth: true,
        pinfl: true,
        passport: true,
        passport_expiry_date: true,
        education: true,
        education_specialty: true,
        phone: true,
        email: true,
        address: true,
        photo: true,
        position_id: true,
        work_schedule_id: true,
        doors: { select: { id: true } },
        employmentOrders: {
          orderBy: { date: "desc" },
          take: 1,
          select: { type: true, date: true },
        },
      },
    });
  },

  getById: async (id) => {
    const prisma = prismaContext.get();

    return prisma.employees.findUnique({
      where: { id: Number(id) },
      include: {
        branch: true,
        department: true,
        position: true,
        employmentOrders: true,
        employeeScheduleHistory: {
          orderBy: { date_from: "asc" },
          include: {
            workSchedule: true,
            addedBy: {
              select: {
                id: true,
                employee: {
                  select: {
                    first_name: true,
                    last_name: true,
                    middle_name: true,
                  },
                },
              },
            },
          },
        },
        workSchedule: true,
        employeeSalaryHistory: {
          orderBy: { date_from: "desc" },
          include: {
            addedBy: {
              select: {
                id: true,
                employee: {
                  select: { first_name: true, last_name: true, middle_name: true },
                },
              },
            },
          },
        },
        doors: {
          include: { faceDevices: true },
        },
      },
    });
  },

  getActive: async (where) => {
    const prisma = prismaContext.get();

    return prisma.employees.findMany({
      where,
      orderBy: { last_name: "asc" },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        middle_name: true,
        employee_number: true,
        photo: true,
        branch: { select: { name: true } },
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
    });
  },

  getAllIds: async () => {
    const prisma = prismaContext.get();

    try {
      const employees = await prisma.employees.findMany({
        select: { id: true },
      });

      return employees.map((emp) => emp.id);
    } catch (err) {
      console.error("Ошибка при получении всех ID сотрудников:", err);
      throw err;
    }
  },

  getCurrentWorkSchedule: async (employeeId) => {
    const prisma = prismaContext.get();

    return prisma.employees.findUnique({
      where: { id: Number(employeeId) },
      select: {
        work_schedule_id: true,
        workSchedule: true,
      },
    });
  },

  updateWorkSchedule: async (
    employeeId,
    newScheduleId,
    userId,
    workScheduleStartDate,
  ) => {
    const prisma = prismaContext.get();

    const startDate = parseDateOnly(workScheduleStartDate);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() - 1);

    return prisma.$transaction(async (tx) => {
      const histories = await tx.employee_schedule_history.findMany({
        where: {
          employee_id: employeeId,
          OR: [{ date_to: null }, { date_to: { gte: startDate } }],
        },
        orderBy: { date_from: "asc" },
      });

      for (const h of histories) {
        if (h.date_to && h.date_to < startDate) continue;

        if (h.date_from < startDate && (!h.date_to || h.date_to >= startDate)) {
          await tx.employee_schedule_history.update({
            where: { id: h.id },
            data: { date_to: endDate },
          });
        } else if (h.date_from >= startDate) {
          await tx.employee_schedule_history.delete({
            where: { id: h.id },
          });
        }
      }

      return tx.employee_schedule_history.create({
        data: {
          employee_id: employeeId,
          work_schedule_id: newScheduleId,
          date_from: startDate,
          added_by: userId,
        },
      });
    });
  },

  // Полный профиль сотрудника: карточка + все истории одним запросом.
  // Каждая история отдаётся отсортированной от новых к старым — фронт
  // рисует их как есть, без пересортировки.
  getProfile: async (id) => {
    const prisma = prismaContext.get();
    const employeeId = Number(id);

    const addedBySelect = {
      select: {
        id: true,
        username: true,
        employee: {
          select: { first_name: true, last_name: true, middle_name: true },
        },
      },
    };

    const [
      employee,
      salaryHistory,
      scheduleHistory,
      employmentOrders,
      assetAssignments,
      payrollItems,
      timeOff,
      facePassesCount,
      firstPass,
      lastPass,
    ] = await Promise.all([
      prisma.employees.findUnique({
        where: { id: employeeId },
        include: {
          branch: true,
          department: true,
          position: true,
          workSchedule: true,
          doors: { select: { id: true, name: true, branch_id: true } },
          user: {
            select: {
              id: true,
              username: true,
              status: true,
              access_level: true,
              telegram_id: true,
            },
          },
        },
      }),

      prisma.employee_salary_history.findMany({
        where: { employee_id: employeeId },
        orderBy: [{ date_from: "desc" }, { id: "desc" }],
        include: { addedBy: addedBySelect },
      }),

      prisma.employee_schedule_history.findMany({
        where: { employee_id: employeeId },
        orderBy: [{ date_from: "desc" }, { id: "desc" }],
        include: { workSchedule: true, addedBy: addedBySelect },
      }),

      prisma.employment_orders.findMany({
        where: { employee_id: employeeId },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        include: { branch: true, department: true, position: true },
      }),

      prisma.asset_assignments.findMany({
        where: { employee_id: employeeId },
        orderBy: [{ assigned_date: "desc" }, { id: "desc" }],
        include: { addedBy: addedBySelect },
      }),

      // В профиле показываем только утверждённые начисления — черновики
      // ведомости к фактическим финансам сотрудника не относятся
      prisma.payroll_sheet_items.findMany({
        where: { employee_id: employeeId, status: "approved" },
        include: {
          sheet: { select: { id: true, month: true, year: true, status: true } },
          paymentLogs: { orderBy: { payment_date: "desc" } },
        },
      }),

      prisma.time_off.findMany({
        where: { employee_id: employeeId },
        orderBy: [{ date_from: "desc" }, { id: "desc" }],
        include: { addedBy: addedBySelect },
      }),

      prisma.face_passes.count({ where: { employee_id: employeeId } }),

      prisma.face_passes.findFirst({
        where: { employee_id: employeeId },
        orderBy: { date: "asc" },
        select: { date: true },
      }),

      prisma.face_passes.findFirst({
        where: { employee_id: employeeId },
        orderBy: { date: "desc" },
        select: { date: true, direction: true, door: { select: { name: true } } },
      }),
    ]);

    if (!employee) return null;

    // Prisma не сортирует по двум полям связи сразу — (year, month) досортировываем тут
    payrollItems.sort((a, b) => {
      const ya = a.sheet?.year ?? 0;
      const yb = b.sheet?.year ?? 0;
      if (ya !== yb) return yb - ya;
      return (b.sheet?.month ?? 0) - (a.sheet?.month ?? 0);
    });

    return {
      employee,
      salaryHistory,
      scheduleHistory,
      employmentOrders,
      assetAssignments,
      payrollItems,
      timeOff,
      attendance: {
        totalPasses: facePassesCount,
        firstPassAt: firstPass?.date ?? null,
        lastPassAt: lastPass?.date ?? null,
        lastPassDirection: lastPass?.direction ?? null,
        lastPassDoor: lastPass?.door?.name ?? null,
      },
    };
  },

  getDeleteImpact: async (id) => {
    const prisma = prismaContext.get();
    const employeeId = Number(id);

    const [
      employmentOrders,
      facePasses,
      timeOff,
      hasUser,
      payrollItems,
      tasksAssigned,
      directedBranches,
    ] = await Promise.all([
      prisma.employment_orders.count({ where: { employee_id: employeeId } }),
      prisma.face_passes.count({ where: { employee_id: employeeId } }),
      prisma.time_off.count({ where: { employee_id: employeeId } }),
      prisma.users.count({ where: { employee_id: employeeId } }),
      prisma.payroll_sheet_items.count({ where: { employee_id: employeeId } }),
      prisma.tasks.count({ where: { assignee_employee_id: employeeId } }),
      prisma.branches.count({ where: { director_id: employeeId } }),
    ]);

    return {
      employmentOrders,
      facePasses,
      timeOff,
      blockers: {
        hasUser: hasUser > 0,
        payrollItems,
        tasksAssigned,
        directedBranches,
      },
    };
  },

  // Сотрудники с текущим набором дверей — для массовых операций над дверями
  getManyWithDoors: async (ids) => {
    const prisma = prismaContext.get();

    return prisma.employees.findMany({
      where: { id: { in: ids.map(Number) } },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        middle_name: true,
        status: true,
        branch_id: true,
        department_id: true,
        position_id: true,
        doors: { select: { id: true } },
      },
    });
  },

  // Тот же расчёт, что и getDeleteImpact, но одним набором groupBy-запросов
  getBulkDeleteImpact: async (ids) => {
    const prisma = prismaContext.get();
    const employeeIds = ids.map(Number);

    const countBy = async (model, field) => {
      const rows = await prisma[model].groupBy({
        by: [field],
        where: { [field]: { in: employeeIds } },
        _count: { _all: true },
      });
      return new Map(rows.map((r) => [r[field], r._count._all]));
    };

    const [
      employmentOrders,
      facePasses,
      timeOff,
      users,
      payrollItems,
      tasksAssigned,
      directedBranches,
    ] = await Promise.all([
      countBy("employment_orders", "employee_id"),
      countBy("face_passes", "employee_id"),
      countBy("time_off", "employee_id"),
      countBy("users", "employee_id"),
      countBy("payroll_sheet_items", "employee_id"),
      countBy("tasks", "assignee_employee_id"),
      countBy("branches", "director_id"),
    ]);

    return employeeIds.reduce((acc, id) => {
      acc[id] = {
        employmentOrders: employmentOrders.get(id) || 0,
        facePasses: facePasses.get(id) || 0,
        timeOff: timeOff.get(id) || 0,
        blockers: {
          hasUser: (users.get(id) || 0) > 0,
          payrollItems: payrollItems.get(id) || 0,
          tasksAssigned: tasksAssigned.get(id) || 0,
          directedBranches: directedBranches.get(id) || 0,
        },
      };
      return acc;
    }, {});
  },

  delete: async (id) => {
    const prisma = prismaContext.get();
    const employeeId = Number(id);

    return prisma.$transaction(async (tx) => {
      await tx.face_passes.deleteMany({ where: { employee_id: employeeId } });
      await tx.employment_orders.deleteMany({ where: { employee_id: employeeId } });
      await tx.time_off.deleteMany({ where: { employee_id: employeeId } });

      return tx.employees.delete({ where: { id: employeeId } });
    });
  },
};
