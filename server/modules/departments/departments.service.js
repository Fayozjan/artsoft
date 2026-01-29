import { buildAccessWhere } from "../../utils/accessFilter.js";
import { UserModel } from "../users/users.model.js";
import { findActiveDepartments } from "./departments.model.js";

export async function getActiveDepartmentsService({ userId }) {
  const user = await UserModel.getUserById(userId);

  if (!user) throw new Error("Пользователь не найден");

  const where = buildAccessWhere(user);

  const records = await findActiveDepartments(where);

  return {
    data: records.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      branchId: d.branch_id,
      branchName: d.branch?.name || null,
      activeEmployeesCount: d._count.employees,
    })),
  };
}
