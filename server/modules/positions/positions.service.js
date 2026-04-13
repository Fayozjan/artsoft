import { PositionModel } from "./positions.model.js";

export const PositionsService = {
  getPositions: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search)
      where.name = { contains: filters.search, mode: "insensitive" };
    if (filters.status !== undefined && filters.status !== "")
      where.status = filters.status === "true";

    const [positions, total] = await Promise.all([
      PositionModel.findMany({ where, skip, take: limit }),
      PositionModel.count(where),
    ]);

    const formatted = positions.map((p) => ({
      ...p,
      employees_count: p._count.employees,
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

  getActivePositions: async () => {
    const records = await PositionModel.findMany({ where: { status: true } });
    return {
      data: records.map((p) => ({ id: p.id, name: p.name, status: p.status })),
    };
  },

  getPositionById: async (id) => {
    return PositionModel.findUnique(id);
  },

  addPosition: async ({ name, status }) => {
    return PositionModel.create({ name, status });
  },

  editPositionById: async (id, { name, status }) => {
    return PositionModel.update(id, { name, status });
  },
};
