import { EmploymentOrdersModel } from "./employmentOrders.model.js";
import { EmployeeService } from "../employees/employees.service.js";
import { UserModel } from "../users/users.model.js";
import { FaceDevicesService } from "../faceDevices/faceDevices.service.js";
import { EmployeeModel } from "../employees/employees.model.js";
import { buildEmploymentOrderAccess } from "./employmentOrders.helpers.js";
import { AssetAssignmentModel } from "../assetAssignments/assetAssignments.model.js";
import { createAuditLog } from "../../utils/auditLog.js";

// Уволить нельзя, пока за сотрудником числится невозвращённое имущество
const assertNoAssignedAssets = async (employeeId) => {
  if (!employeeId) return;

  const count = await AssetAssignmentModel.count({
    employee_id: Number(employeeId),
    state: "assigned",
  });

  if (count > 0) {
    const err = new Error(
      `Нельзя уволить: за сотрудником числится имущество (${count} поз.). Сначала оформите возврат.`,
    );
    err.code = "EMPLOYEE_HAS_ASSETS";
    throw err;
  }
};

const pickOrderAuditFields = (o) => o ? ({
  id: o.id,
  type: o.type,
  order_number: o.order_number,
  date: o.date,
  employee_id: o.employee_id,
  branch_id: o.branch_id,
  department_id: o.department_id,
  position_id: o.position_id,
}) : null;

