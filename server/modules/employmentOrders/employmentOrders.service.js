import { EmploymentOrdersModel } from "./employmentOrders.model.js";
import { EmployeeService } from "../employees/employees.service.js";
import { UserModel } from "../users/users.model.js";
import { FaceDevicesService } from "../faceDevices/faceDevices.service.js";
import { EmployeeModel } from "../employees/employees.model.js";
import { buildEmploymentOrderAccess } from "./employmentOrders.helpers.js";

export const EmploymentOrdersService = {
  create: async (data) => {
    const prismaData = {
      type: data.type,
      date: data.order_date ? new Date(data.order_date) : new Date(),
      order_number: data.order_number || null,
      note: data.note || null,
      employee: { connect: { id: Number(data.employeeId) } },

      branch:
        data.branch_id === null
          ? { disconnect: true }
          : data.branch_id
            ? { connect: { id: Number(data.branch_id) } }
            : undefined,

      department:
        data.department_id === null
          ? { disconnect: true }
          : data.department_id
            ? { connect: { id: Number(data.department_id) } }
            : undefined,

      position:
        data.position_id === null
          ? { disconnect: true }
          : data.position_id
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
    }

    return order;
  },

  getAll: async ({ userId, page = 1, pageSize = 20, filters = {} }) => {
    const limit = Number(pageSize);
    const currentPage = Math.max(Number(page), 1);
    const skip = (currentPage - 1) * limit;

    const user = await UserModel.getById(Number(userId));

    if (!user) throw new Error("Пользователь не найден");

    const where = buildEmploymentOrderAccess(user);

    const { search, type, status } = filters;

    if (search) {
      where.OR = [
        { order_number: { contains: search, mode: "insensitive" } },
        {
          employee: {
            full_name: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (status !== undefined && status !== "") {
      where.status = status === "true";
    }

    const data = await EmploymentOrdersModel.findAll({
      where,
      skip,
      take: limit,
      orderBy: { created_at: "desc" },
    });

    const totalItems = await EmploymentOrdersModel.countAll(where);

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

  update: async (id, data) => {
    const order = await EmploymentOrdersModel.findById(id);
    if (!order) throw new Error("Приказ не найден");

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
