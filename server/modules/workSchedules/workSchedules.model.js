import prisma from "../../prisma/client.js";

export const create = async (data) => {
  return prisma.work_schedules.create({
    data,
  });
};

export const updateWorkScheduleForMany = async (employeeIds, scheduleId) => {
  return prisma.employees.updateMany({
    where: { id: { in: employeeIds } },
    data: { work_schedule_id: Number(scheduleId) },
  });
};

export const clearWorkSchedule = async (scheduleId) => {
  return prisma.employees.updateMany({
    where: { work_schedule_id: Number(scheduleId) },
    data: { work_schedule_id: null },
  });
};

export const getWorkSchedules = async ({
  skip = 0,
  take = 50,
  where = {},
} = {}) => {
  const [schedules, total] = await Promise.all([
    prisma.work_schedules.findMany({
      skip,
      take,
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    }),
    prisma.work_schedules.count({ where }),
  ]);

  return { schedules, total };
};

export const getActiveWorkSchedules = async () => {
  const schedules = await prisma.work_schedules.findMany({
    where: { status: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      shift_type: true,
      first_shift_start: true,
      first_shift_end: true,
      second_shift_start: true,
      second_shift_end: true,
      third_shift_start: true,
      third_shift_end: true,
      shift_start: true,
      shift_end: true,
      break_minutes: true,
      valid_from: true,
    },
  });

  return schedules.map((s) => ({
    ...s,
    valid_from: s.valid_from.toLocaleDateString("ru-RU", {
      timeZone: "Asia/Tashkent",
    }),
  }));
};

export const getWorkScheduleById = async (id) => {
  return prisma.work_schedules.findUnique({
    where: { id: Number(id) },
    include: {
      employees: {
        select: { id: true },
      },
    },
  });
};

export const update = async (id, data) => {
  return prisma.work_schedules.update({
    where: { id: Number(id) },
    data,
  });
};

export const deleteWorkSchedule = async (id) => {
  return prisma.work_schedules.delete({
    where: { id: Number(id) },
  });
};
