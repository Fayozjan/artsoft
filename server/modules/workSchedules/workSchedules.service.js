import * as workScheduleModel from "./workSchedules.model.js";

export const addWorkSchedule = async (data) => {
  const isNormalShift = data.shift_type === "normal";

  const clean = (value) => (value === "" ? null : value);

  const preparedData = {
    name: data.name?.trim() || "Без названия",
    status: data.status ?? true,
    shift_type: data.shift_type,

    shift_start: isNormalShift ? clean(data.shift_start) : null,
    shift_end: isNormalShift ? clean(data.shift_end) : null,

    first_shift_start: !isNormalShift ? clean(data.first_shift_start) : null,
    first_shift_end: !isNormalShift ? clean(data.first_shift_end) : null,
    second_shift_start: !isNormalShift ? clean(data.second_shift_start) : null,
    second_shift_end: !isNormalShift ? clean(data.second_shift_end) : null,
    third_shift_start: !isNormalShift ? clean(data.third_shift_start) : null,
    third_shift_end: !isNormalShift ? clean(data.third_shift_end) : null,

    break_minutes:
      data.break_minutes === "" || data.break_minutes == null
        ? null
        : Number(data.break_minutes),

    valid_from: data.valid_from ? new Date(data.valid_from) : new Date(),
  };

  // 1️⃣ Создаём график
  const schedule = await workScheduleModel.create(preparedData);

  // 2️⃣ Назначаем график сотрудникам — через модель
  await workScheduleModel.updateWorkScheduleForMany(
    data.selectedEmployeeIds,
    schedule.id
  );

  return schedule;
};

export const getWorkSchedule = async (id) => {
  const schedule = await workScheduleModel.getWorkScheduleById(id);
  if (!schedule) return null;

  const formatDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return d.toISOString().substring(0, 10);
  };

  return {
    ...schedule,

    // форматируем только valid_from
    valid_from: formatDate(schedule.valid_from),

    // массив ID сотрудников
    selectedEmployeeIds: schedule.employees.map((e) => e.id),
  };
};

export const getWorkSchedules = async ({
  page = 1,
  pageSize = 50,
  filters,
}) => {
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const size = Math.max(parseInt(pageSize, 10) || 50, 1);
  const skip = (currentPage - 1) * size;

  const { search, status } = filters || {};

  // формируем where
  const where = {};
  if (search !== undefined && search !== null && String(search).trim() !== "") {
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

  // вызываем модель
  const { schedules, total } = await workScheduleModel.getWorkSchedules({
    skip,
    take: size,
    where,
  });

  // форматируем и считаем employee_count
  const data = schedules.map((s) => ({
    ...s,
    valid_from: s.valid_from
      ? s.valid_from.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" })
      : null,
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
};

export const updateWorkSchedule = async (id, data) => {
  const isNormalShift = data.shift_type === "normal";

  const clean = (v) => (v === "" ? null : v);

  const prepared = {
    name: data.name?.trim(),
    status: Boolean(
      data.status === true || data.status === "true" || data.status === 1
    ),
    shift_type: data.shift_type,

    shift_start: isNormalShift ? clean(data.shift_start) : null,
    shift_end: isNormalShift ? clean(data.shift_end) : null,

    first_shift_start: !isNormalShift ? clean(data.first_shift_start) : null,
    first_shift_end: !isNormalShift ? clean(data.first_shift_end) : null,
    second_shift_start: !isNormalShift ? clean(data.second_shift_start) : null,
    second_shift_end: !isNormalShift ? clean(data.second_shift_end) : null,
    third_shift_start: !isNormalShift ? clean(data.third_shift_start) : null,
    third_shift_end: !isNormalShift ? clean(data.third_shift_end) : null,

    break_minutes:
      data.break_minutes === "" || data.break_minutes == null
        ? null
        : Number(data.break_minutes),
  };

  // обновляем сам график
  const schedule = await workScheduleModel.update(id, prepared);

  // если selectedEmployeeIds не передали — ничего не меняем
  if (!("selectedEmployeeIds" in data)) {
    return schedule;
  }

  // если передали пустой массив [] — очистить график у всех сотрудников
  if (
    Array.isArray(data.selectedEmployeeIds) &&
    data.selectedEmployeeIds.length === 0
  ) {
    await workScheduleModel.clearWorkSchedule(id);
    return schedule;
  }

  // если передали сотрудников — сначала очистить всех, потом назначить новых
  if (Array.isArray(data.selectedEmployeeIds)) {
    await workScheduleModel.clearWorkSchedule(id);
    await workScheduleModel.updateWorkScheduleForMany(
      data.selectedEmployeeIds,
      id
    );
  }

  return schedule;
};
