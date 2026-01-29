import * as holidaysModel from "./holidays.model.js";

export async function createHolidayService({
  name,
  date_from,
  date_to,
  creator_id,
}) {
  if (!name || !date_from || !date_to) {
    throw new Error("Все поля обязательны");
  }

  const from = new Date(date_from);
  const to = new Date(date_to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Некорректная дата");
  }

  if (from > to) {
    throw new Error("date_from не может быть больше date_to");
  }

  return holidaysModel.createHoliday({
    name: name.trim(),
    date_from: from,
    date_to: to,
    creator_id,
  });
}

export async function getHolidaysService({
  year,
  search,
  start_date,
  end_date,
}) {
  const where = {};
  const and = [];

  // --- фильтр по году ---
  if (year) {
    const y = Number(year);
    if (Number.isNaN(y)) {
      throw new Error("Некорректный год");
    }

    const startOfYear = new Date(`${y}-01-01`);
    const endOfYear = new Date(`${y}-12-31`);

    and.push(
      { date_from: { lte: endOfYear } },
      { date_to: { gte: startOfYear } }
    );
  }

  // --- фильтр по диапазону дат ---
  if (start_date || end_date) {
    const from = start_date ? new Date(start_date) : null;
    const to = end_date ? new Date(end_date) : null;

    if (from && Number.isNaN(from.getTime())) {
      throw new Error("Некорректная start_date");
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new Error("Некорректная end_date");
    }

    if (from && to && from > to) {
      throw new Error("start_date не может быть больше end_date");
    }

    and.push(
      ...(to ? [{ date_from: { lte: to } }] : []),
      ...(from ? [{ date_to: { gte: from } }] : [])
    );
  }

  if (and.length) {
    where.AND = and;
  }

  // --- поиск по названию ---
  if (search) {
    where.name = {
      contains: search,
      mode: "insensitive",
    };
  }

  const records = await holidaysModel.getHolidays({ where });

  const recordsFormatted = records.map((record) => {
    const employee = record.creator?.employee;
    const creatorFullName = employee
      ? [employee.last_name, employee.first_name, employee.middle_name]
          .filter(Boolean)
          .join(" ")
      : null;

    const formatDate = (date) =>
      date ? date.toISOString().slice(0, 10) : null;

    return {
      ...record,
      creatorFullName,
      date_from: formatDate(record.date_from),
      date_to: formatDate(record.date_to),
    };
  });

  return { data: recordsFormatted };
}

export async function getHolidayById(id) {
  if (!id) {
    throw new Error("ID обязателен");
  }

  const holidayId = Number(id);
  if (Number.isNaN(holidayId)) {
    throw new Error("Некорректный ID");
  }

  const record = await holidaysModel.getHolidays({ where: { id: holidayId } });

  if (!record || record.length === 0) {
    return null;
  }

  const holiday = record[0];

  const employee = holiday.creator?.employee;
  const creatorFullName = employee
    ? [employee.last_name, employee.first_name, employee.middle_name]
        .filter(Boolean)
        .join(" ")
    : null;

  const formatDate = (date) => (date ? date.toISOString().slice(0, 10) : null);

  return {
    ...holiday,
    creatorFullName,
    date_from: formatDate(holiday.date_from),
    date_to: formatDate(holiday.date_to),
  };
}

export async function updateHolidayById(id, updateData) {
  if (!id) {
    throw new Error("ID обязателен");
  }

  const holidayId = Number(id);
  if (Number.isNaN(holidayId)) {
    throw new Error("Некорректный ID");
  }

  // Проверка, что есть хотя бы одно поле для обновления
  const allowedFields = ["name", "date_from", "date_to"];
  const fieldsToUpdate = Object.keys(updateData).filter((key) =>
    allowedFields.includes(key)
  );

  if (fieldsToUpdate.length === 0) {
    throw new Error("Нет полей для обновления");
  }

  const updatePayload = {};

  // Подготовка данных для обновления
  for (const key of fieldsToUpdate) {
    if (key === "date_from" || key === "date_to") {
      const date = new Date(updateData[key]);
      if (Number.isNaN(date.getTime())) {
        throw new Error(`Некорректная дата: ${key}`);
      }
      updatePayload[key] = date;
    } else if (key === "name") {
      updatePayload[key] = updateData[key].trim();
    } else {
      updatePayload[key] = updateData[key];
    }
  }

  // Обновляем по ID
  const updatedRecords = await holidaysModel.updateHoliday(
    holidayId,
    updatePayload
  );

  if (!updatedRecords) {
    throw new Error("Праздник не найден");
  }

  return updatedRecords;
}