export const EmploymentOrdersService = {
  create: async (data, userId) => {
    if (data.type === "terminate") await assertNoAssignedAssets(data.employeeId);

    const prismaData = {
      type: data.type,
      date: data.order_date ? new Date(data.order_date) : new Date(),
      order_number: data.order_number || null,
      note: data.note || null,
      employee: { connect: { id: Number(data.employeeId) } },

      branch: data.branch_id
        ? { connect: { id: Number(data.branch_id) } }
        : undefined,

      department: data.department_id
        ? { connect: { id: Number(data.department_id) } }
        : undefined,

      position: data.position_id
        ? { connect: { id: Number(data.position_id) } }
        : undefined,
    };

    const order = await EmploymentOrdersModel.create(prismaData);

    // 3️⃣ Получаем последний приказ сотрудника
    const latestOrder = await EmploymentOrdersModel.findLatestByEmployee(
      order.employee_id,
    );

    if (latestOrder) {
      const status = latestOrder.type === "terminate" ? false : true;

      // 4️⃣ Обновляем данные сотрудника по последнему приказу
      await EmployeeModel.update(order.employee_id, {
        status,
        branch_id:
          latestOrder.branch_id !== undefined
            ? latestOrder.branch_id !== null
              ? Number(latestOrder.branch_id)
              : null
            : undefined,
        department_id:
          latestOrder.department_id !== undefined
            ? latestOrder.department_id !== null
              ? Number(latestOrder.department_id)
              : null
            : undefined,
        position_id:
          latestOrder.position_id !== undefined
            ? latestOrder.position_id !== null
              ? Number(latestOrder.position_id)
              : null
            : undefined,
      });

      if (!status) {
        FaceDevicesService.syncEmployee(order.employee_id);
      }
    }

    await createAuditLog({ userId, action: "create", entity: "employment_orders", recordId: order.id, newData: pickOrderAuditFields(order) });
    return order;
  },

  // Массовое оформление приказа об увольнении по списку сотрудников.
  // Один номер приказа на всех: в кадровой практике это один документ.
  bulkCreate: async (data, userId) => {
    const ids = [...new Set((data.employee_ids || []).map(Number))].filter(
      (id) => Number.isInteger(id) && id > 0,
    );

    if (!ids.length) throw new Error("Не выбраны сотрудники");
    if (!data.type) throw new Error("Не указан тип приказа");

    const employees = await EmployeeModel.getManyWithDoors(ids);
    const employeeById = new Map(employees.map((e) => [e.id, e]));

    const created = [];
    const blocked = [];

    for (const employeeId of ids) {
      const employee = employeeById.get(employeeId);

      if (!employee) {
        blocked.push({
          id: employeeId,
          name: String(employeeId),
          code: "NOT_FOUND",
          reason: "Сотрудник не найден",
        });
        continue;
      }

      const name = [employee.last_name, employee.first_name, employee.middle_name]
        .filter(Boolean)
        .join(" ");

      if (data.type === "terminate" && employee.status === false) {
        blocked.push({
          id: employeeId,
          name,
          code: "ALREADY_TERMINATED",
          reason: "Сотрудник уже уволен",
        });
        continue;
      }

      try {
        const order = await EmploymentOrdersService.create(
          {
            employeeId,
            type: data.type,
            order_number: data.order_number,
            order_date: data.order_date,
            note: data.note,
            branch_id: data.branch_id,
            department_id: data.department_id,
            position_id: data.position_id,
          },
          userId,
        );
        created.push({ employee_id: employeeId, order_id: order.id });
      } catch (err) {
        console.error(`Ошибка при создании приказа для ${employeeId}:`, err);
        blocked.push({
          id: employeeId,
          name,
          code: err.code || "ERROR",
          reason: err.message || "Ошибка при создании приказа",
        });
      }
    }

    return { created: created.length, orders: created, blocked };
  },

  getAll: async ({ userId, page = 1, pageSize = 20, filters = {} }) => {
    const limit = Number(pageSize);
    const currentPage = Math.max(Number(page), 1);
    const skip = (currentPage - 1) * limit;

    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const where = buildEmploymentOrderAccess(user);

    const { search, type, branch_id, department_id, position_id, date_from, date_to, sort_by, sort_order } = filters;

    if (search) {
      const numericId = Number(search);
      where.OR = [
        { order_number: { contains: search, mode: "insensitive" } },
        { employee: { first_name: { contains: search, mode: "insensitive" } } },
        { employee: { last_name: { contains: search, mode: "insensitive" } } },
        { employee: { middle_name: { contains: search, mode: "insensitive" } } },
        ...(Number.isInteger(numericId) && numericId > 0
          ? [{ employee_id: numericId }]
          : []),
      ];
    }

    if (type) where.type = type;

    if (branch_id) where.branch_id = Number(branch_id);

    if (department_id) where.department_id = Number(department_id);

    if (position_id) where.position_id = Number(position_id);

    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }

    const dir = sort_order === "asc" ? "asc" : "desc";
    const orderBy =
      sort_by === "order_number" ? { order_number: dir }
      : sort_by === "added_at"  ? { added_at: dir }
      : { date: dir };

    const [data, totalItems] = await Promise.all([
      EmploymentOrdersModel.findAll({ where, skip, take: limit, orderBy }),
      EmploymentOrdersModel.countAll(where),
    ]);

    return {
      data,
      pagination: {
        totalItems,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  },

  getStats: async (userId) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    const base = buildEmploymentOrderAccess(user);

    const [total, hire, terminate, transfer, leave] = await Promise.all([
      EmploymentOrdersModel.countAll({ ...base }),
      EmploymentOrdersModel.countAll({ ...base, type: "hire" }),
      EmploymentOrdersModel.countAll({ ...base, type: "terminate" }),
      EmploymentOrdersModel.countAll({ ...base, type: "transfer" }),
      EmploymentOrdersModel.countAll({ ...base, type: "leave" }),
    ]);

    return { total, hire, terminate, transfer, leave };
  },

  getById: async (id) => {
    return EmploymentOrdersModel.findById(id);
  },

  getByEmployeeId: async ({ userId, employeeId }) => {
    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    if (!employeeId) throw new Error("Employee ID is required");

    const orders = await EmploymentOrdersModel.findByEmployee(
      Number(employeeId),
    );

    return { data: orders };
  },

  update: async (id, data, userId) => {
    const order = await EmploymentOrdersModel.findById(id);
    if (!order) throw new Error("Приказ не найден");

    const nextType = data.type ?? order.type;
    if (nextType === "terminate" && order.type !== "terminate") {
      await assertNoAssignedAssets(order.employee_id);
    }

    const orderData = {
      order_number: data.order_number ?? order.order_number,
      date: data.date ? new Date(data.date) : order.date,
      branch_id: data.branch_id ?? order.branch_id,
      department_id: data.department_id ?? order.department_id,
      position_id: data.position_id ?? order.position_id,
      type: data.type ?? order.type,
    };

    const updatedOrder = await EmploymentOrdersModel.update(id, orderData);

    // 3️⃣ Получаем последний приказ сотрудника
    const latestOrder = await EmploymentOrdersModel.findLatestByEmployee(
      order.employee_id,
    );

    if (latestOrder) {
      const status = latestOrder.type === "terminate" ? false : true;

      // 4️⃣ Обновляем данные сотрудника по последнему приказу
      await EmployeeModel.update(order.employee_id, {
        status,
        branch_id:
          latestOrder.branch_id !== undefined
            ? latestOrder.branch_id !== null
              ? Number(latestOrder.branch_id)
              : null
            : undefined,
        department_id:
          latestOrder.department_id !== undefined
            ? latestOrder.department_id !== null
              ? Number(latestOrder.department_id)
              : null
            : undefined,
        position_id:
          latestOrder.position_id !== undefined
            ? latestOrder.position_id !== null
              ? Number(latestOrder.position_id)
              : null
            : undefined,
      });

      if (!status) {
        FaceDevicesService.syncEmployee(order.employee_id);
      }
    }

    await createAuditLog({ userId, action: "update", entity: "employment_orders", recordId: id, oldData: pickOrderAuditFields(order), newData: pickOrderAuditFields(updatedOrder) });
    return updatedOrder;
  },

  delete: async (userId, id) => {
    const order = await EmploymentOrdersModel.findById(id);
    if (!order) throw new Error("Приказ не найден");

    const user = await UserModel.getById(Number(userId));
    if (!user) throw new Error("Пользователь не найден");

    // 2️⃣ Получаем все приказы сотрудника
    const orders = await EmploymentOrdersModel.findByEmployee(
      order.employee_id,
    );

    const laterOrders = orders.filter((o) => o.date > order.date);

    // 3️⃣ Проверяем, нельзя ли удалить приказ hire если есть другие приказы после него
    if (order.type === "hire" && laterOrders.length > 0) {
      return {
        status: 409,
        message:
          "Нельзя удалить приказ о приёме, так как есть другие приказы после него",
      };
    }

    // 4️⃣ Удаляем приказ
    await EmploymentOrdersModel.delete(id);
    await createAuditLog({ userId, action: "delete", entity: "employment_orders", recordId: id, oldData: pickOrderAuditFields(order) });

    // 3️⃣ Получаем последний приказ сотрудника
    const latestOrder = await EmploymentOrdersModel.findLatestByEmployee(
      order.employee_id,
    );

    if (latestOrder) {
      const status = latestOrder.type === "terminate" ? false : true;

      await EmployeeService.update(order.employee_id, {
        status,
        branch_id:
          latestOrder.branch_id !== undefined
            ? latestOrder.branch_id !== null
              ? Number(latestOrder.branch_id)
              : null
            : undefined,
        department_id:
          latestOrder.department_id !== undefined
            ? latestOrder.department_id !== null
              ? Number(latestOrder.department_id)
              : null
            : undefined,
        position_id:
          latestOrder.position_id !== undefined
            ? latestOrder.position_id !== null
              ? Number(latestOrder.position_id)
              : null
            : undefined,
      });

      if (!status) {
        FaceDevicesService.syncEmployee(order.employee_id);
      }
    } else {
      await EmployeeService.update(order.employee_id, {
        status: false,
        branch_id: null,
        department_id: null,
        position_id: null,
      });

      FaceDevicesService.syncEmployee(order.employee_id);
    }

    return { success: true };
  },
};
