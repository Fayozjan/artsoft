import { DoorModel } from "./doors.model.js";

export const DoorsService = {
  getDoors: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [doors, total] = await Promise.all([
      DoorModel.findMany({ where, skip, take: limit }),
      DoorModel.count(where),
    ]);

    const formatted = doors.map((d) => ({
      ...d,
      employeesCount: d._count.employees,
    }));

    return {
      data: formatted,
      pagination: {
        totalItems: total,
        currentPage,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getActiveDoors: async () => {
    return DoorModel.findActive();
  },

  getDoorById: async (id) => {
    return DoorModel.findUnique(id);
  },

  createDoor: async ({ name, status = true }) => {
    return DoorModel.create({ name, status });
  },

  updateDoor: async (id, { name, status }) => {
    return DoorModel.update(id, {
      name: name?.trim(),
      status: status === "true",
    });
  },
};
