import { LateEmployeesFilterPresetModel } from "./lateEmployeesFilterPresets.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const LateEmployeesFilterPresetService = {
  getAll: async () => {
    return LateEmployeesFilterPresetModel.getAll();
  },

  create: async ({ name, filter, userId }) => {
    if (!name?.trim()) {
      const err = new Error("Название фильтра обязательно");
      err.statusCode = 400;
      throw err;
    }

    const created = await LateEmployeesFilterPresetModel.create({
      name: name.trim(),
      filter,
      created_by: userId,
    });

    await createAuditLog({
      userId, action: "create", entity: "late_employees_filter_presets",
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

    const preset = await LateEmployeesFilterPresetModel.getById(id);

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

    const updated = await LateEmployeesFilterPresetModel.update({ id, name: name.trim(), filter });

    await createAuditLog({
      userId, action: "update", entity: "late_employees_filter_presets",
      recordId: id, oldData: preset, newData: updated,
    });

    return updated;
  },

  delete: async ({ id, userId }) => {
    const preset = await LateEmployeesFilterPresetModel.getById(id);

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

    await LateEmployeesFilterPresetModel.delete(id);

    await createAuditLog({
      userId, action: "delete", entity: "late_employees_filter_presets",
      recordId: id, oldData: preset,
    });
  },
};
