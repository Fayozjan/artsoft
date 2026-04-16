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
    if (filters.branch_id)
      where.branch_id = Number(filters.branch_id);

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

  createDoor: async ({ name, status = true, branch_id, latitude, longitude }) => {
    return DoorModel.create({
      name,
      status,
      branch_id: branch_id ? Number(branch_id) : null,
      latitude: latitude !== undefined && latitude !== "" ? parseFloat(latitude) : null,
      longitude: longitude !== undefined && longitude !== "" ? parseFloat(longitude) : null,
    });
  },

  updateDoor: async (id, { name, status, branch_id, latitude, longitude }) => {
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (status !== undefined) data.status = status === "true" || status === true;
    if (branch_id !== undefined) data.branch_id = branch_id ? Number(branch_id) : null;
    if (latitude !== undefined) data.latitude = latitude !== "" ? parseFloat(latitude) : null;
    if (longitude !== undefined) data.longitude = longitude !== "" ? parseFloat(longitude) : null;
    return DoorModel.update(id, data);
  },
};
