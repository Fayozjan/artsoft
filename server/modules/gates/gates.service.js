import { GateModel } from "./gates.model.js";

export const GatesService = {
  getGates: async ({ page, pageSize, filters = {} }) => {
    const currentPage = Math.max(parseInt(page || 1), 1);
    const limit = Math.max(parseInt(pageSize || 50), 1);
    const skip = (currentPage - 1) * limit;

    const where = {};
    if (filters.search) {
      where.name = { contains: filters.search, mode: "insensitive" };
    }

    if (filters.status !== undefined && filters.status !== "") {
      where.status = filters.status === "true";
    }

    const [gates, total] = await Promise.all([
      GateModel.findMany({ where, skip, take: limit }),
      GateModel.count(where),
    ]);

    const formatted = gates.map((g) => ({
      id: g.id,
      name: g.name,
      status: g.status,
      branch: g.branch?.name || null,
      camerasCount: g._count?.cameras || 0,
      cameras: g.cameras.map((c) => c.name),
      addedAt: g.added_at,
      updatedAt: g.updated_at,
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

  getActiveGates: async () => {
    return GateModel.findActive();
  },

  getGateById: async (id) => {
    return GateModel.findUnique(id);
  },

  createGate: async ({ name, status = true }) => {
    return GateModel.create({
      name: name?.trim(),
      status,
    });
  },

  updateGate: async (id, { name, status }) => {
    return GateModel.update(id, {
      name: name?.trim(),
      status: status === "true",
    });
  },
};
