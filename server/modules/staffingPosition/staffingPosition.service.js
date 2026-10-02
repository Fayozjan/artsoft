import { StaffingPositionModel } from "./staffingPosition.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

export const StaffingPositionService = {
  getByDepartment: async (departmentId) => {
    return StaffingPositionModel.findByDepartment(departmentId);
  },

  bulkUpsert: async (departmentId, positions = [], userId) => {
    const old = await StaffingPositionModel.findByDepartment(departmentId);
    const result = await StaffingPositionModel.bulkUpsert(departmentId, positions);
    await createAuditLog({
      userId, action: "update", entity: "staffing_position", recordId: Number(departmentId),
      oldData: old, newData: result,
    });
    return result;
  },
};
