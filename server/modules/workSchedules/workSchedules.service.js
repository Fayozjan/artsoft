import { prismaContext } from "../../utils/prismaContext.js";
import { mapShifts, mapWorkDays } from "./workSchedules.helpers.js";
import { workScheduleModel } from "./workSchedules.model.js";

export const workScheduleService = {
  create: async (data, tx = null) => {
    const prisma = tx || prismaContext.get();

    const preparedData = {
      name: data.name?.trim() || "Без названия",
      status: data.status ?? true,
      type: data.type, // fixed | shift | flexible
      weekly_days: Number(data.weekly_days) || null,
      weekly_hours: Number(data.weekly_hours) || null,
    };

    // 🔹 Fixed график
    if (data.type === "fixed") {
      preparedData.work_days = mapWorkDays(data.work_days, data.weekly_days);
      preparedData.shifts = null;
    }

    // 🔹 Shift график
    if (data.type === "shift") {
      preparedData.shifts = (data.shifts || [])
        .filter((s) => s.start || s.end)
        .map((s) => ({
          shift_number: s.shift_number,
          start: s.start || "",
          end: s.end || "",
          break_minutes: Number(s.break_minutes) || 0,
        }));
      preparedData.work_days = null;
      preparedData.weekly_days = null;
    }

    // 🔹 Flexible график
    if (data.type === "shift") {
      preparedData.shifts = mapShifts(data.shifts);
      preparedData.work_days = null;
      preparedData.weekly_days = null;
    }

    return workScheduleModel.create(preparedData, prisma);
  },

  getAll: async ({ page = 1, pageSize = 50, filters } = {}, tx = null) => {
    const prisma = tx || prismaContext.get();

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const size = Math.max(parseInt(pageSize, 10) || 50, 1);
    const skip = (currentPage - 1) * size;

    const { search, status } = filters || {};
    const where = {};

    if (
      search !== undefined &&
      search !== null &&
      String(search).trim() !== ""
    ) {
      const q = String(search).trim();
      const maybeId = Number(q);
      const or = [{ name: { contains: q, mode: "insensitive" } }];
      if (!Number.isNaN(maybeId) && Number.isFinite(maybeId)) {
        or.push({ id: maybeId });
      }
      where.OR = or;
    }

    if (status !== undefined && status !== "") {
      where.status = status === "true";
    }

    const { schedules, total } = await workScheduleModel.findAll(
      { skip, take: size, where },
      prisma,
    );

    const data = schedules.map((s) => ({
      ...s,
      employee_count: s._count?.employees ?? 0,
    }));

    return {
      data,
      pagination: {
        currentPage,
        totalPages: Math.ceil(total / size),
        totalItems: total,
        pageSize: size,
      },
    };
  },

  getActive: async (tx = null) => {
    const prisma = tx || prismaContext.get();
    return workScheduleModel.findActive(prisma);
  },

  getById: async (id, tx = null) => {
    const prisma = tx || prismaContext.get();
    const schedule = await workScheduleModel.findById(id, prisma);
    if (!schedule) return null;
    return schedule;
  },

  updateById: async (id, data, tx = null) => {
    const prisma = tx || prismaContext.get();

    const preparedData = {
      name: data.name?.trim() || "Без названия",
      status: Boolean(
        data.status === true || data.status === "true" || data.status === 1,
      ),
      type: data.type, // fixed | shift | flexible
      weekly_days: Number(data.weekly_days) || null,
      weekly_hours: Number(data.weekly_hours) || null,
    };

    if (data.type === "fixed") {
      preparedData.work_days = mapWorkDays(data.work_days, data.weekly_days);
      preparedData.shifts = null;
    }

    if (data.type === "shift") {
      preparedData.shifts = mapShifts(data.shifts);
      preparedData.work_days = null;
      preparedData.weekly_days = null;
    }

    if (data.type === "flexible") {
      prepared.work_days = null;
      prepared.shifts = null;
      prepared.weekly_days = null;
    }

    return workScheduleModel.updateById(id, preparedData, prisma);
  },

  deleteById: async (id, tx = null) => {
    if (!id) throw new Error("ID не передан");
    const prisma = tx || prismaContext.get();
    return workScheduleModel.deleteById(id, prisma);
  },
};
