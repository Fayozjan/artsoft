import { TimesheetFilterPresetModel } from "./timesheetFilterPresets.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const TimesheetFilterPresetService = {
  getAll: async () => {
    return TimesheetFilterPresetModel.getAll();
  },

  create: async ({ name, filter, userId }) => {
    if (!name?.trim()) {
      const err = new Error("Название фильтра обязательно");
      err.statusCode = 400;
      throw err;
    }

    const created = await TimesheetFilterPresetModel.create({
      name: name.trim(),
      filter,
      created_by: userId,
    });

    await createAuditLog({
      userId, action: "create", entity: "timesheet_filter_presets",
      recordId: created.id, newData: created,
    });

    return created;
  },

  update: async ({ id, name, filter, userId }) => {
    if (!name?.trim()) {
      const err = new Error("Название фильтра обязательно");
      err.statusCode = 400;
      throw err;
    }

    const preset = await TimesheetFilterPresetModel.getById(id);

    if (!preset) {
      const err = new Error("Фильтр не найден");
      err.statusCode = 404;
      throw err;
    }

    if (preset.created_by !== userId) {
      const err = new Error("Изменить фильтр может только его создатель");
      err.statusCode = 400;
      throw err;
    }

    const updated = await TimesheetFilterPresetModel.update({ id, name: name.trim(), filter });

    await createAuditLog({
      userId, action: "update", entity: "timesheet_filter_presets",
      recordId: id, oldData: preset, newData: updated,
    });

    return updated;
  },

  delete: async ({ id, userId }) => {
    const preset = await TimesheetFilterPresetModel.getById(id);

    if (!preset) {
      const err = new Error("Фильтр не найден");
      err.statusCode = 404;
      throw err;
    }

    if (preset.created_by !== userId) {
      const err = new Error("Удалить фильтр может только его создатель");
      err.statusCode = 400;
      throw err;
    }

    await TimesheetFilterPresetModel.delete(id);

    await createAuditLog({
      userId, action: "delete", entity: "timesheet_filter_presets",
      recordId: id, oldData: preset,
    });
  },
};
