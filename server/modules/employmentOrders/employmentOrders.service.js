import prisma from "../../prisma/client.js";
import { buildAccessWhere } from "../../utils/accessFilter.js";
import * as model from "./employmentOrders.model.js";
import * as employeeService from "../employees/employees.service.js";
import { UserModel } from "../users/users.model.js";

export const getEmploymentOrders = async ({
  userId,
  page = 1,
  pageSize = 20,
  filters = {},
}) => {
  const limit = Number(pageSize);
  const currentPage = Math.max(Number(page), 1);
  const skip = (currentPage - 1) * limit;

  const user = await prisma.users.findUnique({
    where: { id: Number(userId) },
    select: {
      access_level: true,
      branches: true,
      departments: true,
    },
  });

  if (!user) throw new Error("Пользователь не найден");

  const where = buildAccessWhere(user);

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
    where.type = type; // hire | transfer | terminate
  }

  if (status !== undefined && status !== "") {
    where.status = status === "true";
  }

  const data = await model.findEmploymentOrders({
    where,
    skip,
    take: limit,
    orderBy: { created_at: "desc" },
  });

  const totalItems = await model.countEmploymentOrders(where);

  return {
    data,
    pagination: {
      totalItems,
      currentPage,
      pageSize: limit,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
};

export const getEmploymentOrderById = async (id) => {
  return model.findEmploymentOrderById(id);
};

export const getEmploymentOrdersByEmployeeId = async ({
  userId,
  employeeId,
  filters = {},
}) => {
  // Проверка пользователя и доступов
  const user = await UserModel.getUserById(Number(userId));

  if (!user) throw new Error("Пользователь не найден");

  // Начальный фильтр по доступам
  const where = buildAccessWhere(user);

  // Фильтр по конкретному сотруднику
  where.employee_id = Number(employeeId);

  // Дополнительные фильтры
  const { search, type, status } = filters;

  if (search) {
    where.OR = [
      { order_number: { contains: search, mode: "insensitive" } },
      {
        employees: {
          OR: [
            { first_name: { contains: search, mode: "insensitive" } },
            { last_name: { contains: search, mode: "insensitive" } },
            { middle_name: { contains: search, mode: "insensitive" } },
          ],
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

  // Получаем данные
  const data = await model.findEmploymentOrdersByEmployeeId({
    where,
    orderBy: { date: "desc" },
  });

  return { data };
};

export const createEmploymentOrder = async (data) => {
  // 1️⃣ Создаём приказ через модель
  const order = await model.createEmploymentOrderByModel(data);

  // 2️⃣ Получаем последний приказ сотрудника
  const latestOrder = await model.getLatestOrderByEmployee(data.employeeId);

  if (latestOrder) {
    // 3️⃣ Получаем полные данные последнего приказа
    const lastOrderFull = await model.findEmploymentOrderById(latestOrder.id);

    const status = lastOrderFull.type === "terminate" ? false : true;

    // 4️⃣ Обновляем данные сотрудника по последнему приказу
    await employeeService.updateEmployeeService(data.employeeId, {
      status,
      branch_id:
        lastOrderFull.branch_id !== undefined
          ? lastOrderFull.branch_id !== null
            ? Number(lastOrderFull.branch_id)
            : null
          : undefined,
      department_id:
        lastOrderFull.department_id !== undefined
          ? lastOrderFull.department_id !== null
            ? Number(lastOrderFull.department_id)
            : null
          : undefined,
      position_id:
        lastOrderFull.position_id !== undefined
          ? lastOrderFull.position_id !== null
            ? Number(lastOrderFull.position_id)
            : null
          : undefined,
    });
  }

  return order;
};

export const updateEmploymentOrder = async (id, data) => {
  // 1️⃣ Получаем приказ
  const order = await model.findEmploymentOrderById(id);
  if (!order) throw new Error("Приказ не найден");

  // 2️⃣ Обновляем сам приказ через модель
  const orderData = {
    order_number: data.order_number ?? order.order_number,
    date: data.date ? new Date(data.date) : order.date,
    branch_id: data.branch_id ?? order.branch_id,
    department_id: data.department_id ?? order.department_id,
    position_id: data.position_id ?? order.position_id,
    type: data.type ?? order.type,
  };

  const updatedOrder = await model.updateEmploymentOrderById(id, orderData);

  // 3️⃣ Получаем последний приказ сотрудника
  const latestOrder = await model.getLatestOrderByEmployee(order.employee_id);

  if (latestOrder) {
    const lastOrderFull = await model.findEmploymentOrderById(latestOrder.id);

    const status = lastOrderFull.type === "terminate" ? false : true;

    // 4️⃣ Обновляем данные сотрудника по последнему приказу
    await employeeService.updateEmployeeService(order.employee_id, {
      status,
      branch_id:
        lastOrderFull.branch_id !== undefined
          ? lastOrderFull.branch_id !== null
            ? Number(lastOrderFull.branch_id)
            : null
          : undefined,
      department_id:
        lastOrderFull.department_id !== undefined
          ? lastOrderFull.department_id !== null
            ? Number(lastOrderFull.department_id)
            : null
          : undefined,
      position_id:
        lastOrderFull.position_id !== undefined
          ? lastOrderFull.position_id !== null
            ? Number(lastOrderFull.position_id)
            : null
          : undefined,
    });
  }

  return updatedOrder;
};

export const deleteEmploymentOrder = async (userId, id) => {
  // 1️⃣ Получаем приказ
  const order = await getEmploymentOrderById(id);
  if (!order) throw new Error("Приказ не найден");

  // 2️⃣ Получаем все приказы сотрудника
  const orders = await getEmploymentOrdersByEmployeeId({
    userId,
    employeeId: order.employee_id,
  });

  const employeeOrders = orders.data;

  // 3️⃣ Проверяем, нельзя ли удалить приказ hire если есть другие приказы
  if (order.type === "hire" && employeeOrders.length > 1) {
    return {
      status: 409,
      message:
        "Нельзя удалить приказ о приёме, так как есть другие кадровые события",
    };
  }

  // 4️⃣ Удаляем приказ
  await model.deleteEmploymentOrderById(id);

  // 3️⃣ Получаем последний приказ сотрудника
  const latestOrder = await model.getLatestOrderByEmployee(order.employee_id);

  if (latestOrder) {
    const lastOrderFull = await model.findEmploymentOrderById(latestOrder.id);

    const status = lastOrderFull.type === "terminate" ? false : true;

    // 4️⃣ Обновляем данные сотрудника по последнему приказу
    await employeeService.updateEmployeeService(order.employee_id, {
      status,
      branch_id:
        lastOrderFull.branch_id !== undefined
          ? lastOrderFull.branch_id !== null
            ? Number(lastOrderFull.branch_id)
            : null
          : undefined,
      department_id:
        lastOrderFull.department_id !== undefined
          ? lastOrderFull.department_id !== null
            ? Number(lastOrderFull.department_id)
            : null
          : undefined,
      position_id:
        lastOrderFull.position_id !== undefined
          ? lastOrderFull.position_id !== null
            ? Number(lastOrderFull.position_id)
            : null
          : undefined,
    });
  }
  await employeeService.updateEmployeeService(order.employee_id, {
    status: false,
    branch_id: null,
    department_id: null,
    position_id: null,
  });

  return { success: true };
};
